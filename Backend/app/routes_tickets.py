from datetime import datetime, timedelta
import logging
from fastapi import APIRouter, Depends, HTTPException
from app.database import tickets
from app.auth import get_official_user
from app.models import TicketUpdateStatus, TicketAssign
from app.utils import serialize_doc, serialize_list, to_object_id
from app.services.notification_service import send_sms, send_whatsapp
from app.services.email_service import send_ticket_update_email

router = APIRouter(prefix="/api/tickets")
LOGGER = logging.getLogger(__name__)

def _now_iso():
    return datetime.utcnow().isoformat()

def _get_ticket_doc(ticket_id: str):
    try:
        obj_id = to_object_id(ticket_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ticket id")
    doc = tickets.find_one({"_id": obj_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return doc

def _notify_ticket_update(doc: dict):
    message = f"SafeLive ticket update: {doc.get('title', 'Ticket')} is now {doc.get('status', 'updated')}."
    if doc.get("reporterPhone"):
        sms_ok, sms_error = send_sms(doc.get("reporterPhone"), message)
        if not sms_ok:
            LOGGER.warning("SMS notification failed for ticket %s: %s", doc.get("_id"), sms_error)
        wa_ok, wa_error = send_whatsapp(doc.get("reporterPhone"), message)
        if not wa_ok:
            LOGGER.warning("WhatsApp notification failed for ticket %s: %s", doc.get("_id"), wa_error)
    if doc.get("reporterEmail"):
        try:
            send_ticket_update_email(
                doc.get("reporterEmail"),
                doc.get("title", "Ticket"),
                doc.get("status", "updated"),
            )
        except Exception as exc:
            LOGGER.warning("Email notification failed for ticket %s: %s", doc.get("_id"), exc)

@router.get("/stats")
def get_stats(current_user: dict = Depends(get_official_user)):
    total = tickets.count_documents({})
    open_t = tickets.count_documents({"status": "open"})
    in_prog = tickets.count_documents({"status": "in_progress"})
    resolved = tickets.count_documents({"status": "resolved"})
    since = (datetime.utcnow() - timedelta(days=1)).isoformat()
    resolved_today = tickets.count_documents({"status": "resolved", "updatedAt": {"$gte": since}})
    resolution_rate = round((resolved / total) * 100, 2) if total > 0 else 0
    avg_response = "N/A"
    return {
        "success": True,
        "data": {
            "totalTickets": total,
            "openTickets": open_t,
            "inProgress": in_prog,
            "resolvedToday": resolved_today,
            "avgResponseTime": avg_response,
            "resolutionRate": resolution_rate
        }
    }

@router.get("")
def get_tickets(status: str | None = None, priority: str | None = None, category: str | None = None, current_user: dict = Depends(get_official_user)):
    query = {}
    if status:
        query["status"] = status
    if priority:
        query["priority"] = priority
    if category:
        query["category"] = category
    data = list(tickets.find(query).sort("createdAt", -1))
    return {"success": True, "data": serialize_list(data)}

@router.get("/{ticket_id}")
def get_ticket(ticket_id: str, current_user: dict = Depends(get_official_user)):
    doc = _get_ticket_doc(ticket_id)
    return {"success": True, "data": serialize_doc(doc)}

@router.patch("/{ticket_id}/status")
def update_status(ticket_id: str, payload: TicketUpdateStatus, current_user: dict = Depends(get_official_user)):
    _ = _get_ticket_doc(ticket_id)
    update = {"status": payload.status, "updatedAt": _now_iso()}
    op = {"$set": update}
    if payload.notes:
        op["$push"] = {"notes": {"note": payload.notes, "createdAt": _now_iso(), "by": current_user.get("id")}}
    obj_id = to_object_id(ticket_id)
    tickets.update_one({"_id": obj_id}, op)
    doc = tickets.find_one({"_id": obj_id})
    if doc:
        _notify_ticket_update(doc)
    return {"success": True, "data": serialize_doc(doc)}

@router.post("/{ticket_id}/assign")
def assign_ticket(ticket_id: str, payload: TicketAssign, current_user: dict = Depends(get_official_user)):
    _ = _get_ticket_doc(ticket_id)
    update = {"assignedTo": payload.assignedTo, "updatedAt": _now_iso()}
    op = {"$set": update}
    if payload.notes:
        op["$push"] = {"notes": {"note": payload.notes, "createdAt": _now_iso(), "by": current_user.get("id")}}
    obj_id = to_object_id(ticket_id)
    tickets.update_one({"_id": obj_id}, op)
    doc = tickets.find_one({"_id": obj_id})
    if doc:
        _notify_ticket_update(doc)
    return {"success": True, "data": serialize_doc(doc)}
