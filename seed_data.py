from __future__ import annotations

import argparse
import os
import re
import secrets
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from random import Random
from typing import Any

from pymongo import MongoClient, UpdateOne

sys.path.insert(0, str(Path(__file__).parent / "Backend"))

from app.auth import hash_password  # noqa: E402
from app.config.settings import settings  # noqa: E402
from app.database import init_db  # noqa: E402

SEED_TAG = "safelive-seed-v2"
DEFAULT_EMAIL_DOMAIN = "seed.safelive.local"
DEFAULT_COUNTRY_CODE = "+91"
MIN_INCIDENT_COUNT = 1
MAX_INCIDENT_COUNT = 250


OFFICIAL_NAME_POOL = [
    "Aarav Mehta",
    "Isha Verma",
    "Neel Sharma",
    "Ritika Rao",
    "Kabir Das",
    "Sana Khan",
    "Rohan Patil",
    "Priya Nair",
]

CITIZEN_NAME_POOL = [
    "Aditya Kulkarni",
    "Nisha Singh",
    "Rahul Jain",
    "Meera Gupta",
    "Arjun Sethi",
    "Kavya Iyer",
    "Vikram Joshi",
    "Pooja Bansal",
    "Yash Malhotra",
    "Sneha Reddy",
    "Harsh Vyas",
    "Ananya Kapoor",
]

INCIDENT_TEMPLATES = [
    {
        "title": "Pothole causing lane slowdown",
        "description": "Deep pothole observed during rush hour; drivers swerving abruptly.",
        "category": "infrastructure",
        "priority": "high",
        "status": "in_progress",
        "location": "North Ring Road",
        "latitude": 20.6093,
        "longitude": 78.9782,
    },
    {
        "title": "Garbage bins overflowing near market",
        "description": "Uncleared waste near food stalls with strong odor and stray animals.",
        "category": "sanitation",
        "priority": "high",
        "status": "open",
        "location": "Lakshmi Market Junction",
        "latitude": 20.5961,
        "longitude": 78.9729,
    },
    {
        "title": "Street light outage on service road",
        "description": "Street segment remains dark after sunset, creating pedestrian safety risk.",
        "category": "utilities",
        "priority": "medium",
        "status": "open",
        "location": "Civil Lines Service Road",
        "latitude": 20.5912,
        "longitude": 78.9556,
    },
    {
        "title": "Water pipeline leakage near school",
        "description": "Continuous leakage reducing pressure in nearby homes and wasting water.",
        "category": "utilities",
        "priority": "high",
        "status": "resolved",
        "location": "Green Park School Gate",
        "latitude": 20.5869,
        "longitude": 78.9664,
    },
    {
        "title": "Illegal debris dump on footpath",
        "description": "Construction debris blocks pedestrian movement and wheelchair access.",
        "category": "public_amenity",
        "priority": "medium",
        "status": "open",
        "location": "Ward 14 Community Center",
        "latitude": 20.5798,
        "longitude": 78.9487,
    },
    {
        "title": "Traffic signal timing malfunction",
        "description": "Signal cycle skips green phase for one lane, causing prolonged congestion.",
        "category": "traffic",
        "priority": "critical",
        "status": "in_progress",
        "location": "Old City Circle",
        "latitude": 20.6154,
        "longitude": 78.9639,
    },
    {
        "title": "Open manhole without barricade",
        "description": "Cover missing and no warning signs in a high-footfall area.",
        "category": "safety",
        "priority": "critical",
        "status": "open",
        "location": "Station Access Road",
        "latitude": 20.6018,
        "longitude": 78.9861,
    },
    {
        "title": "Damaged public park seating",
        "description": "Broken bench with exposed edges posing injury risk to children.",
        "category": "public_amenity",
        "priority": "low",
        "status": "resolved",
        "location": "Lakeview Public Park",
        "latitude": 20.5735,
        "longitude": 78.9601,
    },
    {
        "title": "Sewage overflow near bus stop",
        "description": "Drain backflow spreading wastewater on road shoulder and footpath.",
        "category": "sanitation",
        "priority": "high",
        "status": "in_progress",
        "location": "Central Bus Depot",
        "latitude": 20.6067,
        "longitude": 78.9475,
    },
    {
        "title": "Unauthorized roadside parking",
        "description": "Vehicles occupying no-parking zone and blocking emergency lane access.",
        "category": "traffic",
        "priority": "medium",
        "status": "resolved",
        "location": "City Hospital Approach Road",
        "latitude": 20.5894,
        "longitude": 78.9826,
    },
    {
        "title": "Loose electric junction cover",
        "description": "Exposed wiring compartment reported after maintenance work.",
        "category": "safety",
        "priority": "critical",
        "status": "in_progress",
        "location": "Industrial Layout Block C",
        "latitude": 20.6126,
        "longitude": 78.9398,
    },
    {
        "title": "Blocked stormwater drain",
        "description": "Silt accumulation causing waterlogging after moderate rainfall.",
        "category": "infrastructure",
        "priority": "medium",
        "status": "open",
        "location": "South Avenue Flyover Exit",
        "latitude": 20.5652,
        "longitude": 78.9714,
    },
]


