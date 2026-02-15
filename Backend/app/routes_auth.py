from datetime import datetime, timedelta
import secrets
import logging
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from app.models import (
    RegisterModel,
    LoginModel,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    OtpVerifyRequest,
    PasswordChangeRequestOtp,
    PasswordChangeConfirm,
)
from app.database import users, password_resets
from app.auth import hash_password, verify_password, create_token, get_current_user
from app.config.settings import settings
from app.services.email_service import send_password_reset_email, send_registration_email
from app.services.otp_service import (
    OtpError,
    create_and_send_otp,
    verify_otp,
    PURPOSE_LOGIN_2FA,
    PURPOSE_CHANGE_PASSWORD,
    PURPOSE_ENABLE_2FA,
    PURPOSE_DISABLE_2FA,
)
from app.utils import serialize_doc

router = APIRouter(prefix="/api/auth")
LOGGER = logging.getLogger(__name__)


def _raise_otp_http(exc: Exception) -> None:
    message = str(exc) or "OTP error"
    status_code = 400
    if "recently sent" in message.lower():
        status_code = 429
    elif "deliver otp" in message.lower():
        status_code = 502
    raise HTTPException(status_code=status_code, detail=message)


def _send_registration_email_safe(to_email: str, name: str, user_type: str) -> None:
    try:
        send_registration_email(to_email=to_email, name=name, user_type=user_type)
    except Exception as exc:
        LOGGER.warning("Registration email delivery failed for %s: %s", to_email, exc)


@router.post("/register")
def register(user: RegisterModel, background_tasks: BackgroundTasks):
    if not user.email and not user.phone:
        raise HTTPException(status_code=400, detail="Email or phone required")
    conditions = []
    if user.email:
        conditions.append({"email": user.email})
    if user.phone:
        conditions.append({"phone": user.phone})
    if conditions and users.find_one({"$or": conditions}):
        raise HTTPException(status_code=400, detail="User exists")
    data = user.dict()
    data["password"] = hash_password(user.password)
    data["createdAt"] = datetime.utcnow().isoformat()
    data["emailVerified"] = False
    data.setdefault("twoFactorEnabled", False)
    result = users.insert_one(data)
    db_user = users.find_one({"_id": result.inserted_id})
    if settings.EMAIL_NOTIFY_ON_REGISTER and db_user and db_user.get("email"):
        background_tasks.add_task(
            _send_registration_email_safe,
            db_user.get("email"),
            db_user.get("name") or "User",
            db_user.get("userType") or "citizen",
        )
    token = create_token({"sub": str(result.inserted_id), "email": db_user.get("email"), "phone": db_user.get("phone")})
    user_payload = serialize_doc(db_user)
    user_payload.pop("password", None)
    return {
        "success": True,
        "data": {
            "token": token,
            "user": user_payload
        }
    }

@router.post("/login")
def login(user: LoginModel):
    query = None
    if user.email:
        query = {"email": user.email}
    elif user.phone:
        query = {"phone": user.phone}
    else:
        raise HTTPException(status_code=400, detail="Email or phone required")
    db_user = users.find_one(query)
    if not db_user or not verify_password(user.password, db_user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if bool(db_user.get("twoFactorEnabled")):
        try:
            challenge = create_and_send_otp(db_user, purpose=PURPOSE_LOGIN_2FA)
        except OtpError as exc:
            _raise_otp_http(exc)
        return {
            "success": True,
            "data": {
                "requiresOtp": True,
                "challengeId": challenge.challenge_id,
                "channels": challenge.channels_sent,
                "maskedEmail": challenge.masked_email,
                "maskedPhone": challenge.masked_phone,
            },
        }

    token = create_token({"sub": str(db_user["_id"]), "email": db_user.get("email"), "phone": db_user.get("phone")})
    user_payload = serialize_doc(db_user)
    user_payload.pop("password", None)
    return {"success": True, "data": {"token": token, "user": user_payload}}


@router.post("/verify-otp")
def verify_login_otp(payload: OtpVerifyRequest):
    try:
        record = verify_otp(payload.challengeId, payload.otp, purpose=PURPOSE_LOGIN_2FA)
    except OtpError as exc:
        _raise_otp_http(exc)

    user_id = record.get("userId")
    if not user_id:
        raise HTTPException(status_code=400, detail="OTP challenge missing user")
    try:
        from bson import ObjectId
        user = users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        user = None
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    token = create_token({"sub": str(user.get("_id")), "email": user.get("email"), "phone": user.get("phone")})
    user_payload = serialize_doc(user)
    user_payload.pop("password", None)
    return {"success": True, "data": {"token": token, "user": user_payload}}

@router.post("/logout")
def logout():
    return {"success": True, "data": True}

@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest):
    if not payload.email and not payload.phone:
        raise HTTPException(status_code=400, detail="Email or phone required")
    user = None
    if payload.email:
        user = users.find_one({"email": payload.email})
    elif payload.phone:
        user = users.find_one({"phone": payload.phone})
    if not user:
        return {"success": True, "data": {"message": "If the account exists, a reset link was sent"}}
    target_email = payload.email or user.get("email")
    if not target_email:
        return {"success": True, "data": {"message": "If the account exists, a reset link was sent"}}
    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(minutes=settings.PASSWORD_RESET_EXPIRE_MINUTES)
    password_resets.insert_one({
        "email": target_email,
        "token": token,
        "expiresAt": expires_at,
        "used": False,
        "createdAt": datetime.utcnow()
    })
    reset_link = f"{settings.DOMAIN}/reset-password?token={token}"
    try:
        send_password_reset_email(target_email, reset_link)
    except Exception as exc:
        LOGGER.error("Password reset email delivery failed for %s: %s", target_email, exc)
        raise HTTPException(status_code=502, detail="Unable to send password reset email right now")
    return {"success": True, "data": {"message": "Password reset link sent"}}

