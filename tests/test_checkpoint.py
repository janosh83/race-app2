import pytest
from app import create_app, db
from app.models import Race, Checkpoint, User
from datetime import datetime, timedelta

@pytest.fixture
def test_app():
    # use test config
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
    # Insert test data
    with test_app.app_context():
        now = datetime.now()
        some_time_earlier = now - timedelta(minutes=10)
        some_time_later = now + timedelta(minutes=10)
        race1 = Race(name="Jarní jízda", description="24 hodin objevování Česka", start_showing_checkpoints_at=some_time_earlier, 
                     end_showing_checkpoints_at=some_time_earlier, start_logging_at=some_time_later, end_logging_at=some_time_later)

        user1 = User(name="User1", email="example1@example.com", is_administrator=True)
        user1.set_password("password")

        checkpoint1 = Checkpoint(title="Checkpoint 1", description="První checkpoint", latitude=50.0755, longitude=14.4378, numOfPoints=1)
        checkpoint2 = Checkpoint(title="Checkpoint 2", description="Druhý checkpoint", latitude=50.0855, longitude=14.4478, numOfPoints=2)
        checkpoint1.race_id = 1
        checkpoint2.race_id = 1

        db.session.add_all([race1, user1, checkpoint1, checkpoint2])
        db.session.commit()

def test_checkpoint(test_client, add_test_data):
    response = test_client.post("/auth/login/", json={"email": "example1@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}

    response = test_client.get("/api/checkpoint/1/", headers=headers)
    assert response.status_code == 200
    assert response.json["title"] == "Checkpoint 1"
    assert response.json["description"] == "První checkpoint"
    assert response.json["latitude"] == 50.0755
    assert response.json["longitude"] == 14.4378
    assert response.json["numOfPoints"] == 1
    
    response = test_client.get("/api/checkpoint/2/", headers=headers)
    assert response.status_code == 200
    assert response.json["title"] == "Checkpoint 2"
    assert response.json["description"] == "Druhý checkpoint"
    assert response.json["latitude"] == 50.0855
    assert response.json["longitude"] == 14.4478
    assert response.json["numOfPoints"] == 2

    response = test_client.get("/api/checkpoint/3/", headers=headers)
    assert response.status_code == 404

def test_delete_checkpoint(test_client, add_test_data):
    response = test_client.post("/auth/login/", json={"email": "example1@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}

    response = test_client.delete("/api/checkpoint/1/", headers=headers)
    assert response.status_code == 200

    response = test_client.get("/api/checkpoint/1/", headers=headers)
    assert response.status_code == 404

def test_create_checkpoint(test_client, add_test_data):
    response = test_client.post("/auth/login/", json={"email": "example1@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}

    response = test_client.post("/api/race/1/checkpoints/", json={
        "title": "Checkpoint 3", "description": "Třetí checkpoint", "latitude": 50.0955, "longitude": 14.4578, "numOfPoints": 3}, headers=headers)
    assert response.status_code == 201

    response = test_client.get("/api/checkpoint/3/", headers=headers)
    assert response.status_code == 200
    assert response.json["title"] == "Checkpoint 3"
    assert response.json["description"] == "Třetí checkpoint"
    assert response.json["latitude"] == 50.0955
    assert response.json["longitude"] == 14.4578
    assert response.json["numOfPoints"] == 3

    response = test_client.get("/api/race/1/checkpoints/", headers=headers)
    assert response.status_code == 200
    assert len(response.json) == 3