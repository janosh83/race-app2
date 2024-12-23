import pytest
from app import create_app, db
from app.models import Race

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
        db.session.add_all([race1])
        db.session.commit()

def test_get_race(test_client, add_test_data):
    """Test endpoint GET /api/race """
    response = test_client.get("/api/race/")
    assert response.status_code == 200
    assert response.json == [{"id": 1, "name": "Jarní jízda", "description": "24 hodin objevování Česka"}]

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