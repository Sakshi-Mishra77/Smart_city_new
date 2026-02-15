from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from app.auth import get_current_user
from app.database import users
from app.models import UserUpdate
from app.utils import serialize_doc, to_object_id
from pymongo.errors import DuplicateKeyError

router = APIRouter(prefix="/api/users")

@router.get("/profile")
def get_profile(current_user: dict = Depends(get_current_user)):
    return {"success": True, "data": current_user}

@router.put("/profile")
def update_profile(payload: UserUpdate, current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    updates = payload.dict(exclude_unset=True, exclude_none=True)
    if not updates:
        return {"success": True, "data": current_user}
    updates["updatedAt"] = datetime.utcnow().isoformat()
    obj_id = to_object_id(user_id)
    try:
        users.update_one({"_id": obj_id}, {"$set": updates})
    except DuplicateKeyError:
        raise HTTPException(status_code=400, detail="Email or phone already in use")
    user = users.find_one({"_id": obj_id})
    data = serialize_doc(user)
    if data:
        data.pop("password", None)
    return {"success": True, "data": data}