@dataclass(frozen=True)
class UserRef:
    user_id: str
    name: str
    email: str | None
    phone: str | None
    user_type: str


@dataclass(frozen=True)
class SeedConfig:
    incident_count: int = 24
    official_count: int = 2
    citizen_count: int = 8
    seed_users: bool = True
    reset_incidents: bool = False
    truncate_incidents: bool = False
    reset_users: bool = False
    random_seed: int | None = None
    init_indexes: bool = False
    email_domain: str = DEFAULT_EMAIL_DOMAIN
    country_code: str = DEFAULT_COUNTRY_CODE
    official_password: str | None = None
    citizen_password: str | None = None


@dataclass(frozen=True)
class SeedResult:
    seeded_users: int
    seeded_incidents: int
    seeded_tickets: int
    total_users: int
    total_incidents: int
    total_tickets: int
    generated_official_password: str | None
    generated_citizen_password: str | None


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _iso_utc(value: datetime) -> str:
    return value.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _slugify(value: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "-", value.lower())
    return cleaned.strip("-")


def _validate_counts(config: SeedConfig) -> None:
    if config.incident_count < MIN_INCIDENT_COUNT or config.incident_count > MAX_INCIDENT_COUNT:
        raise ValueError(f"incident_count must be between {MIN_INCIDENT_COUNT} and {MAX_INCIDENT_COUNT}")
    if config.seed_users and config.official_count < 1:
        raise ValueError("official_count must be >= 1 when user seeding is enabled")
    if config.seed_users and config.citizen_count < 1:
        raise ValueError("citizen_count must be >= 1 when user seeding is enabled")


def _resolve_password(explicit: str | None, env_key: str) -> tuple[str, str | None]:
    if explicit:
        return explicit, None
    env_value = (os.environ.get(env_key) or "").strip()
    if env_value:
        return env_value, None
    generated = secrets.token_urlsafe(12)
    return generated, generated


def _as_user_ref(raw: dict[str, Any]) -> UserRef:
    return UserRef(
        user_id=str(raw.get("_id")),
        name=raw.get("name") or "Unknown User",
        email=raw.get("email"),
        phone=raw.get("phone"),
        user_type=raw.get("userType") or "citizen",
    )


def _build_user_blueprints(
    rng: Random,
    official_count: int,
    citizen_count: int,
    country_code: str,
    email_domain: str,
    official_password_hash: str,
    citizen_password_hash: str,
) -> list[dict[str, Any]]:
    users: list[dict[str, Any]] = []
    now = _iso_utc(_utc_now())

    for index in range(official_count):
        name = OFFICIAL_NAME_POOL[index % len(OFFICIAL_NAME_POOL)]
        slug = _slugify(name)
        phone_number = f"{country_code} {7000000000 + index:010d}"
        users.append(
            {
                "name": name,
                "email": f"{slug}.official{index + 1}@{email_domain}",
                "phone": phone_number,
                "userType": "official",
                "department": rng.choice(
                    ["Sanitation", "Road", "Electricity", "Water", "Police"]
                ),
                "password": official_password_hash,
                "seedTag": SEED_TAG,
                "updatedAt": now,
            }
        )

    for index in range(citizen_count):
        name = CITIZEN_NAME_POOL[index % len(CITIZEN_NAME_POOL)]
        slug = _slugify(name)
        phone_number = f"{country_code} {8000000000 + index:010d}"
        users.append(
            {
                "name": name,
                "email": f"{slug}.citizen{index + 1}@{email_domain}",
                "phone": phone_number,
                "userType": "citizen",
                "password": citizen_password_hash,
                "seedTag": SEED_TAG,
                "updatedAt": now,
            }
        )

    return users


