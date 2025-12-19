from datetime import datetime, timedelta
import os

from app import db, create_app
from app.models import (
    User,
    Team,
    Race,
    Checkpoint,
    Task,
    RaceCategory,
    Registration,
    CheckpointLog,
    TaskLog,
    Image,
    team_members,
    race_categories_in_race,
)

def clean_db():
    """Remove existing data in correct order to avoid FK errors."""
    # delete child tables first
    db.session.execute(CheckpointLog.__table__.delete())
    db.session.execute(TaskLog.__table__.delete())
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

def seed_data():
    now = datetime.utcnow()

    # create races with required datetime fields
    race1 = Race(
        name="First race",
        description="This is the first testing race.",
        start_showing_checkpoints_at=now - timedelta(days=1),
        end_showing_checkpoints_at=now + timedelta(days=7),
        start_logging_at=now - timedelta(days=1),
        end_logging_at=now + timedelta(days=7),
    )
    race2 = Race(
        name="Second race",
        description="This is the second testing race.",
        start_showing_checkpoints_at=now - timedelta(days=1),
        end_showing_checkpoints_at=now + timedelta(days=14),
        start_logging_at=now - timedelta(days=1),
        end_logging_at=now + timedelta(days=14),
    )

    # checkpoints
    checkpoint1 = Checkpoint(
        title="Checkpoint 1",
        description="This is the first checkpoint.",
        latitude=50.24,
        longitude=15.78,
        numOfPoints=1,
    )
    checkpoint2 = Checkpoint(
        title="Checkpoint 2",
        description="This is the second checkpoint.",
        latitude=49.85,
        longitude=14.54,
        numOfPoints=1,
    )
    checkpoint3 = Checkpoint(
        title="Checkpoint 3",
        description="This is the third checkpoint.",
        latitude=50.14,
        longitude=14.95,
        numOfPoints=1,
    )
    race1.checkpoints.extend([checkpoint1, checkpoint2, checkpoint3])

    checkpoint4 = Checkpoint(
        title="Checkpoint 4",
        description="This is the fourth checkpoint.",
        latitude=50.15,
        longitude=14.86,
        numOfPoints=1,
    )
    checkpoint5 = Checkpoint(
        title="Checkpoint 5",
        description="This is the fifth checkpoint.",
        latitude=50.15,
        longitude=14.86,
        numOfPoints=1,
    )
    race2.checkpoints.extend([checkpoint4, checkpoint5])

    # tasks
    task1 = Task(
        title="Identify local landmark",
        description="Find and photograph a famous local landmark.",
        numOfPoints=5,
    )
    task2 = Task(
        title="Interview local resident",
        description="Talk to a local person and record interesting facts.",
        numOfPoints=10,
    )
    task3 = Task(
        title="Collect historical info",
        description="Research and document local history.",
        numOfPoints=8,
    )
    race1.tasks.extend([task1, task2])

    task4 = Task(
        title="Photography challenge",
        description="Take creative photos of the race area.",
        numOfPoints=7,
    )
    task5 = Task(
        title="Environmental survey",
        description="Assess and document local environmental features.",
        numOfPoints=6,
    )
    race2.tasks.extend([task4, task5])

    # users
    user1 = User(name="Alice", email="alice@example.com", is_administrator=False)
    user1.set_password("password")
    user2 = User(name="Bob", email="bob@example.com", is_administrator=False)
    user2.set_password("password")
    user3 = User(name="Charlie", email="charlie@example.com", is_administrator=True)
    user3.set_password("password")

    # teams
    team1 = Team(name="Demo Team")
    team1.members.extend([user1, user2])
    team2 = Team(name="Admin Team")
    team2.members.append(user3)

    # add races, users, teams and checkpoints
    db.session.add_all([race1, race2, user1, user2, user3, team1, team2])
    db.session.commit()

    # categories and registrations
    cat1 = RaceCategory(name="Category A", description="Amateurs")
    cat2 = RaceCategory(name="Category B", description="Professionals")
    db.session.add_all([cat1, cat2])
    db.session.commit()

    # associate categories to races (optional)
    race1.categories.append(cat1)
    race2.categories.append(cat2)
    db.session.commit()

    # registrations: link teams to races with category
    reg1 = Registration(race_id=race1.id, team_id=team1.id, race_category_id=cat1.id)
    reg2 = Registration(race_id=race1.id, team_id=team2.id, race_category_id=cat1.id)
    db.session.add_all([reg1, reg2])
    db.session.commit()

    print("Database seeded successfully!")

if __name__ == "__main__":
    # run inside app context
    app = create_app()
    with app.app_context():
        clean_db()
        seed_data()