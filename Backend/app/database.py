import atexit
from pymongo import MongoClient
from app.config.settings import settings

client = MongoClient(settings.MONGO_URL)
db = client[settings.DB_NAME]

users = db["users"]
incidents = db["incidents"]
tickets = db["tickets"]
messages = db["messages"]
password_resets = db["password_resets"]
otp_challenges = db["otp_challenges"]
incident_logs = db["incident_logs"]
issues_collection = incidents

atexit.register(client.close)

def cleanup_orphan_tickets():
    incident_id_set: set[str] = set()
    for row in incidents.find({}, {"_id": 1}):
        raw_id = row.get("_id")
        if raw_id is None:
            continue
        incident_id_set.add(str(raw_id))

    orphan_ticket_ids = []
    for row in tickets.find({}, {"_id": 1, "incidentId": 1}):
        ticket_id = row.get("_id")
        incident_id = str(row.get("incidentId") or "").strip()
        if not ticket_id:
            continue
        if not incident_id or incident_id not in incident_id_set:
            orphan_ticket_ids.append(ticket_id)

    if orphan_ticket_ids:
        tickets.delete_many({"_id": {"$in": orphan_ticket_ids}})


def init_db():
    from pymongo.errors import OperationFailure
    
    try:
        users.create_index("email", unique=True, sparse=True)
    except OperationFailure:
        pass
    
    try:
        users.create_index("phone", unique=True, sparse=True)
    except OperationFailure:
        pass
    
    try:
        users.create_index("userType")
        users.create_index("officialRole")
        users.create_index([("userType", 1), ("officialRole", 1)])
    except OperationFailure:
        pass
    
    try:
        incidents.create_index("status")
        incidents.create_index("createdAt")
        incidents.create_index("updatedAt")
        incidents.create_index("category")
        incidents.create_index("priority")
        incidents.create_index("severity")
        incidents.create_index("location")
        incidents.create_index("reporterId")
        incidents.create_index("source")
        incidents.create_index("deviceId")
        incidents.create_index([("deviceId", 1), ("eventId", 1)])
    except OperationFailure:
        pass
    
    try:
        tickets.create_index("status")
        tickets.create_index("priority")
        tickets.create_index("createdAt")
        tickets.create_index("updatedAt")
        tickets.create_index("assignedTo")
        tickets.create_index("incidentId")
    except OperationFailure:
        pass
    
    try:
        messages.create_index("incidentId")
        messages.create_index("createdAt")
    except OperationFailure:
        pass
    
    try:
        password_resets.create_index("token", unique=True)
        password_resets.create_index("expiresAt", expireAfterSeconds=0)
    except OperationFailure:
        pass

    try:
        otp_challenges.create_index("expiresAt", expireAfterSeconds=0)
        otp_challenges.create_index([("userId", 1), ("purpose", 1), ("used", 1)])
    except OperationFailure:
        pass

    try:
        incident_logs.create_index("ticketId")
        incident_logs.create_index("incidentId")
        incident_logs.create_index("createdAt")
    except OperationFailure:
        pass

    cleanup_orphan_tickets()