def _upsert_seed_users(
    users_collection,
    rng: Random,
    official_count: int,
    citizen_count: int,
    country_code: str,
    email_domain: str,
    official_password: str,
    citizen_password: str,
) -> tuple[list[UserRef], list[UserRef], int]:
    official_password_hash = hash_password(official_password)
    citizen_password_hash = hash_password(citizen_password)

    blueprints = _build_user_blueprints(
        rng=rng,
        official_count=official_count,
        citizen_count=citizen_count,
        country_code=country_code,
        email_domain=email_domain,
        official_password_hash=official_password_hash,
        citizen_password_hash=citizen_password_hash,
    )

    operations: list[UpdateOne] = []
    for user in blueprints:
        doc = dict(user)
        created_at = doc["updatedAt"]
        operations.append(
            UpdateOne(
                {"email": doc["email"]},
                {"$set": doc, "$setOnInsert": {"createdAt": created_at}},
                upsert=True,
            )
        )

    if operations:
        users_collection.bulk_write(operations, ordered=False)

    seeded_docs = list(users_collection.find({"seedTag": SEED_TAG}))
    officials = [_as_user_ref(doc) for doc in seeded_docs if doc.get("userType") == "official"]
    citizens = [_as_user_ref(doc) for doc in seeded_docs if doc.get("userType") == "citizen"]
    return officials, citizens, len(blueprints)


def _fetch_existing_user_pool(users_collection) -> tuple[list[UserRef], list[UserRef]]:
    user_docs = list(users_collection.find({}))
    officials = [_as_user_ref(doc) for doc in user_docs if doc.get("userType") == "official"]
    citizens = [_as_user_ref(doc) for doc in user_docs if doc.get("userType") == "citizen"]
    if not citizens:
        citizens = [_as_user_ref(doc) for doc in user_docs]
    return officials, citizens


def _build_incident_docs(
    incident_count: int,
    rng: Random,
    citizens: list[UserRef],
    officials: list[UserRef],
) -> list[dict[str, Any]]:
    if not citizens:
        raise RuntimeError("No citizen users available to attach reporter metadata.")

    now = _utc_now()
    docs: list[dict[str, Any]] = []

    for index in range(incident_count):
        template = INCIDENT_TEMPLATES[index % len(INCIDENT_TEMPLATES)]
        reporter = citizens[index % len(citizens)]

        created_at = now - timedelta(hours=rng.randint(2, 24 * 21))
        status = template["status"]
        if status == "resolved":
            updated_at = min(now, created_at + timedelta(hours=rng.randint(3, 96)))
        elif status == "in_progress":
            updated_at = min(now, created_at + timedelta(hours=rng.randint(1, 36)))
        else:
            updated_at = created_at

        assigned_to: str | None = None
        if officials and status in {"in_progress", "resolved"}:
            assigned_to = officials[index % len(officials)].user_id
        elif officials and rng.random() < 0.15:
            assigned_to = rng.choice(officials).user_id

        doc = {
            "seedTag": SEED_TAG,
            "seedKey": f"{SEED_TAG}:incident:{index + 1:03d}",
            "title": template["title"],
            "description": template["description"],
            "category": template["category"],
            "priority": template["priority"],
            "status": status,
            "location": template["location"],
            "latitude": template["latitude"] + rng.uniform(-0.005, 0.005),
            "longitude": template["longitude"] + rng.uniform(-0.005, 0.005),
            "reporterId": reporter.user_id,
            "reportedBy": reporter.name,
            "reporterEmail": reporter.email,
            "reporterPhone": reporter.phone,
            "assignedTo": assigned_to,
            "imageUrls": [],
            "createdAt": _iso_utc(created_at),
            "updatedAt": _iso_utc(updated_at),
            "hasMessages": False,
            "source": "seed",
        }
        docs.append(doc)

    return docs


