import pytest
from app import create_app, db
from app.models import Race, Team, User, RaceCategory, Registration
from datetime import datetime, timedelta

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
        now = datetime.now()
        some_time_earlier = now - timedelta(minutes=10)
        some_time_later = now + timedelta(minutes=10)
        race1 = Race(name="Jarní jízda", description="24 hodin objevování Česka", start_showing_checkpoints_at=some_time_earlier, 
                     end_showing_checkpoints_at=some_time_earlier, start_logging_at=some_time_later, end_logging_at=some_time_later)

        team1 = Team(name="Team1")

        user1 = User(name="User1", email="example1@example.com", is_administrator=True)
        user1.set_password("password")
        team1.members = [user1]

        registration1 = Registration(race_id=1, team_id=1, race_category_id=0)
        race_category1 = RaceCategory(name="Kola", description="Na libovolném kole.")


        race1.categories = [race_category1]
        race1.registrations = [registration1]

        db.session.add_all([race1, team1, user1, registration1, race_category1])
        db.session.commit()

def test_add_race_category(test_client, add_test_data):
    response = test_client.post("/auth/login/", json={"email": "example1@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}

    response = test_client.get("/api/race-category/", headers = headers)
    assert response.status_code == 200
    assert response.json == [{"id": 1, "name": "Kola", "description": "Na libovolném kole."}]

    response = test_client.post("/api/race-category/", json={"name": "Běh", "description": "Pro běžce."}, headers = headers)
    assert response.status_code == 201
    assert response.json == {"id": 2, "name": "Běh", "description": "Pro běžce."}

    response = test_client.delete("/api/race-category/2/", headers = headers)
    assert response.status_code == 200
    assert response.json == {"msg": "Category deleted"}

    response = test_client.get("/api/race-category/", headers = headers)
    assert response.status_code == 200
    assert response.json == [{"id": 1, "name": "Kola", "description": "Na libovolném kole."}]

    