@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest):
    record = password_resets.find_one({
        "token": payload.token,
        "used": False,
        "expiresAt": {"$gte": datetime.utcnow()}
    })
    if not record:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    user = users.find_one({"email": record["email"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    users.update_one({"_id": user["_id"]}, {"$set": {"password": hash_password(payload.password), "updatedAt": datetime.utcnow().isoformat()}})
    password_resets.update_one({"_id": record["_id"]}, {"$set": {"used": True, "usedAt": datetime.utcnow()}})
    return {"success": True, "data": {"message": "Password updated"}}


@router.post("/password/change/request-otp")
def request_password_change_otp(payload: PasswordChangeRequestOtp, current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        from bson import ObjectId
        db_user = users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        db_user = None
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    if not verify_password(payload.currentPassword, db_user.get("password", "")):
        raise HTTPException(status_code=401, detail="Invalid current password")
    try:
        challenge = create_and_send_otp(db_user, purpose=PURPOSE_CHANGE_PASSWORD)
    except OtpError as exc:
        _raise_otp_http(exc)
    return {
        "success": True,
        "data": {
            "challengeId": challenge.challenge_id,
            "channels": challenge.channels_sent,
            "maskedEmail": challenge.masked_email,
            "maskedPhone": challenge.masked_phone,
        },
    }


@router.post("/password/change/confirm")
def confirm_password_change(payload: PasswordChangeConfirm, current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        _ = verify_otp(
            payload.challengeId,
            payload.otp,
            purpose=PURPOSE_CHANGE_PASSWORD,
            user_id=user_id,
        )
    except OtpError as exc:
        _raise_otp_http(exc)
    try:
        from bson import ObjectId
        obj_id = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user id")
    users.update_one(
        {"_id": obj_id},
        {"$set": {"password": hash_password(payload.newPassword), "updatedAt": datetime.utcnow().isoformat()}},
    )
    return {"success": True, "data": {"changed": True}}


@router.post("/2fa/enable/request-otp")
def request_enable_2fa_otp(current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        from bson import ObjectId
        db_user = users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        db_user = None
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    try:
        challenge = create_and_send_otp(db_user, purpose=PURPOSE_ENABLE_2FA)
    except OtpError as exc:
        _raise_otp_http(exc)
    return {
        "success": True,
        "data": {
            "challengeId": challenge.challenge_id,
            "channels": challenge.channels_sent,
            "maskedEmail": challenge.masked_email,
            "maskedPhone": challenge.masked_phone,
        },
    }


@router.post("/2fa/enable/confirm")
def confirm_enable_2fa(payload: OtpVerifyRequest, current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        _ = verify_otp(payload.challengeId, payload.otp, purpose=PURPOSE_ENABLE_2FA, user_id=user_id)
    except OtpError as exc:
        _raise_otp_http(exc)
    try:
        from bson import ObjectId
        obj_id = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user id")
    users.update_one({"_id": obj_id}, {"$set": {"twoFactorEnabled": True, "updatedAt": datetime.utcnow().isoformat()}})
    user = users.find_one({"_id": obj_id})
    user_payload = serialize_doc(user)
    user_payload.pop("password", None)
    return {"success": True, "data": user_payload}


@router.post("/2fa/disable/request-otp")
def request_disable_2fa_otp(current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        from bson import ObjectId
        db_user = users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        db_user = None
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    try:
        challenge = create_and_send_otp(db_user, purpose=PURPOSE_DISABLE_2FA)
    except OtpError as exc:
        _raise_otp_http(exc)
    return {
        "success": True,
        "data": {
            "challengeId": challenge.challenge_id,
            "channels": challenge.channels_sent,
            "maskedEmail": challenge.masked_email,
            "maskedPhone": challenge.masked_phone,
        },
    }


@router.post("/2fa/disable/confirm")
def confirm_disable_2fa(payload: OtpVerifyRequest, current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        _ = verify_otp(payload.challengeId, payload.otp, purpose=PURPOSE_DISABLE_2FA, user_id=user_id)
    except OtpError as exc:
        _raise_otp_http(exc)
    try:
        from bson import ObjectId
        obj_id = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user id")
    users.update_one({"_id": obj_id}, {"$set": {"twoFactorEnabled": False, "updatedAt": datetime.utcnow().isoformat()}})
    user = users.find_one({"_id": obj_id})
    user_payload = serialize_doc(user)
    user_payload.pop("password", None)
    return {"success": True, "data": user_payload}

@router.post("/verify-email")
def verify_email(payload: dict):
    email = payload.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Email required")
    users.update_one({"email": email}, {"$set": {"emailVerified": True, "updatedAt": datetime.utcnow().isoformat()}})
    return {"success": True, "data": {"verified": True}}
