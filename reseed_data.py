from __future__ import annotations

import argparse

from seed_data import DEFAULT_COUNTRY_CODE, DEFAULT_EMAIL_DOMAIN, SeedConfig, seed_database


def _parse_args() -> SeedConfig:
    parser = argparse.ArgumentParser(description="Reseed SafeLive incidents/tickets")
    parser.add_argument("--incidents", type=int, default=24, help="Number of incidents to reseed")
    parser.add_argument(
        "--seed-users",
        action="store_true",
        help="Also seed users (default behavior is to reuse existing users)",
    )
    parser.add_argument(
        "--officials",
        type=int,
        default=2,
        help="Official user count when --seed-users is enabled",
    )
    parser.add_argument(
        "--citizens",
        type=int,
        default=8,
        help="Citizen user count when --seed-users is enabled",
    )
    parser.add_argument(
        "--truncate-incidents",
        action="store_true",
        help="Delete ALL incidents/tickets before reseeding",
    )
    parser.add_argument(
        "--reset-users",
        action="store_true",
        help="Delete previously seeded users before user seeding",
    )
    parser.add_argument("--seed", type=int, default=None, help="Random seed for deterministic output")
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
        help="Password for generated officials (or set SEED_OFFICIAL_PASSWORD)",
    )
    parser.add_argument(
        "--citizen-password",
        default=None,
        help="Password for generated citizens (or set SEED_CITIZEN_PASSWORD)",
    )
    args = parser.parse_args()

    return SeedConfig(
        incident_count=args.incidents,
        official_count=args.officials,
        citizen_count=args.citizens,
        seed_users=args.seed_users,
        reset_incidents=not args.truncate_incidents,
        truncate_incidents=args.truncate_incidents,
        reset_users=args.reset_users,
        random_seed=args.seed,
        email_domain=args.email_domain,
        country_code=args.country_code,
        official_password=args.official_password,
        citizen_password=args.citizen_password,
    )


def main() -> None:
    config = _parse_args()
    result = seed_database(config)
    print("Reseed completed.")
    print(f"  Incidents seeded: {result.seeded_incidents}")
    print(f"  Tickets seeded: {result.seeded_tickets}")
    print(f"  Total incidents: {result.total_incidents}")
    print(f"  Total tickets: {result.total_tickets}")
    if result.seeded_users:
        print(f"  Users seeded: {result.seeded_users}")
    if result.generated_official_password:
        print(f"  Generated official password: {result.generated_official_password}")
    if result.generated_citizen_password:
        print(f"  Generated citizen password: {result.generated_citizen_password}")


if __name__ == "__main__":
    main()