def _upsert_incidents_and_tickets(
    incidents_collection,
    tickets_collection,
    incident_docs: list[dict[str, Any]],
) -> tuple[int, int]:
    if not incident_docs:
        return 0, 0

    incident_ops = [
        UpdateOne({"seedKey": doc["seedKey"]}, {"$set": doc}, upsert=True) for doc in incident_docs
    ]
    incidents_collection.bulk_write(incident_ops, ordered=False)

    seeded_incidents = list(incidents_collection.find({"seedTag": SEED_TAG}))
    ticket_ops: list[UpdateOne] = []
    for incident in seeded_incidents:
        incident_id = str(incident["_id"])
        ticket_doc = {
            "seedTag": SEED_TAG,
            "seedKey": f"{incident['seedKey']}:ticket",
            "incidentId": incident_id,
            "title": incident.get("title"),
            "description": incident.get("description"),
            "category": incident.get("category"),
            "priority": incident.get("priority") or "medium",
            "status": incident.get("status") if incident.get("status") != "verified" else "resolved",
            "location": incident.get("location"),
            "latitude": incident.get("latitude"),
            "longitude": incident.get("longitude"),
            "reportedBy": incident.get("reportedBy"),
            "reporterEmail": incident.get("reporterEmail"),
            "reporterPhone": incident.get("reporterPhone"),
            "assignedTo": incident.get("assignedTo"),
            "createdAt": incident.get("createdAt"),
            "updatedAt": incident.get("updatedAt"),
        }
        ticket_ops.append(
            UpdateOne({"seedKey": ticket_doc["seedKey"]}, {"$set": ticket_doc}, upsert=True)
        )

    if ticket_ops:
        tickets_collection.bulk_write(ticket_ops, ordered=False)

    ticket_map = {
        ticket.get("incidentId"): str(ticket["_id"])
        for ticket in tickets_collection.find({"seedTag": SEED_TAG}, {"incidentId": 1})
    }
    incident_ticket_updates = []
    for incident in seeded_incidents:
        incident_id = str(incident["_id"])
        ticket_id = ticket_map.get(incident_id)
        if ticket_id:
            incident_ticket_updates.append(
                UpdateOne({"_id": incident["_id"]}, {"$set": {"ticketId": ticket_id}})
            )
    if incident_ticket_updates:
        incidents_collection.bulk_write(incident_ticket_updates, ordered=False)

    return len(seeded_incidents), len(ticket_map)


def seed_database(config: SeedConfig) -> SeedResult:
    _validate_counts(config)
    rng = Random(config.random_seed if config.random_seed is not None else secrets.randbelow(2**31))

    official_password = ""
    citizen_password = ""
    generated_official_password: str | None = None
    generated_citizen_password: str | None = None
    if config.seed_users:
        official_password, generated_official_password = _resolve_password(
            config.official_password, "SEED_OFFICIAL_PASSWORD"
        )
        citizen_password, generated_citizen_password = _resolve_password(
            config.citizen_password, "SEED_CITIZEN_PASSWORD"
        )

    client = MongoClient(settings.MONGO_URL, serverSelectionTimeoutMS=5000)
    try:
        client.admin.command("ping")
        db = client[settings.DB_NAME]
        users_collection = db["users"]
        incidents_collection = db["incidents"]
        tickets_collection = db["tickets"]

        if config.init_indexes:
            init_db()

        if config.truncate_incidents:
            incidents_collection.delete_many({})
            tickets_collection.delete_many({})
        elif config.reset_incidents:
            incidents_collection.delete_many({"seedTag": SEED_TAG})
            tickets_collection.delete_many({"seedTag": SEED_TAG})

        if config.reset_users:
            users_collection.delete_many({"seedTag": SEED_TAG})

        seeded_user_count = 0
        if config.seed_users:
            officials, citizens, seeded_user_count = _upsert_seed_users(
                users_collection=users_collection,
                rng=rng,
                official_count=config.official_count,
                citizen_count=config.citizen_count,
                country_code=config.country_code,
                email_domain=config.email_domain,
                official_password=official_password,
                citizen_password=citizen_password,
            )
        else:
            officials, citizens = _fetch_existing_user_pool(users_collection)

        if not citizens:
            raise RuntimeError(
                "No citizens available for incident ownership. "
                "Create at least one citizen account or run with default user seeding."
            )

        incident_docs = _build_incident_docs(
            incident_count=config.incident_count,
            rng=rng,
            citizens=citizens,
            officials=officials,
        )
        seeded_incidents, seeded_tickets = _upsert_incidents_and_tickets(
            incidents_collection=incidents_collection,
            tickets_collection=tickets_collection,
            incident_docs=incident_docs,
        )

        return SeedResult(
            seeded_users=seeded_user_count,
            seeded_incidents=seeded_incidents,
            seeded_tickets=seeded_tickets,
            total_users=users_collection.count_documents({}),
            total_incidents=incidents_collection.count_documents({}),
            total_tickets=tickets_collection.count_documents({}),
            generated_official_password=generated_official_password,
            generated_citizen_password=generated_citizen_password,
        )
    finally:
        client.close()


