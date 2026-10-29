"""Seed the database with sample data.

Development (default): deletes all rows from every table and loads sample
users, teams, races, registrations, payments, email logs and visits.
Production (FLASK_CONFIG=...ProductionConfig): recreates the schema and creates
only one admin user.

Run from the repo root after `flask db upgrade`:

    python seed.py

All seeded users have the password "password".
"""
from datetime import timedelta
import os

from app import db, create_app
from app.models import (
    User,
    Team,
    Race,
    RaceTranslation,
    Checkpoint,
    CheckpointTranslation,
    Task,
    TaskTranslation,
    RaceCategory,
    RaceCategoryTranslation,
    Registration,
    RegistrationPaymentAttempt,
    RegistrationEmailLog,
    CheckpointLog,
    TaskLog,
)
from app.utils import calculate_distance, utc_now

PASSWORD = "password"


def clean_db():
    """Delete all rows, children first, keeping the schema and migration state."""
    for table in reversed(db.metadata.sorted_tables):
        db.session.execute(table.delete())
    db.session.commit()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def add_translations(model, parent_field, parent, translations):
    """Add translation rows, e.g. {"cs": {"title": ..., "description": ...}}."""
    for language, fields in translations.items():
        db.session.add(model(**{parent_field: parent.id, "language": language, **fields}))


def add_checkpoints(race, items):
    """items: (title, description, lat, lon, points, {lang: (title, description)})."""
    checkpoints = []
    for title, description, latitude, longitude, points, translations in items:
        checkpoint = Checkpoint(
            race_id=race.id,
            title=title,
            description=description,
            latitude=latitude,
            longitude=longitude,
            numOfPoints=points,
        )
        db.session.add(checkpoint)
        db.session.flush()
        add_translations(CheckpointTranslation, "checkpoint_id", checkpoint, {
            lang: {"title": t, "description": d} for lang, (t, d) in translations.items()
        })
        checkpoints.append(checkpoint)
    return checkpoints


def add_tasks(race, items):
    """items: (title, description, points, {lang: (title, description)})."""
    tasks = []
    for title, description, points, translations in items:
        task = Task(race_id=race.id, title=title, description=description, numOfPoints=points)
        db.session.add(task)
        db.session.flush()
        add_translations(TaskTranslation, "task_id", task, {
            lang: {"title": t, "description": d} for lang, (t, d) in translations.items()
        })
        tasks.append(task)
    return tasks


def register(race, team, category, *, paid=True, disqualified=False, email_sent=None, confirmed_at=None):
    registration = Registration(
        race_id=race.id,
        team_id=team.id,
        race_category_id=category.id,
        disqualified=disqualified,
        payment_confirmed=paid,
        payment_confirmed_at=confirmed_at if paid else None,
        email_sent=paid if email_sent is None else email_sent,
    )
    db.session.add(registration)
    db.session.flush()
    return registration


def add_payment(registration, race, payment_type, status, created_at, session_id):
    amount = {
        "team": race.registration_team_amount_cents,
        "driver": race.registration_driver_amount_cents,
        "codriver": race.registration_codriver_amount_cents,
    }[payment_type]
    attempt = RegistrationPaymentAttempt(
        registration_id=registration.id,
        stripe_session_id=session_id,
        payment_type=payment_type,
        status=status,
        amount_cents=amount,
        currency=race.registration_currency,
        created_at=created_at,
        confirmed_at=created_at + timedelta(minutes=2) if status == "confirmed" else None,
    )
    db.session.add(attempt)
    if status == "confirmed" and payment_type in ("team", "driver"):
        registration.stripe_session_id = session_id
        registration.payment_confirmed_at = attempt.confirmed_at
    return attempt


