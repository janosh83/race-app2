import pytest
from app import create_app, db
from app.models import Race, Team

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
        race2 = Race(name="Hill Bill Rally", description="Roadtrip po Balkáně")

        team1 = Team(name="Team1")
        team2 = Team(name="Team2")
        team3 = Team(name="Team3")

        db.session.add_all([race1, race2, team1, team2, team3])
        db.session.commit()

def test_get_teams(test_client, add_test_data):
    # Test získání všech týmů
    response = test_client.get("/api/team/")
    assert response.status_code == 200
    assert response.json == [
        {"id": 1, "name": "Team1"},
        {"id": 2, "name": "Team2"},
        {"id": 3, "name": "Team3"}
    ]

def test_get_single_team(test_client, add_test_data):
    # Test získání jednoho týmu
    response = test_client.get("/api/team/1/")
    assert response.status_code == 200
    assert response.json == {"id": 1, "name": "Team1"}

    response = test_client.get("/api/team/4/")
    assert response.status_code == 404

def test_team_signup(test_client, add_test_data):
    # Test přihlášení týmu k závodu
    response = test_client.post("/api/team/race/1/", json={"team_id": 1})
    assert response.status_code == 201
    assert response.json == {"team_id": 1, "race_id": 1}

    # Test získání týmů podle závodu
    response = test_client.post("/api/team/race/1/", json={"team_id": 2})
    response = test_client.get("/api/team/race/1/")
    assert response.json == [{"id": 1, "name": "Team1"}, {"id": 2, "name": "Team2"}]

def test_add_team(test_client, add_test_data):
    # Test přidání týmu
    response = test_client.post("/api/team/", json={"name": "Team4"})
    assert response.status_code == 201
    assert response.json == {"id": 4, "name": "Team4"}

def test_add_members(test_client, add_test_data):
    # Test přidání členů do týmu
    response = test_client.post("/auth/register/", json={"name": "John", "email": "john@seznam.cz", "password": "password"})
    assert response.status_code == 201
    response = test_client.post("/auth/register/", json={"name": "Peter", "email": "peter@seznam.cz", "password": "password"})
    assert response.status_code == 201
    
    response = test_client.post("/api/team/1/members/", json={"user_ids": [1, 2]})
    assert response.status_code == 201
    assert response.json == {"team_id": 1, "user_ids": [1, 2]}

    # Test získání členů týmu
    response = test_client.get("/api/team/1/members/")
    assert response.status_code == 200
    assert response.json == [{"id": 1, "name": "John"}, {"id": 2, "name": "Peter"}]

    response = test_client.get("/api/team/2/members/")
    assert response.status_code == 200
    assert response.json == []