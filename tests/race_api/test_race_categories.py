import pytest
from app import db
from app.models import Race, Team, User, RaceCategory, Registration
from datetime import datetime, timedelta


@pytest.fixture
def add_test_data(test_app):
    # test data
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

def test_with_race(test_client, add_test_data):
    response = test_client.post("/auth/login/", json={"email": "example1@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}

    response = test_client.get("/api/race/1/categories/", headers = headers)
    assert response.status_code == 200
    
    assert response.json[0]["name"] == "Kola"
    assert response.json[0]["description"] == "Na libovolném kole."
    
    response = test_client.post("/api/race-category/", json={"name": "Běh", "description": "Pro běžce."}, headers = headers)
    response = test_client.post("/api/race/1/categories/", json={"race_category_id": response.json['id']}, headers = headers)
    assert response.status_code == 201

    response = test_client.get("/api/race/1/categories/", headers = headers)
    assert response.status_code == 200
    assert len(response.json) == 2
    assert response.json[0]["name"] == "Kola"
    assert response.json[0]["description"] == "Na libovolném kole."
    assert response.json[1]["name"] == "Běh"
    assert response.json[1]["description"] == "Pro běžce."


def test_remove_race_category_success(test_client, add_test_data):
    """Test removing a category from a race."""
    response = test_client.post("/auth/login/", json={"email": "example1@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}

    # verify initial category exists
    response = test_client.get("/api/race/1/categories/", headers=headers)
    assert response.status_code == 200
    assert len(response.json) == 1
    category_id = response.json[0]["id"]

    # remove the category
    response = test_client.delete("/api/race/1/categories/", json={"race_category_id": category_id}, headers=headers)
    assert response.status_code == 200
    assert response.json["race_id"] == 1
    assert response.json["race_category_id"] == category_id

    # verify category removed
    response = test_client.get("/api/race/1/categories/", headers=headers)
    assert response.status_code == 200
    assert len(response.json) == 0


def test_remove_race_category_missing_id(test_client, add_test_data):
    """Test removing category without providing race_category_id."""
    response = test_client.post("/auth/login/", json={"email": "example1@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}

    response = test_client.delete("/api/race/1/categories/", json={}, headers=headers)
    assert response.status_code == 400
    assert "race_category_id" in response.json["message"]


def test_remove_race_category_not_assigned(test_client, add_test_data):
    """Test removing category that is not assigned to race."""
    response = test_client.post("/auth/login/", json={"email": "example1@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}

    # create a new category not assigned to the race
    response = test_client.post("/api/race-category/", json={"name": "Koloběžka", "description": "Na koloběžce."}, headers=headers)
    unassigned_category_id = response.json['id']

    # try to remove it from race 1
    response = test_client.delete("/api/race/1/categories/", json={"race_category_id": unassigned_category_id}, headers=headers)
    assert response.status_code == 404
    assert "not assigned" in response.json["message"]


def test_remove_race_category_nonexistent_category(test_client, add_test_data):
    """Test removing category with non-existent race_category_id."""
    response = test_client.post("/auth/login/", json={"email": "example1@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}

    response = test_client.delete("/api/race/1/categories/", json={"race_category_id": 999}, headers=headers)
    assert response.status_code == 404


def test_remove_race_category_nonexistent_race(test_client, add_test_data):
    """Test removing category from non-existent race."""
    response = test_client.post("/auth/login/", json={"email": "example1@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}

    response = test_client.delete("/api/race/999/categories/", json={"race_category_id": 1}, headers=headers)
    assert response.status_code == 404


def test_remove_race_category_requires_admin(test_client, add_test_data, test_app):
    """Test that removing category requires admin privileges."""
    with test_app.app_context():
        # create non-admin user
        user = User(name="Regular User", email="user@example.com", is_administrator=False)
        user.set_password("pass")
        db.session.add(user)
        db.session.commit()

    response = test_client.post("/auth/login/", json={"email": "user@example.com", "password": "pass"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}

    response = test_client.delete("/api/race/1/categories/", json={"race_category_id": 1}, headers=headers)
    assert response.status_code == 403


def test_remove_multiple_race_categories(test_client, add_test_data):
    """Test removing multiple categories from a race."""
    response = test_client.post("/auth/login/", json={"email": "example1@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}

    # add second category
    response = test_client.post("/api/race-category/", json={"name": "Běh", "description": "Pro běžce."}, headers=headers)
    category2_id = response.json['id']
    test_client.post("/api/race/1/categories/", json={"race_category_id": category2_id}, headers=headers)

    # verify two categories
    response = test_client.get("/api/race/1/categories/", headers=headers)
    assert len(response.json) == 2
    category1_id = response.json[0]["id"]

    # remove first category
    response = test_client.delete("/api/race/1/categories/", json={"race_category_id": category1_id}, headers=headers)
    assert response.status_code == 200

    # verify only one category remains
    response = test_client.get("/api/race/1/categories/", headers=headers)
    assert len(response.json) == 1
    assert response.json[0]["id"] == category2_id

    # remove second category
    response = test_client.delete("/api/race/1/categories/", json={"race_category_id": category2_id}, headers=headers)
    assert response.status_code == 200

    # verify no categories remain
    response = test_client.get("/api/race/1/categories/", headers=headers)
    assert len(response.json) == 0