def add_email_log(registration, user, status, sent_at, error_message=None):
    db.session.add(RegistrationEmailLog(
        registration_id=registration.id,
        user_id=user.id,
        email_address=user.email,
        template_type="registration_confirmation",
        provider="smtp",
        status=status,
        error_message=error_message,
        attempt_count=1,
        first_attempted_at=sent_at,
        last_attempted_at=sent_at,
        delivered_at=sent_at if status in ("delivered", "opened") else None,
        opened_at=sent_at + timedelta(hours=3) if status == "opened" else None,
        bounced_at=sent_at if status == "bounced" else None,
        created_at=sent_at,
        updated_at=sent_at,
    ))


def add_visits(race, team, visits, tasks_done=()):
    """visits: [(checkpoint, visited_at)] - GPS is placed ~20-60 m from the checkpoint."""
    for index, (checkpoint, visited_at) in enumerate(visits):
        offset = 0.0002 + 0.0001 * (index % 4)
        user_latitude = checkpoint.latitude + offset
        user_longitude = checkpoint.longitude - offset
        db.session.add(CheckpointLog(
            checkpoint_id=checkpoint.id,
            team_id=team.id,
            race_id=race.id,
            user_latitude=user_latitude,
            user_longitude=user_longitude,
            user_distance_km=round(calculate_distance(
                checkpoint.latitude, checkpoint.longitude, user_latitude, user_longitude), 4),
            created_at=visited_at,
        ))
    for task, completed_at in tasks_done:
        db.session.add(TaskLog(task_id=task.id, team_id=team.id, race_id=race.id, created_at=completed_at))


# ---------------------------------------------------------------------------
# Sample data
# ---------------------------------------------------------------------------

def seed_users_and_teams():
    def user(name, email, language, admin=False):
        u = User(name=name, email=email, preferred_language=language, is_administrator=admin)
        u.set_password(PASSWORD)
        db.session.add(u)
        return u

    users = {
        "admin": user("Admin User", "admin@example.com", "en", admin=True),
        "alice": user("Alice Thompson", "alice@example.com", "en"),
        "bob": user("Bob Novák", "bob@example.com", "cs"),
        "charlie": user("Charlie Müller", "charlie@example.com", "de"),
        "diana": user("Diana Smith", "diana@example.com", "en"),
        "eva": user("Eva Svobodová", "eva@example.com", "cs"),
        "filip": user("Filip Dvořák", "filip@example.com", "cs"),
        "greta": user("Greta Schmidt", "greta@example.com", "de"),
        "hana": user("Hana Králová", "hana@example.com", "cs"),
        "ivan": user("Ivan Horák", "ivan@example.com", "cs"),
        "jana": user("Jana Veselá", "jana@example.com", "cs"),
    }

    def team(name, *members):
        t = Team(name=name)
        t.members.extend(users[m] for m in members)
        db.session.add(t)
        return t

    teams = {
        "explorers": team("Explorer Team", "alice", "bob"),
        "nature": team("Nature Lovers", "charlie", "greta"),
        "city": team("City Adventurers", "diana", "eva"),
        "rychle_sipy": team("Rychlé šípy", "filip", "hana"),
        "zelvy": team("Želvy", "ivan", "jana"),
        # Individual registrations (driver + optional codriver).
        "solo_alice": team("Alice solo", "alice"),
        "duo_bob_eva": team("Bob & Eva", "bob", "eva"),
        "solo_ivan": team("Ivan solo", "ivan"),
    }
    db.session.flush()
    return users, teams


def seed_categories():
    def category(name, description, translations):
        c = RaceCategory(name=name, description=description)
        db.session.add(c)
        db.session.flush()
        add_translations(RaceCategoryTranslation, "race_category_id", c, {
            lang: {"name": n, "description": d} for lang, (n, d) in translations.items()
        })
        return c

    return {
        "cars": category("Cars", "For car enthusiasts", {
            "en": ("Cars", "For car enthusiasts"),
            "cs": ("Auta", "Pro milovníky aut"),
            "de": ("Autos", "Für Autoenthusiasten"),
        }),
        "bikes": category("Bikes", "For bike lovers", {
            "en": ("Bikes", "For bike lovers"),
            "cs": ("Kola", "Pro milovníky kol"),
            "de": ("Fahrräder", "Für Fahrradliebhaber"),
        }),
        "runners": category("Runners", "For running enthusiasts", {
            "en": ("Runners", "For running enthusiasts"),
            "cs": ("Běžci", "Pro milovníky běhu"),
            "de": ("Läufer", "Für Laufbegeisterte"),
        }),
    }


