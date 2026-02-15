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
issues_collection = incidents

atexit.register(client.close)

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
