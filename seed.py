from datetime import datetime, timedelta

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
    CheckpointLog,
    TaskLog,
    Image,
    team_members,
    race_categories_in_race,
)

def clean_db():
    """Remove existing data in correct order to avoid FK errors."""
    # delete child tables first (logs and translations)
    db.session.execute(CheckpointLog.__table__.delete())
    db.session.execute(TaskLog.__table__.delete())
    db.session.execute(CheckpointTranslation.__table__.delete())
    db.session.execute(TaskTranslation.__table__.delete())
    db.session.execute(RaceTranslation.__table__.delete())
    db.session.execute(RaceCategoryTranslation.__table__.delete())
    db.session.execute(Registration.__table__.delete())
    # association tables
    db.session.execute(team_members.delete())
    db.session.execute(race_categories_in_race.delete())
    db.session.execute(Image.__table__.delete())
    db.session.execute(Checkpoint.__table__.delete())
    db.session.execute(Task.__table__.delete())
    db.session.execute(Team.__table__.delete())
    db.session.execute(RaceCategory.__table__.delete())
    db.session.execute(Race.__table__.delete())
    db.session.execute(User.__table__.delete())
    db.session.commit()

def seed_checkpoints_and_tasks_race1(race1):
    cp1 = Checkpoint(
        race_id=race1.id,
        title="Radnice",
        description="Historická budova radnice",
        latitude=50.0755,
        longitude=14.4378,
        numOfPoints=10,
    )

    cp2 = Checkpoint(
        race_id=race1.id,
        title="Střední park",
        description="Velký park v centru města",
        latitude=50.0838,
        longitude=14.4200,
        numOfPoints=8,
    )

    cp3 = Checkpoint(
        race_id=race1.id,
        title="Náměstí muzea",
        description="Náměstí se slavným muzeem",
        latitude=50.0945,
        longitude=14.4000,
        numOfPoints=12,
    )

    cp4 = Checkpoint(
        race_id=race1.id,
        title="Hlavní nádraží",
        description="Největší vlakové nádraží ve městě",
        latitude=50.0865,
        longitude=14.4200,
        numOfPoints=5,
    )

    cp5 = Checkpoint(
        race_id=race1.id,
        title="Most přes řeku",
        description="Historický most s krásným výhledem",
        latitude=50.0800,
        longitude=14.4100,
        numOfPoints=7,
    )
    db.session.add_all([cp1, cp2, cp3, cp4, cp5])
    db.session.commit()

    tsk1 = Task(
        race_id=race1.id,
        title="Najděte místní kavárnu",
        description="Najděte a navštivte místní kavárnu, která není součástí žádného řetězce.",
        numOfPoints=10,
    )
    db.session.add(tsk1)
    db.session.commit()