def seed_race_city_challenge(now, teams, categories):
    """Running race, Czech only, team registration with a flat fee, map markers."""
    race = Race(
        name="Výzva ve městě",
        description="Prozkoumejte Prahu a projděte kontrolní body a úkoly.",
        race_greeting="Těšíme se na vás na startu na Staroměstském náměstí!",
        supported_languages=["cs"],
        default_language="cs",
        start_showing_checkpoints_at=now - timedelta(days=1),
        end_showing_checkpoints_at=now + timedelta(days=7),
        start_logging_at=now - timedelta(hours=6),
        end_logging_at=now + timedelta(days=6),
        finish_description="Cíl: Kampa, u Sovových mlýnů",
        finish_latitude=50.0847,
        finish_longitude=14.4078,
        bivak_1_name="Bivak Letná",
        bivak_1_latitude=50.0960,
        bivak_1_longitude=14.4180,
        registration_slug="vyzva-ve-meste",
        registration_enabled=True,
        min_team_size=2,
        max_team_size=4,
        allow_team_registration=True,
        allow_individual_registration=False,
        registration_currency="czk",
        registration_pricing_strategy="team_flat",
        registration_team_amount_cents=50000,
        registration_individual_amount_cents=25000,
        registration_driver_amount_cents=25000,
        registration_codriver_amount_cents=15000,
    )
    race.categories.extend([categories["cars"], categories["bikes"]])
    db.session.add(race)
    db.session.flush()

    cps = add_checkpoints(race, [
        ("Staroměstská radnice", "Historická budova radnice s orlojem", 50.0870, 14.4208, 10, {}),
        ("Letenské sady", "Park s výhledem na Prahu", 50.0955, 14.4250, 8, {}),
        ("Národní muzeum", "Budova muzea na horní části Václavského náměstí", 50.0790, 14.4310, 12, {}),
        ("Hlavní nádraží", "Největší vlakové nádraží ve městě", 50.0831, 14.4353, 5, {}),
        ("Karlův most", "Historický most s krásným výhledem", 50.0865, 14.4114, 7, {}),
        ("Petřínská rozhledna", "Rozhledna na vrcholu Petřína", 50.0835, 14.3951, 15, {}),
    ])
    tasks = add_tasks(race, [
        ("Najděte místní kavárnu", "Najděte a navštivte kavárnu, která není součástí žádného řetězce.", 10, {}),
        ("Týmová fotka", "Vyfoťte celý tým s orlojem v pozadí.", 5, {}),
    ])

    start = race.start_logging_at
    regs = {
        "explorers": register(race, teams["explorers"], categories["cars"], confirmed_at=now - timedelta(days=10)),
        "rychle_sipy": register(race, teams["rychle_sipy"], categories["cars"], confirmed_at=now - timedelta(days=9)),
        "zelvy": register(race, teams["zelvy"], categories["bikes"], confirmed_at=now - timedelta(days=8)),
        "city": register(race, teams["city"], categories["bikes"], disqualified=True, confirmed_at=now - timedelta(days=7)),
    }
    for key, reg in regs.items():
        add_payment(reg, race, "team", "confirmed", reg.payment_confirmed_at - timedelta(minutes=2), f"cs_seed_city_{key}")

    def at(minutes):
        return start + timedelta(minutes=minutes)

    # Different routes so the admin "Team paths" map has something to show.
    add_visits(race, teams["explorers"],
               [(cps[0], at(20)), (cps[4], at(45)), (cps[5], at(80)), (cps[1], at(130))],
               [(tasks[0], at(60)), (tasks[1], at(22))])
    add_visits(race, teams["rychle_sipy"],
               [(cps[3], at(15)), (cps[2], at(35)), (cps[0], at(60)), (cps[4], at(85)), (cps[5], at(120))],
               [(tasks[1], at(62))])
    add_visits(race, teams["zelvy"], [(cps[1], at(40)), (cps[0], at(110))])
    add_visits(race, teams["city"], [(cps[4], at(30)), (cps[5], at(55))])
    return race


