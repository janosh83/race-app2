import pytest
from app import create_app, db
from app.models import Race, Team, Checkpoint, CheckpointLog

@pytest.fixture
def test_app():
    # Použití konfigurace pro testování
    app = create_app("app.config.TestConfig")
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()

@pytest.fixture
def test_client(test_app):
    # Vytvoření testovacího klienta
    return test_app.test_client()

@pytest.fixture
def add_test_data(test_app):
    # Vložení testovacích dat
    with test_app.app_context():
        race1 = Race(name="Jarní jízda", description="24 hodin objevování Česka")

        team1 = Team(name="Team1")
        team2 = Team(name="Team2")
        team3 = Team(name="Team3")

        checkpoint1 = Checkpoint(title="Checkpoint 1", latitude=50.0, longitude=14.0, description="Description", numOfPoints=1, race_id=1)
        checkpoint2 = Checkpoint(title="Checkpoint 2", latitude=50.0, longitude=14.5, description="Description", numOfPoints=2, race_id=1)
        checkpoint3 = Checkpoint(title="Checkpoint 3", latitude=50.5, longitude=15.0, description="Description", numOfPoints=1, race_id=1)

        race1.teams = [team1, team2, team3]

        db.session.add_all([race1, team1, team2, team3, checkpoint1, checkpoint2, checkpoint3])
        db.session.commit()

def test_log_visit(test_client, add_test_data):
    # Test zalogování návštěvy checkpointu
    response = test_client.post("/api/race/1/checkpoints/log/", json={"checkpoint_id": 1, "team_id": 1})
    assert response.status_code == 201
    assert response.json["checkpoint_id"] == 1
    assert response.json["team_id"] == 1
    assert response.json["race_id"] == 1

    response = test_client.post("/api/race/1/checkpoints/log/", json={"checkpoint_id": 2, "team_id": 4})
    assert response.status_code == 404 # TODO: not implemented

    response = test_client.post("/api/race/1/checkpoints/log/", json={"checkpoint_id": 4, "team_id": 2})
    assert response.status_code == 404 # TODO: not implemented

def test_get_visits(test_client, add_test_data):
    # Test získání návštěv checkpointů
    response = test_client.get("/api/race/1/visits/")
    assert response.status_code == 200
    assert len(response.json) == 0

    response = test_client.post("/api/race/1/checkpoints/log/", json={"checkpoint_id": 1, "team_id": 1})
    response = test_client.post("/api/race/1/checkpoints/log/", json={"checkpoint_id": 1, "team_id": 2})
    response = test_client.get("/api/race/1/visits/")
    assert response.status_code == 200
    assert len(response.json) == 2

    response = test_client.post("/api/race/1/checkpoints/log/", json={"checkpoint_id": 2, "team_id": 1})
    response = test_client.get("/api/race/1/visits/1/")
    assert response.status_code == 200
    assert len(response.json) == 2

    response = test_client.get("/api/race/1/visits/2/")
    assert response.status_code == 200
    assert len(response.json) == 1