def seed_checkpoints_and_tasks_race2(race2):
    cp1 = Checkpoint(
        race_id=race2.id,
        title="Forest Entrance",
        description="Entry point to the nature reserve",
        latitude=50.1234,
        longitude=14.5678,
        numOfPoints=5,
    )
    cp2 = Checkpoint(
        race_id=race2.id,
        title="River Crossing",
        description="A scenic river crossing point",
        latitude=50.1300,
        longitude=14.5700,
        numOfPoints=10,
    )
    cp3 = Checkpoint(
        race_id=race2.id,
        title="Mountain Peak",
        description="The highest point in the area",
        latitude=50.1400,
        longitude=14.5800,
        numOfPoints=15,
    )
    cp4 = Checkpoint(
        race_id=race2.id,
        title="Forest Clearing",
        description="A peaceful clearing in the forest",
        latitude=50.1500,
        longitude=14.5900,
        numOfPoints=8,
    )
    db.session.add_all([cp1, cp2, cp3, cp4])
    db.session.commit()

    cp1_cs = CheckpointTranslation(checkpoint_id=cp1.id, language="cs", title="Vstup do lesa", description="Vstupní bod do přírodní rezervace")
    cp1_en = CheckpointTranslation(checkpoint_id=cp1.id, language="en", title="Forest Entrance", description="Entry point to the nature reserve")

    cp2_cs = CheckpointTranslation(checkpoint_id=cp2.id, language="cs", title="Přechod řeky", description="Malebný přechod řeky")
    cp2_en = CheckpointTranslation(checkpoint_id=cp2.id, language="en", title="River Crossing", description="A scenic river crossing point")

    cp3_cs = CheckpointTranslation(checkpoint_id=cp3.id, language="cs", title="Vrchol hory", description="Nejvyšší bod v oblasti")
    cp3_en = CheckpointTranslation(checkpoint_id=cp3.id, language="en", title="Mountain Peak", description="The highest point in the area")

    cp4_cs = CheckpointTranslation(checkpoint_id=cp4.id, language="cs", title="Lesní mýtina", description="Poklidná mýtina v lese")
    cp4_en = CheckpointTranslation(checkpoint_id=cp4.id, language="en", title="Forest Clearing", description="A peaceful clearing in the forest")

    db.session.add_all([cp1_cs, cp1_en, cp2_cs, cp2_en, cp3_cs, cp3_en, cp4_cs, cp4_en])
    db.session.commit()

    tsk1 = Task(
        race_id=race2.id,
        title="Find the Local Cafe",
        description="Find and visit a local cafe that is not part of any chain.",
        numOfPoints=10,
    )
    tsk2 = Task(
        race_id=race2.id,
        title="Collect Water Samples",
        description="Collect water samples from the river for analysis.",
        numOfPoints=15,
    )
    db.session.add_all([tsk1, tsk2])
    db.session.commit()

    tsk1_cs = TaskTranslation(task_id=tsk1.id, language="cs", title="Najděte místní kavárnu", description="Najděte a navštivte místní kavárnu, která není součástí žádného řetězce.")
    tsk1_en = TaskTranslation(task_id=tsk1.id, language="en", title="Find the Local Cafe", description="Find and visit a local cafe that is not part of any chain.")

    tsk2_cs = TaskTranslation(task_id=tsk2.id, language="cs", title="Sbírejte vzorky vody", description="Sbírejte vzorky vody z řeky k analýze.")
    tsk2_en = TaskTranslation(task_id=tsk2.id, language="en", title="Collect Water Samples", description="Collect water samples from the river for analysis.")

    db.session.add_all([tsk1_cs, tsk1_en, tsk2_cs, tsk2_en])
    db.session.commit()

def seed_checkpoints_and_tasks_race3(race3):
    cp1 = Checkpoint(
        race_id=race3.id,
        title="City Square",
        description="The central square of the city",
        latitude=50.1200,
        longitude=14.5500,
        numOfPoints=10,
    )
    cp2 = Checkpoint(
        race_id=race3.id,
        title="Old Library",
        description="A historic library with ancient books",
        latitude=50.1250,
        longitude=14.5550,
        numOfPoints=12,
    )
    cp3 = Checkpoint(
        race_id=race3.id,
        title="City Park",
        description="A large park in the city center",
        latitude=50.1300,
        longitude=14.5600,
        numOfPoints=8,
    )
    db.session.add_all([cp1, cp2, cp3])
    db.session.commit()
    cp1_cs = CheckpointTranslation(checkpoint_id=cp1.id, language="cs", title="Městské náměstí", description="Centrální náměstí města")
    cp1_en = CheckpointTranslation(checkpoint_id=cp1.id, language="en", title="City Square", description="The central square of the city")
    cp1_de = CheckpointTranslation(checkpoint_id=cp1.id, language="de", title="Stadtplatz", description="Der zentrale Platz der Stadt")

    cp2_cs = CheckpointTranslation(checkpoint_id=cp2.id, language="cs", title="Stará knihovna", description="Historická knihovna se starými knihami")
    cp2_en = CheckpointTranslation(checkpoint_id=cp2.id, language="en", title="Old Library", description="A historic library with ancient books")
    cp2_de = CheckpointTranslation(checkpoint_id=cp2.id, language="de", title="Alte Bibliothek", description="Eine historische Bibliothek mit alten Büchern")

    cp3_cs = CheckpointTranslation(checkpoint_id=cp3.id, language="cs", title="Městský park", description="Velký park v centru města")
    cp3_en = CheckpointTranslation(checkpoint_id=cp3.id, language="en", title="City Park", description="A large park in the city center")
    cp3_de = CheckpointTranslation(checkpoint_id=cp3.id, language="de", title="Stadtpark", description="Ein großer Park im Stadtzentrum")

    db.session.add_all([cp1_cs, cp1_en, cp1_de, cp2_cs, cp2_en, cp2_de, cp3_cs, cp3_en, cp3_de])
    db.session.commit()