def seed_race_nature_expedition(now, teams, users, categories):
    """Running race, en/cs, individual registration with driver + codriver fees."""
    race = Race(
        name="Nature Expedition",
        description="Navigate through natural landmarks and complete challenges.",
        race_greeting="See you at the forest entrance!",
        supported_languages=["en", "cs"],
        default_language="en",
        start_showing_checkpoints_at=now - timedelta(hours=3),
        end_showing_checkpoints_at=now + timedelta(days=14),
        start_logging_at=now - timedelta(hours=2),
        end_logging_at=now + timedelta(days=14),
        finish_description="Finish: the old forester's lodge",
        finish_latitude=50.1550,
        finish_longitude=14.5950,
        bivak_1_name="River camp",
        bivak_1_latitude=50.1320,
        bivak_1_longitude=14.5740,
        bivak_2_name="Hilltop camp",
        bivak_2_latitude=50.1420,
        bivak_2_longitude=14.5830,
        registration_slug="nature-expedition",
        registration_enabled=True,
        min_team_size=1,
        max_team_size=2,
        allow_team_registration=False,
        allow_individual_registration=True,
        registration_currency="czk",
        registration_pricing_strategy="driver_codriver",
        registration_team_amount_cents=60000,
        registration_individual_amount_cents=30000,
        registration_driver_amount_cents=40000,
        registration_codriver_amount_cents=20000,
    )
    race.categories.extend([categories["bikes"], categories["runners"]])
    db.session.add(race)
    db.session.flush()
    add_translations(RaceTranslation, "race_id", race, {
        "cs": {
            "name": "Přírodní expedice",
            "description": "Navigujte přírodními skvosty a plňte výzvy.",
            "race_greeting": "Uvidíme se u vstupu do lesa!",
        },
    })

    cps = add_checkpoints(race, [
        ("Forest Entrance", "Entry point to the nature reserve", 50.1234, 14.5678, 5,
         {"cs": ("Vstup do lesa", "Vstupní bod do přírodní rezervace")}),
        ("River Crossing", "A scenic river crossing point", 50.1300, 14.5700, 10,
         {"cs": ("Přechod řeky", "Malebný přechod řeky")}),
        ("Mountain Peak", "The highest point in the area", 50.1400, 14.5800, 15,
         {"cs": ("Vrchol hory", "Nejvyšší bod v oblasti")}),
        ("Forest Clearing", "A peaceful clearing in the forest", 50.1500, 14.5900, 8,
         {"cs": ("Lesní mýtina", "Poklidná mýtina v lese")}),
    ])
    tasks = add_tasks(race, [
        ("Find the Local Cafe", "Find and visit a local cafe that is not part of any chain.", 10,
         {"cs": ("Najděte místní kavárnu", "Najděte a navštivte místní kavárnu, která není součástí žádného řetězce.")}),
        ("Collect Water Samples", "Collect water samples from the river for analysis.", 15,
         {"cs": ("Sbírejte vzorky vody", "Sbírejte vzorky vody z řeky k analýze.")}),
    ])

    paid_at = now - timedelta(days=5)
    # Driver and codriver both paid.
    duo = register(race, teams["duo_bob_eva"], categories["bikes"], confirmed_at=paid_at)
    add_payment(duo, race, "driver", "confirmed", paid_at - timedelta(minutes=2), "cs_seed_nature_duo_driver")
    add_payment(duo, race, "codriver", "confirmed", paid_at + timedelta(hours=1), "cs_seed_nature_duo_codriver")
    # Driver paid, codriver still pending - the team can race.
    solo = register(race, teams["solo_alice"], categories["runners"], confirmed_at=paid_at)
    add_payment(solo, race, "driver", "confirmed", paid_at - timedelta(minutes=2), "cs_seed_nature_alice_driver")
    add_payment(solo, race, "codriver", "pending", paid_at + timedelta(days=1), "cs_seed_nature_alice_codriver")
    # Failed then abandoned payment - not paid, so no access to the race.
    unpaid = register(race, teams["solo_ivan"], categories["runners"], paid=False)
    add_payment(unpaid, race, "driver", "failed", now - timedelta(days=2), "cs_seed_nature_ivan_failed")
    add_payment(unpaid, race, "driver", "pending", now - timedelta(days=1), "cs_seed_nature_ivan_pending")

    add_email_log(duo, users["bob"], "opened", paid_at)
    add_email_log(duo, users["eva"], "delivered", paid_at)
    add_email_log(solo, users["alice"], "failed", paid_at, error_message="SMTP connection refused")

    start = race.start_logging_at
    add_visits(race, teams["duo_bob_eva"],
               [(cps[0], start + timedelta(minutes=10)), (cps[1], start + timedelta(minutes=50))],
               [(tasks[1], start + timedelta(minutes=55))])
    add_visits(race, teams["solo_alice"], [(cps[0], start + timedelta(minutes=25))])
    return race


