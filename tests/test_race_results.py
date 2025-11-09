import pytest
from app import create_app, db
from app.models import Race, Checkpoint, Team, Registration, RaceCategory, User
from datetime import datetime, timedelta

@pytest.fixture
def test_app():
    app = create_app("app.config.TestConfig")
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()

@pytest.fixture
def test_client(test_app):
    return test_app.test_client()

@pytest.fixture
def add_test_data(test_app):
    # insert test data
    with test_app.app_context():
        now = datetime.now()
        some_time_earlier = now - timedelta(minutes=10)
        some_time_later = now + timedelta(minutes=10)
        race1 = Race(name="Jarní jízda", description="24 hodin objevování Česka", start_showing_checkpoints_at=some_time_earlier, 
                     end_showing_checkpoints_at=some_time_earlier, start_logging_at=some_time_later, end_logging_at=some_time_later)
        race2 = Race(name="Letní sprint", description="Rychlá letní soutěž", start_showing_checkpoints_at=some_time_earlier, 
                     end_showing_checkpoints_at=some_time_earlier, start_logging_at=some_time_later, end_logging_at=some_time_later)

        check1 = Checkpoint(title="Praha", latitude=50.0755381, longitude=14.4378005, description="Hlavní město České republiky", numOfPoints = 1)
        check2 = Checkpoint(title="Brno", latitude=49.1950602, longitude=16.6068371, description="Město na jihu Moravy", numOfPoints = 1)
        check3 = Checkpoint(title="Ostrava", latitude=49.820923, longitude=18.262524, description="Průmyslové město na severovýchodě", numOfPoints = 1)
        check1.race_id = 1
        check2.race_id = 1
        check3.race_id = 1

        check4 = Checkpoint(title="Plzeň", latitude=49.7475, longitude=13.3776, description="Město známé pivem", numOfPoints = 1)
        check5 = Checkpoint(title="Liberec", latitude=50.7671, longitude=15.0562, description="Město v severních Čechách", numOfPoints = 2)
        check4.race_id = 2
        check5.race_id = 2

        team1 = Team(name="Rychlíci")
        team2 = Team(name="Dobrodruzi")
        team3 = Team(name="Objevitelé")
        team4 = Team(name="Cestovatelé")
        team5 = Team(name="Průzkumníci")

        race_category1 = RaceCategory(name="Kola", description="Na libovolném kole.")
        race1.categories.append(race_category1)
        race2.categories.append(race_category1)

        registration1 = Registration(race_id=1, team_id=1, race_category_id=1)
        registration2 = Registration(race_id=1, team_id=2, race_category_id=1)
        registration3 = Registration(race_id=1, team_id=3, race_category_id=1)
        registration4 = Registration(race_id=2, team_id=4, race_category_id=1)
        registration5 = Registration(race_id=2, team_id=5, race_category_id=1)
        
        user1 = User(name="User1", email="example1@example.com", is_administrator=True)
        user1.set_password("password")
        user2 = User(name="User2", email="example2@example.com")
        user2.set_password("password")
        team1.members = [user1]
        team4.members = [user2]

        db.session.add_all([race1, check1, check2, check3, 
                            race2, check4, check5, 
                            team1, team2, team3, team4, team5, 
                            race_category1, 
                            registration1, registration2, registration3, registration4, registration5, user1, user2])
        db.session.commit()

def test_simple_results(test_client, add_test_data):
    response = test_client.post("/auth/login/", json={"email": "example1@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}

    # 1 point for team 1
    response = test_client.post("/api/race/1/checkpoints/log/", headers = headers, json={"checkpoint_id": 1, "team_id": 1}) 
    assert response.status_code == 201
    response = test_client.get("/api/race/1/results/", headers = headers)
    assert response.status_code == 200
    assert len(response.json) == 3
    assert {"team": "Rychlíci", "category": "Kola", "points_for_checkpoints": 1} in response.json
    assert {"team": "Dobrodruzi", "category": "Kola", "points_for_checkpoints": 0} in response.json
    assert {"team": "Objevitelé", "category": "Kola", "points_for_checkpoints": 0} in response.json

    # 1 point for team 1, 1 point for team 2
    response = test_client.post("/api/race/1/checkpoints/log/", headers = headers, json={"checkpoint_id": 2, "team_id": 2}) 
    assert response.status_code == 201
    response = test_client.get("/api/race/1/results/", headers = headers)
    assert response.status_code == 200
    assert len(response.json) == 3
    assert {"team": "Rychlíci", "category": "Kola", "points_for_checkpoints": 1} in response.json
    assert {"team": "Dobrodruzi", "category": "Kola", "points_for_checkpoints": 1} in response.json
    assert {"team": "Objevitelé", "category": "Kola", "points_for_checkpoints": 0} in response.json

    # 1 point for team 1, 2 point for team 2
    response = test_client.post("/api/race/1/checkpoints/log/", headers = headers, json={"checkpoint_id": 3, "team_id": 2}) 
    assert response.status_code == 201
    response = test_client.get("/api/race/1/results/", headers = headers)
    assert response.status_code == 200
    assert len(response.json) == 3
    assert {"team": "Rychlíci", "category": "Kola", "points_for_checkpoints": 1} in response.json
    assert {"team": "Dobrodruzi", "category": "Kola", "points_for_checkpoints": 2} in response.json
    assert {"team": "Objevitelé", "category": "Kola", "points_for_checkpoints": 0} in response.json

def test_more_results(test_client, add_test_data):
    response = test_client.post("/auth/login/", json={"email": "example1@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}

    response = test_client.post("/api/race/1/checkpoints/log/", headers = headers, json={"checkpoint_id": 1, "team_id": 1})
    response = test_client.post("/api/race/1/checkpoints/log/", headers = headers, json={"checkpoint_id": 2, "team_id": 1})
    response = test_client.post("/api/race/1/checkpoints/log/", headers = headers, json={"checkpoint_id": 1, "team_id": 2})
    response = test_client.get("/api/race/1/results/", headers = headers)
    assert response.status_code == 200
    assert len(response.json) == 3
    assert {"team": "Rychlíci", "category": "Kola", "points_for_checkpoints": 2} in response.json
    assert {"team": "Dobrodruzi", "category": "Kola", "points_for_checkpoints": 1} in response.json
    assert {"team": "Objevitelé", "category": "Kola", "points_for_checkpoints": 0} in response.json

def test_more_results(test_client, add_test_data):
    response = test_client.post("/auth/login/", json={"email": "example1@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}

    response = test_client.post("/api/race/2/checkpoints/log/", headers = headers, json={"checkpoint_id": 4, "team_id": 4})
    response = test_client.post("/api/race/2/checkpoints/log/", headers = headers, json={"checkpoint_id": 5, "team_id": 4})
    response = test_client.post("/api/race/2/checkpoints/log/", headers = headers, json={"checkpoint_id": 4, "team_id": 5})
    response = test_client.get("/api/race/2/results/", headers = headers)
    assert response.status_code == 200
    assert len(response.json) == 2
    assert {"team": "Cestovatelé", "category": "Kola", "points_for_checkpoints": 3} in response.json
    assert {"team": "Průzkumníci", "category": "Kola", "points_for_checkpoints": 1} in response.json