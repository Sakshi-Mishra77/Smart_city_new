import os
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from app.database import incidents, messages, tickets
from app.models import IncidentCreate, IncidentUpdate, MessageCreate
from app.services.ws_manager import manager
from app.services.image_service import save_image
from app.services.email_service import send_alert_email
from app.services.notification_service import send_stakeholder_notifications
from app.issue_model import IssueIn
from app.auth import get_current_user, get_official_user
from app.utils import serialize_doc, serialize_list, to_object_id

router = APIRouter(prefix="/api")
LOGGER = logging.getLogger(__name__)

def _now_iso():
    return datetime.utcnow().isoformat()

def _save_images(images: list[str] | None):
    image_urls = []
    if not images:
        return image_urls
    for img in images:
        if not img:
            continue
        try:
            path = save_image(img)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid image data")
        filename = os.path.basename(path)
        image_urls.append(f"/images/{filename}")
    return image_urls

def _get_incident_doc(incident_id: str):
    try:
        obj_id = to_object_id(incident_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid incident id")
    doc = incidents.find_one({"_id": obj_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Incident not found")
    return doc

def _is_official(user: dict):
    return user.get("userType") == "official"

def _can_access_incident(doc: dict, user: dict):
    if _is_official(user):
        return True
    reporter_id = doc.get("reporterId")
    if reporter_id and reporter_id == user.get("id"):
        return True
    return False

def _notify_new_issue(description: str, lat: float | None, lon: float | None):
    try:
        send_alert_email(description, lat, lon)
    except Exception as exc:
        LOGGER.warning("Alert email notification failed: %s", exc)
    text = f"SafeLive alert: {description}. Location {lat}, {lon}."
    try:
        send_stakeholder_notifications(text)
    except Exception as exc:
        LOGGER.warning("Stakeholder notification failed: %s", exc)

def _create_ticket_from_incident(doc: dict):
    if not doc:
        return None
    ticket_doc = {
        "title": doc.get("title"),
        "description": doc.get("description"),
        "category": doc.get("category"),
        "priority": doc.get("priority") or "medium",
        "status": "open",
        "location": doc.get("location"),
        "latitude": doc.get("latitude"),
        "longitude": doc.get("longitude"),
        "reportedBy": doc.get("reportedBy"),
        "reporterEmail": doc.get("reporterEmail"),
        "reporterPhone": doc.get("reporterPhone"),
        "assignedTo": doc.get("assignedTo"),
        "incidentId": str(doc.get("_id")),
        "createdAt": doc.get("createdAt") or _now_iso(),
        "updatedAt": doc.get("updatedAt") or _now_iso()
    }
    result = tickets.insert_one(ticket_doc)
    return result.inserted_id

@router.get("/incidents")
@router.get("/issues")
def get_incidents(current_user: dict = Depends(get_current_user)):
    query = {}
    if not _is_official(current_user):
        query["reporterId"] = current_user.get("id")
    data = list(incidents.find(query).sort("createdAt", -1))
    return {"success": True, "data": serialize_list(data)}

@router.get("/incidents/stats")
@router.get("/issues/stats")
def stats(current_user: dict = Depends(get_current_user)):
    query = {}
    if not _is_official(current_user):
        query["reporterId"] = current_user.get("id")
    total = incidents.count_documents(query)
    open_c = incidents.count_documents({**query, "status": "open"})
    in_prog = incidents.count_documents({**query, "status": "in_progress"})
    resolved = incidents.count_documents({**query, "status": "resolved"})
    return {
        "success": True,
        "data": {
            "total": total,
            "open": open_c,
            "inProgress": in_prog,
            "resolved": resolved,
            "pending": open_c
        }
    }

@router.get("/incidents/{incident_id}")
@router.get("/issues/{incident_id}")
def get_incident(incident_id: str, current_user: dict = Depends(get_current_user)):
    doc = _get_incident_doc(incident_id)
    if not _can_access_incident(doc, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    return {"success": True, "data": serialize_doc(doc)}

@router.post("/incidents")
@router.post("/issues")
async def create_incident(incident: IncidentCreate, current_user: dict = Depends(get_current_user)):
    data = incident.dict()
    images = data.pop("images", None)
    image_urls = _save_images(images)
    if image_urls:
        data["imageUrls"] = image_urls
        data["imageUrl"] = image_urls[0]
    now = _now_iso()
    data.update({
        "status": "open",
        "createdAt": now,
        "updatedAt": now,
        "hasMessages": False
    })
    if current_user:
        data["reportedBy"] = current_user.get("name") or current_user.get("email") or current_user.get("phone")
        data["reporterId"] = current_user.get("id")
        data["reporterEmail"] = current_user.get("email")
        data["reporterPhone"] = current_user.get("phone")
    result = incidents.insert_one(data)
    doc = incidents.find_one({"_id": result.inserted_id})
    ticket_id = _create_ticket_from_incident(doc)
    if ticket_id:
        incidents.update_one({"_id": result.inserted_id}, {"$set": {"ticketId": str(ticket_id)}})
        doc = incidents.find_one({"_id": result.inserted_id})
    payload = serialize_doc(doc)
    _notify_new_issue(payload.get("description", ""), payload.get("latitude"), payload.get("longitude"))
    await manager.broadcast({
        "type": "NEW_INCIDENT",
        "data": payload
    })
    return {"success": True, "data": payload}

@router.post("/report")
async def report_issue(issue: IssueIn):
    image_url = None
    if issue.image:
        try:
            path = save_image(issue.image)
            filename = os.path.basename(path)
            image_url = f"/images/{filename}"
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid image data")
    now = _now_iso()
    data = {
        "title": "AI Detected Issue",
        "description": issue.description,
        "category": "ai",
        "priority": "high",
        "location": f"{issue.latitude}, {issue.longitude}",
        "latitude": issue.latitude,
        "longitude": issue.longitude,
        "severity": issue.severity,
        "scope": issue.scope,
        "source": issue.source or "edge",
        "deviceId": issue.deviceId,
        "status": "open",
        "createdAt": now,
        "updatedAt": now,
        "hasMessages": False
    }
    if image_url:
        data["imageUrls"] = [image_url]
        data["imageUrl"] = image_url
    result = incidents.insert_one(data)
    doc = incidents.find_one({"_id": result.inserted_id})
    ticket_id = _create_ticket_from_incident(doc)
    if ticket_id:
        incidents.update_one({"_id": result.inserted_id}, {"$set": {"ticketId": str(ticket_id)}})
        doc = incidents.find_one({"_id": result.inserted_id})
    payload = serialize_doc(doc)
    _notify_new_issue(issue.description, issue.latitude, issue.longitude)
    await manager.broadcast({
        "type": "NEW_INCIDENT",
        "data": payload
    })
    return {"success": True, "data": payload}

@router.put("/incidents/{incident_id}")
@router.put("/issues/{incident_id}")
def update_incident(incident_id: str, incident: IncidentUpdate, current_user: dict = Depends(get_official_user)):
    _ = _get_incident_doc(incident_id)
    updates = incident.dict(exclude_unset=True, exclude_none=True)
    images = updates.pop("images", None)
    if images is not None:
        image_urls = _save_images(images)
        if image_urls:
            updates["imageUrls"] = image_urls
            updates["imageUrl"] = image_urls[0]
    updates["updatedAt"] = _now_iso()
    obj_id = to_object_id(incident_id)
    incidents.update_one({"_id": obj_id}, {"$set": updates})
    doc = incidents.find_one({"_id": obj_id})
    if doc:
        ticket_updates = {}
        for field in ["title", "description", "category", "priority", "status", "location", "latitude", "longitude", "assignedTo"]:
            if field in updates:
                ticket_updates[field] = doc.get(field)
        if ticket_updates:
            ticket_updates["updatedAt"] = doc.get("updatedAt")
            tickets.update_one({"incidentId": str(doc.get("_id"))}, {"$set": ticket_updates})
    return {"success": True, "data": serialize_doc(doc)}

@router.delete("/incidents/{incident_id}")
@router.delete("/issues/{incident_id}")
def delete_incident(incident_id: str, current_user: dict = Depends(get_official_user)):
    obj_id = to_object_id(incident_id)
    result = incidents.delete_one({"_id": obj_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Incident not found")
    messages.delete_many({"incidentId": incident_id})
    tickets.delete_many({"incidentId": incident_id})
    return {"success": True, "data": True}

@router.get("/incidents/{incident_id}/messages")
@router.get("/issues/{incident_id}/messages")
def get_messages(incident_id: str, current_user: dict = Depends(get_current_user)):
    incident_doc = _get_incident_doc(incident_id)
    if not _can_access_incident(incident_doc, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    data = list(messages.find({"incidentId": incident_id}).sort("createdAt", 1))
    return {"success": True, "data": serialize_list(data)}

@router.post("/incidents/{incident_id}/messages")
@router.post("/issues/{incident_id}/messages")
async def create_message(incident_id: str, payload: MessageCreate, current_user: dict = Depends(get_current_user)):
    incident_doc = _get_incident_doc(incident_id)
    if not _can_access_incident(incident_doc, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    message_doc = {
        "incidentId": incident_id,
        "message": payload.message,
        "sender": current_user.get("name") or current_user.get("email") or current_user.get("phone"),
        "senderId": current_user.get("id"),
        "createdAt": _now_iso()
    }
    result = messages.insert_one(message_doc)
    incidents.update_one({"_id": to_object_id(incident_id)}, {"$set": {"hasMessages": True, "updatedAt": _now_iso()}})
    doc = messages.find_one({"_id": result.inserted_id})
    return {"success": True, "data": serialize_doc(doc)}