def seed_race_city_explorer(now, teams, users, categories):
    """Upcoming race, en/cs/de, registration open, checkpoints not shown yet."""
    race = Race(
        name="City Explorer",
        description="Discover hidden gems in the city and complete fun tasks.",
        race_greeting="Get ready to explore!",
        supported_languages=["en", "cs", "de"],
        default_language="en",
        start_showing_checkpoints_at=now + timedelta(days=3),
        end_showing_checkpoints_at=now + timedelta(days=10),
        start_logging_at=now + timedelta(days=3),
        end_logging_at=now + timedelta(days=10),
        finish_description="Finish: City Square fountain",
        finish_latitude=50.1200,
        finish_longitude=14.5500,
        registration_slug="city-explorer",
        registration_enabled=True,
        min_team_size=1,
        max_team_size=3,
        allow_team_registration=True,
        allow_individual_registration=False,
        registration_currency="eur",
        registration_pricing_strategy="team_flat",
        registration_team_amount_cents=2500,
        registration_individual_amount_cents=1500,
        registration_driver_amount_cents=1500,
        registration_codriver_amount_cents=1000,
    )
    race.categories.extend([categories["cars"], categories["runners"]])
    db.session.add(race)
    db.session.flush()
    add_translations(RaceTranslation, "race_id", race, {
        "cs": {
            "name": "Městský průzkumník",
            "description": "Objevujte skryté poklady ve městě a plňte zábavné úkoly.",
            "race_greeting": "Připravte se na průzkum!",
        },
        "de": {
            "name": "Stadterkunder",
            "description": "Entdecken Sie versteckte Schätze in der Stadt und erfüllen Sie lustige Aufgaben.",
            "race_greeting": "Machen Sie sich bereit für die Erkundung!",
        },
    })

    add_checkpoints(race, [
        ("City Square", "The central square of the city", 50.1200, 14.5500, 10, {
            "cs": ("Městské náměstí", "Centrální náměstí města"),
            "de": ("Stadtplatz", "Der zentrale Platz der Stadt"),
        }),
        ("Old Library", "A historic library with ancient books", 50.1250, 14.5550, 12, {
            "cs": ("Stará knihovna", "Historická knihovna se starými knihami"),
            "de": ("Alte Bibliothek", "Eine historische Bibliothek mit alten Büchern"),
        }),
        ("City Park", "A large park in the city center", 50.1300, 14.5600, 8, {
            "cs": ("Městský park", "Velký park v centru města"),
            "de": ("Stadtpark", "Ein großer Park im Stadtzentrum"),
        }),
    ])
    add_tasks(race, [
        ("Street Musician", "Record a short video with a street musician.", 8, {
            "cs": ("Pouliční muzikant", "Natočte krátké video s pouličním muzikantem."),
            "de": ("Straßenmusiker", "Nehmen Sie ein kurzes Video mit einem Straßenmusiker auf."),
        }),
    ])

    paid_at = now - timedelta(days=1)
    nature = register(race, teams["nature"], categories["cars"], confirmed_at=paid_at)
    add_payment(nature, race, "team", "confirmed", paid_at - timedelta(minutes=2), "cs_seed_explorer_nature")
    add_email_log(nature, users["charlie"], "delivered", paid_at)
    add_email_log(nature, users["greta"], "bounced", paid_at, error_message="Mailbox does not exist")
    # Registered but payment not finished yet.
    explorers = register(race, teams["explorers"], categories["runners"], paid=False)
    add_payment(explorers, race, "team", "pending", now - timedelta(hours=5), "cs_seed_explorer_explorers")
    return race


