import pytest
from app import create_app, db
from app.models import Race, Checkpoint

# TODO: adding races should be admin task
# TODO: getting checkpoint data should require user authentication

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
        race1 = Race(name="Jarní jízda", description="24 hodin objevování Česka")

        check1 = Checkpoint(title="Praha", latitude=50.0755381, longitude=14.4378005, description="Hlavní město České republiky", numOfPoints = 1)
        check2 = Checkpoint(title="Brno", latitude=49.1950602, longitude=16.6068371, description="Město na jihu Moravy", numOfPoints = 1)
        check1.race_id = 1
        check2.race_id = 1

        db.session.add_all([race1, check1, check2])
        db.session.commit()

def test_get_all_races(test_client, add_test_data):
    """Test endpoint GET /api/race """
    response = test_client.get("/api/race/")
    assert response.status_code == 200
    assert response.json == [{"id": 1, "name": "Jarní jízda", "description": "24 hodin objevování Česka"}]
    # testing more races is done below as part of test_create_race

    # TODO: test also empty race list

def test_get_single_race(test_client, add_test_data):
    """Test endpoint GET /api/race/race_id """
    response = test_client.get("/api/race/1/") # race exist
    assert response.status_code == 200
    assert response.json == {"id": 1, "name": "Jarní jízda", "description": "24 hodin objevování Česka"}

    response = test_client.get("/api/race/2/") # non existing race
    assert response.status_code == 404

def test_create_race(test_client, add_test_data):
    """Test endpoint POST /api/race """
    # login as an admin
    response = test_client.post("/auth/register/", json={"name": "test", "email": "test@example.com", "password": "test", "is_administrator": True})
    response = test_client.post("/auth/login/", json={"email": "test@example.com", "password": "test"})
    access_token = response.json["access_token"]
    # create the race
    response = test_client.post("/api/race/", json={"name": "Hill Bill Rally", "description": "Roadtrip po Balkáně."}, headers={"Authorization": f"Bearer {access_token}"})
    assert response.status_code == 201
    data = response.get_json()
    assert data == {"id": 2, "name": "Hill Bill Rally", "description": "Roadtrip po Balkáně."}

    response = test_client.get("/api/race/") # get all races to see added race
    assert response.status_code == 200
    assert response.json == [
        {"id": 1, "name": "Jarní jízda", "description": "24 hodin objevování Česka"},
        {"id": 2, "name": "Hill Bill Rally", "description": "Roadtrip po Balkáně."}
    ]

def test_get_race_checkpoints(test_client, add_test_data):
    """Test endpoint GET /api/race/race_id/checkpoints/checkpoint_id """
    response = test_client.get("/api/race/1/checkpoints/1/") # get first checkpoint
    assert response.status_code == 200
    assert response.json == {
        "id": 1, 
        "title": "Praha", 
        "latitude": 50.0755381, 
        "longitude": 14.4378005, 
        "description": "Hlavní město České republiky", 
        "numOfPoints": 1
    }

    response = test_client.get("/api/race/1/checkpoints/2/") # get second checkpoint
    assert response.status_code == 200
    assert response.json == {
        "id": 2, 
        "title": "Brno", 
        "latitude": 49.1950602, 
        "longitude": 16.6068371, 
        "description": "Město na jihu Moravy", 
        "numOfPoints": 1
    }

    response = test_client.get("/api/race/1/checkpoints/3/") # non existing checkpoint
    assert response.status_code == 404

    response = test_client.get("/api/race/2/checkpoints/1/") # non existing race
    assert response.status_code == 404

    response = test_client.get("/api/race/1/checkpoints/") # get all checkpoints for race
    assert response.status_code == 200
    assert response.json == [
        {
            "id": 1, 
            "title": "Praha", 
            "latitude": 50.0755381, 
            "longitude": 14.4378005, 
            "description": "Hlavní město České republiky", 
            "numOfPoints": 1
        },
        {
            "id": 2, 
            "title": "Brno", 
            "latitude": 49.1950602, 
            "longitude": 16.6068371, 
            "description": "Město na jihu Moravy", 
            "numOfPoints": 1
        }
    ]