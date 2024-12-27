import pytest
from app import create_app, db
from app.models import Race, Checkpoint

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

def test_get_single_race(test_client, add_test_data):
    """Test endpoint GET /api/race/race_id """
    response = test_client.get("/api/race/1/")
    assert response.status_code == 200
    assert response.json == {"id": 1, "name": "Jarní jízda", "description": "24 hodin objevování Česka"}

    response = test_client.get("/api/race/2/")
    assert response.status_code == 404

def test_create_race(test_client, add_test_data):
    """Test endpoint POST /api/race """
    response = test_client.post("/api/race/", json={"name": "Hill Bill Rally", "description": "Roadtrip po Balkáně."})
    assert response.status_code == 201
    data = response.get_json()
    assert data == {"id": 2, "name": "Hill Bill Rally", "description": "Roadtrip po Balkáně."}

    response = test_client.get("/api/race/")
    assert response.status_code == 200
    assert response.json == [
        {"id": 1, "name": "Jarní jízda", "description": "24 hodin objevování Česka"},
        {"id": 2, "name": "Hill Bill Rally", "description": "Roadtrip po Balkáně."}
    ]

def test_get_race_checkpoints(test_client, add_test_data):
    """Test endpoint GET /api/race/race_id/checkpoints/checkpoint_id """
    response = test_client.get("/api/race/1/checkpoints/1/")
    assert response.status_code == 200
    assert response.json == {
        "id": 1, 
        "title": "Praha", 
        "latitude": 50.0755381, 
        "longitude": 14.4378005, 
        "description": "Hlavní město České republiky", 
        "numOfPoints": 1
    }

    response = test_client.get("/api/race/1/checkpoints/2/")
    assert response.status_code == 200
    assert response.json == {
        "id": 2, 
        "title": "Brno", 
        "latitude": 49.1950602, 
        "longitude": 16.6068371, 
        "description": "Město na jihu Moravy", 
        "numOfPoints": 1
    }

    response = test_client.get("/api/race/1/checkpoints/3/")
    assert response.status_code == 404

    response = test_client.get("/api/race/2/checkpoints/1/")
    assert response.status_code == 404

    response = test_client.get("/api/race/1/checkpoints/")
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