def seed_data():
    """Seed database with sample data including translations."""
    now = datetime.now()

    # ===== USERS =====
    user1 = User(name="Alice Thompson", email="alice@example.com", is_administrator=False, preferred_language="en")
    user1.set_password("password")
    user2 = User(name="Bob Johnson", email="bob@example.com", is_administrator=False, preferred_language="cs")
    user2.set_password("password")
    user3 = User(name="Charlie Müller", email="charlie@example.com", is_administrator=False, preferred_language="de")
    user3.set_password("password")
    user4 = User(name="Diana Smith", email="diana@example.com", is_administrator=False, preferred_language="en")
    user4.set_password("password")
    user5 = User(name="Admin User", email="admin@example.com", is_administrator=True, preferred_language="en")
    user5.set_password("password")

    # ===== TEAMS =====
    team1 = Team(name="Explorer Team")
    team1.members.extend([user1, user2])
    team3 = Team(name="Nature Lovers")
    team3.members.append(user3)
    team4 = Team(name="City Adventurers")
    team4.members.append(user4)
    team5 = Team(name="Admin Team")
    team5.members.append(user5)

    db.session.add_all([user1, user2, user3, user4, user5, team1, team3, team4, team5])
    db.session.commit()

    # ===== RACES =====
    race1 = Race(
        name="Výzva ve městě",
        description="Prozkoumejte město a projděte kontrolní body a úkoly.",
        supported_languages=["cs"],
        default_language="cs",
        start_showing_checkpoints_at=now - timedelta(days=1),
        end_showing_checkpoints_at=now + timedelta(days=7),
        start_logging_at=now - timedelta(days=1),
        end_logging_at=now + timedelta(days=7),
    )
    race2 = Race(
        name="Nature Expedition",
        description="Navigate through natural landmarks and complete challenges.",
        supported_languages=["en", "cs"],
        default_language="en",
        start_showing_checkpoints_at=now - timedelta(hours=2),
        end_showing_checkpoints_at=now + timedelta(days=14),
        start_logging_at=now - timedelta(hours=2),
        end_logging_at=now + timedelta(days=14),
    )
    race3 = Race(
        name="City Explorer",
        description="Discover hidden gems in the city and complete fun tasks.",
        supported_languages=["en", "cs", "de"],
        default_language="en",
        start_showing_checkpoints_at=now + timedelta(days=1),
        end_showing_checkpoints_at=now + timedelta(days=10),
        start_logging_at=now + timedelta(days=1),
        end_logging_at=now + timedelta(days=10),
    )

    db.session.add_all([race1, race2, race3])
    db.session.commit()

    # ===== RACE TRANSLATIONS =====
    race2_cs = RaceTranslation(race_id=race2.id, language="cs", name="Přírodní expedice", description="Navigujte přírodními skvosty a plňte výzvy.")
    race2_en = RaceTranslation(race_id=race2.id, language="en", name="Nature Expedition", description="Navigate through natural landmarks and complete challenges.")
    
    race3_cs = RaceTranslation(race_id=race3.id, language="cs", name="Městský průzkumník", description="Objevujte skryté poklady ve městě a plňte zábavné úkoly.")
    race3_de = RaceTranslation(race_id=race3.id, language="de", name="Stadterkunder", description="Entdecken Sie versteckte Schätze in der Stadt und erfüllen Sie lustige Aufgaben.")

    db.session.add_all([race2_cs, race2_en, race3_cs, race3_de])
    db.session.commit()

    # ===== CHECKPOINTS AND TASKS FOR RACES =====
    seed_checkpoints_and_tasks_race1(race1)
    seed_checkpoints_and_tasks_race2(race2)
    seed_checkpoints_and_tasks_race3(race3)

    # ===== RACE CATEGORIES =====
    cat1 = RaceCategory(name="Cars", description="For car enthusiasts")
    cat2 = RaceCategory(name="Bikes", description="For bike lovers")
    cat3 = RaceCategory(name="Runners", description="For running enthusiasts")
    db.session.add_all([cat1, cat2, cat3])
    db.session.commit()

    cat1_cs = RaceCategoryTranslation(race_category_id=cat1.id, language="cs", name="Auta", description="Pro milovníky aut")
    cat1_de = RaceCategoryTranslation(race_category_id=cat1.id, language="de", name="Autos", description="Für Autoenthusiasten")
    cat1_en = RaceCategoryTranslation(race_category_id=cat1.id, language="en", name="Cars", description="For car enthusiasts")

    cat2_cs = RaceCategoryTranslation(race_category_id=cat2.id, language="cs", name="Kola", description="Pro milovníky kol")
    cat2_de = RaceCategoryTranslation(race_category_id=cat2.id, language="de", name="Fahrräder", description="Für Fahrradliebhaber")
    cat2_en = RaceCategoryTranslation(race_category_id=cat2.id, language="en", name="Bikes", description="For bike lovers")

    cat3_cs = RaceCategoryTranslation(race_category_id=cat3.id, language="cs", name="Běžci", description="Pro milovníky běhu")
    cat3_de = RaceCategoryTranslation(race_category_id=cat3.id, language="de", name="Läufer", description="Für Laufbegeisterte")
    cat3_en = RaceCategoryTranslation(race_category_id=cat3.id, language="en", name="Runners", description="For running enthusiasts")
    
    db.session.add_all([cat1_cs, cat1_de, cat1_en, cat2_cs, cat2_de, cat2_en, cat3_cs, cat3_de, cat3_en])
    db.session.commit()

    # ===== ASSOCIATE CATEGORIES TO RACES =====
    race1.categories.extend([cat1, cat2])
    race2.categories.extend([cat2, cat3])
    race3.categories.extend([cat1, cat3])
    db.session.commit()

    # ===== REGISTRATIONS =====
    reg1 = Registration(race_id=race1.id, team_id=team1.id, race_category_id=cat1.id, email_sent=True, disqualified=False)
    reg2 = Registration(race_id=race1.id, team_id=team5.id, race_category_id=cat1.id, email_sent=True, disqualified=False)
    reg3 = Registration(race_id=race2.id, team_id=team3.id, race_category_id=cat2.id, email_sent=False, disqualified=False)
    reg4 = Registration(race_id=race2.id, team_id=team4.id, race_category_id=cat3.id, email_sent=False, disqualified=False)
    reg5 = Registration(race_id=race2.id, team_id=team5.id, race_category_id=cat3.id, email_sent=False, disqualified=False)
    reg6 = Registration(race_id=race3.id, team_id=team1.id, race_category_id=cat1.id, email_sent=False, disqualified=False)
    reg7 = Registration(race_id=race3.id, team_id=team3.id, race_category_id=cat3.id, email_sent=False, disqualified=False)
    reg8 = Registration(race_id=race3.id, team_id=team5.id, race_category_id=cat1.id, email_sent=False, disqualified=False)

    db.session.add_all([reg1, reg2, reg3, reg4, reg5, reg6, reg7, reg8])
    db.session.commit()

    print("Database seeded successfully!")

if __name__ == "__main__":
    # run inside app context
    app = create_app()
    with app.app_context():
        clean_db()
        seed_data()