def _print_summary(result: SeedResult) -> None:
    print("Seeding completed.")
    print(f"  Seeded users: {result.seeded_users}")
    print(f"  Seeded incidents: {result.seeded_incidents}")
    print(f"  Seeded tickets: {result.seeded_tickets}")
    print("")
    print("Database totals:")
    print(f"  Users: {result.total_users}")
    print(f"  Incidents: {result.total_incidents}")
    print(f"  Tickets: {result.total_tickets}")
    if result.generated_official_password:
        print("")
        print("Generated official password (set SEED_OFFICIAL_PASSWORD to override):")
        print(f"  {result.generated_official_password}")
    if result.generated_citizen_password:
        print("")
        print("Generated citizen password (set SEED_CITIZEN_PASSWORD to override):")
        print(f"  {result.generated_citizen_password}")


def _parse_args() -> SeedConfig:
    parser = argparse.ArgumentParser(description="Seed SafeLive MongoDB data")
    parser.add_argument("--incidents", type=int, default=24, help="Number of incidents to seed")
    parser.add_argument("--officials", type=int, default=2, help="Number of official users to seed")
    parser.add_argument("--citizens", type=int, default=8, help="Number of citizen users to seed")
    parser.add_argument(
        "--no-seed-users",
        action="store_true",
        help="Reuse existing users instead of creating/updating seed users",
    )
    parser.add_argument(
        "--reset-incidents",
        action="store_true",
        help="Delete previously seeded incidents/tickets before seeding",
    )
    parser.add_argument(
        "--truncate-incidents",
        action="store_true",
        help="Delete ALL incidents/tickets before seeding",
    )
    parser.add_argument(
        "--reset-users",
        action="store_true",
        help="Delete previously seeded users before user upsert",
    )
    parser.add_argument("--seed", type=int, default=None, help="Random seed for deterministic output")
    parser.add_argument(
        "--init-indexes",
        action="store_true",
        help="Run backend index initialization before seeding",
    )
    parser.add_argument(
        "--email-domain",
        default=DEFAULT_EMAIL_DOMAIN,
        help="Domain used for generated seed emails",
    )
    parser.add_argument(
        "--country-code",
        default=DEFAULT_COUNTRY_CODE,
        help="Country code prefix for generated phone numbers",
    )
    parser.add_argument(
        "--official-password",
        default=None,
        help="Password for all generated officials (or set SEED_OFFICIAL_PASSWORD)",
    )
    parser.add_argument(
        "--citizen-password",
        default=None,
        help="Password for all generated citizens (or set SEED_CITIZEN_PASSWORD)",
    )
    args = parser.parse_args()

    return SeedConfig(
        incident_count=args.incidents,
        official_count=args.officials,
        citizen_count=args.citizens,
        seed_users=not args.no_seed_users,
        reset_incidents=args.reset_incidents,
        truncate_incidents=args.truncate_incidents,
        reset_users=args.reset_users,
        random_seed=args.seed,
        init_indexes=args.init_indexes,
        email_domain=args.email_domain,
        country_code=args.country_code,
        official_password=args.official_password,
        citizen_password=args.citizen_password,
    )


def main() -> None:
    config = _parse_args()
    result = seed_database(config)
    _print_summary(result)


if __name__ == "__main__":
    main()
