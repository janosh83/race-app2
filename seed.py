from app import db
from app.models import User, Team, Race, Checkpoint

def seed_data():
    #if User.query.first() or Team.query.first():
    #    print("Database already seeded!")
    #    return

    race1 = Race(name="First race", description="This is the first testing race.")
    race2 = Race(name="Second race", description="This is the second testing race.")

    checkpoint1 = Checkpoint(title="Checkpoint 1", description="This is the first checkpoint.", latitude=50.24, longitude=15.78, numOfPoints=1)
    checkpoint2 = Checkpoint(title="Checkpoint 2", description="This is the second checkpoint.", latitude=49.85, longitude=14.54, numOfPoints=1)
    checkpoint3 = Checkpoint(title="Checkpoint 3", description="This is the third checkpoint.", latitude=50.14, longitude=14.95, numOfPoints=1)
    race1.checkpoints.extend([checkpoint1, checkpoint2, checkpoint3])

    checkpoint4 = Checkpoint(title="Checkpoint 4", description="This is the fourth checkpoint.", latitude=50.15, longitude=14.86, numOfPoints=1)
    checkpoint5 = Checkpoint(title="Checkpoint 5", description="This is the fifth checkpoint.", latitude=50.15, longitude=14.86, numOfPoints=1)
    race2.checkpoints.extend([checkpoint4, checkpoint5])

    user1 = User(name="Alice", email="alice@example.com", is_administrator=False)
    user1.set_password("password")
    user2 = User(name="Bob", email="bob@example.com", is_administrator=False)
    user2.set_password("password")

    user3 = User(name="Charlie", email="charlie@example.com", is_administrator=True)
    user3.set_password("password")

    team1 = Team(name="Demo Team")
    team1.members.extend([user1, user2])

    team2 = Team(name="Admin Team")
    team2.members.append(user3)

    race1.teams.extend([team1, team2])

    db.session.add_all([race1, race2])
    db.session.add_all([user1, user2, user3, team1, team2])
    db.session.commit()
    
    print("Database seeded successfully!")

if __name__ == "__main__":
    from app import create_app
    app = create_app()
    with app.app_context():
        seed_data()