def seed_race_autumn_loop(now, teams, users, categories):
    """Finished race with full results - useful for standings, statistics and team paths."""
    race = Race(
        name="Podzimní okruh Posázavím",
        description="Jednodenní okruh údolím Sázavy.",
        race_greeting="Děkujeme za účast!",
        supported_languages=["cs", "en"],
        default_language="cs",
        start_showing_checkpoints_at=now - timedelta(days=14),
        end_showing_checkpoints_at=now - timedelta(days=12),
        start_logging_at=now - timedelta(days=14),
        end_logging_at=now - timedelta(days=13, hours=16),
        finish_description="Cíl: hrad Český Šternberk",
        finish_latitude=49.8098,
        finish_longitude=14.9277,
        bivak_1_name="Tábořiště u Sázavy",
        bivak_1_latitude=49.8620,
        bivak_1_longitude=14.9000,
        registration_slug="podzimni-okruh",
        registration_enabled=False,
        min_team_size=2,
        max_team_size=2,
        allow_team_registration=True,
        allow_individual_registration=False,
        registration_currency="czk",
        registration_pricing_strategy="team_flat",
        registration_team_amount_cents=40000,
        registration_individual_amount_cents=20000,
        registration_driver_amount_cents=20000,
        registration_codriver_amount_cents=10000,
    )
    race.categories.extend([categories["cars"], categories["bikes"]])
    db.session.add(race)
    db.session.flush()
    add_translations(RaceTranslation, "race_id", race, {
        "en": {
            "name": "Autumn Loop around the Sázava",
            "description": "One-day loop through the Sázava valley.",
            "race_greeting": "Thank you for taking part!",
        },
    })

    cps = add_checkpoints(race, [
        ("Sázavský klášter", "Klášter v Sázavě", 49.8716, 14.8970, 6,
         {"en": ("Sázava Monastery", "Monastery in Sázava")}),
        ("Vyhlídka nad Sázavou", "Vyhlídka nad údolím řeky", 49.8590, 14.9210, 10,
         {"en": ("Sázava Lookout", "Lookout above the river valley")}),
        ("Kaple sv. Jana", "Malá kaple u lesní cesty", 49.8400, 14.9050, 8,
         {"en": ("St. John's Chapel", "Small chapel by the forest road")}),
        ("Mlýn u řeky", "Starý vodní mlýn", 49.8250, 14.9400, 12,
         {"en": ("River Mill", "Old water mill")}),
        ("Hrad Český Šternberk", "Gotický hrad nad řekou", 49.8098, 14.9277, 15,
         {"en": ("Český Šternberk Castle", "Gothic castle above the river")}),
    ])
    tasks = add_tasks(race, [
        ("Kvíz o hradu", "Odpovězte na tři otázky o historii hradu.", 10,
         {"en": ("Castle quiz", "Answer three questions about the castle's history.")}),
        ("Skupinové foto na mostě", "Vyfoťte tým na mostě přes Sázavu.", 5,
         {"en": ("Group photo on the bridge", "Take a team photo on the bridge over the Sázava.")}),
    ])

    paid_at = now - timedelta(days=30)
    for index, key in enumerate(("explorers", "nature", "rychle_sipy", "zelvy")):
        reg = register(race, teams[key], categories["cars" if index % 2 == 0 else "bikes"],
                       confirmed_at=paid_at + timedelta(hours=index))
        add_payment(reg, race, "team", "confirmed", reg.payment_confirmed_at - timedelta(minutes=2),
                    f"cs_seed_autumn_{key}")

    start = race.start_logging_at

    def at(minutes):
        return start + timedelta(minutes=minutes)

    add_visits(race, teams["explorers"],
               [(cps[0], at(15)), (cps[1], at(50)), (cps[2], at(95)), (cps[3], at(140)), (cps[4], at(190))],
               [(tasks[0], at(200)), (tasks[1], at(60))])
    add_visits(race, teams["nature"],
               [(cps[0], at(20)), (cps[2], at(70)), (cps[3], at(120)), (cps[4], at(170))],
               [(tasks[0], at(180))])
    add_visits(race, teams["rychle_sipy"],
               [(cps[1], at(25)), (cps[0], at(60)), (cps[2], at(110)), (cps[4], at(200))],
               [(tasks[1], at(65))])
    add_visits(race, teams["zelvy"], [(cps[0], at(40)), (cps[1], at(100)), (cps[4], at(230))])
    return race


def seed_data():
    """Seed database with sample data including translations."""
    now = utc_now()  # race times are stored as naive UTC

    users, teams = seed_users_and_teams()
    categories = seed_categories()
    seed_race_city_challenge(now, teams, categories)
    seed_race_nature_expedition(now, teams, users, categories)
    seed_race_city_explorer(now, teams, users, categories)
    seed_race_autumn_loop(now, teams, users, categories)
    db.session.commit()

    print("Database seeded successfully!")
    print(f"Users (password '{PASSWORD}'): " + ", ".join(u.email for u in users.values()))


# ---------------------------------------------------------------------------
# Production bootstrap
# ---------------------------------------------------------------------------

def is_production_seed_mode() -> bool:
    """Return True when seed should run in production-safe mode."""
    config_target = os.environ.get("FLASK_CONFIG", "")
    return config_target.endswith("ProductionConfig")


def resolve_admin_seed_email(flask_app) -> str:
    """Resolve admin email from config variables used by the application."""
    admin_email = (flask_app.config.get("ADMIN_EMAIL") or "").strip()
    if admin_email:
        return admin_email

    registration_admin_emails = flask_app.config.get("REGISTRATION_ADMIN_EMAILS") or []
    if registration_admin_emails:
        return str(registration_admin_emails[0]).strip()

    return ""


def seed_production_admin_only(flask_app):
    """Wipe DB schema and create only one admin user for production bootstrap."""
    admin_email = resolve_admin_seed_email(flask_app)
    if not admin_email:
        raise RuntimeError(
            "Cannot seed production database: set ADMIN_EMAIL (or REGISTRATION_ADMIN_EMAILS)."
        )

    db.drop_all()
    db.create_all()

    admin_user = User(
        name="Admin",
        email=admin_email,
        is_administrator=True,
        preferred_language="en",
    )
    admin_user.set_password(PASSWORD)
    db.session.add(admin_user)
    db.session.commit()

    print(f"Production seed completed. Admin user created: {admin_email}")


if __name__ == "__main__":
    # run inside app context
    app = create_app()
    with app.app_context():
        if is_production_seed_mode():
            seed_production_admin_only(app)
        else:
            clean_db()
            seed_data()
