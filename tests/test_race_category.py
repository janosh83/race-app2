import pytest
from app import db
from app.models import Race, Team, User, RaceCategory, Registration
from datetime import datetime, timedelta

@pytest.fixture
def add_test_data(test_app):
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

    response = test_client.get("/api/race-category/?lang=cs", headers=headers)
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


def test_get_empty_categories(test_client):
    """Test getting categories when none exist."""
    response = test_client.get("/api/race-category/")
    assert response.status_code == 200
    assert response.json == []


def test_create_category_missing_name(test_client, admin_auth_headers):
    """Test creating category without name returns 400."""
    response = test_client.post("/api/race-category/", json={}, headers=admin_auth_headers)
    assert response.status_code == 400
    assert response.json == {"msg": "Missing race category name"}
    
    response = test_client.post("/api/race-category/", json={"description": "Only description"}, headers=admin_auth_headers)
    assert response.status_code == 400
    assert response.json == {"msg": "Missing race category name"}


def test_create_category_no_description(test_client, admin_auth_headers):
    """Test creating category without description (should default to empty string)."""
    response = test_client.post("/api/race-category/", json={"name": "Test Category"}, headers=admin_auth_headers)
    assert response.status_code == 201
    assert response.json["name"] == "Test Category"
    assert response.json["description"] == ""


def test_create_category_unauthorized(test_client):
    """Test creating category without JWT returns 401."""
    response = test_client.post("/api/race-category/", json={"name": "Test Category"})
    assert response.status_code == 401


def test_create_category_forbidden_non_admin(test_client, regular_user_auth_headers):
    """Test creating category as non-admin returns 403."""
    response = test_client.post("/api/race-category/", json={"name": "Test Category"}, headers=regular_user_auth_headers)
    assert response.status_code == 403


def test_delete_category_not_found(test_client, admin_auth_headers):
    """Test deleting non-existent category returns 404."""
    response = test_client.delete("/api/race-category/999/", headers=admin_auth_headers)
    assert response.status_code == 404


def test_delete_category_unauthorized(test_client, add_test_data):
    """Test deleting category without JWT returns 401."""
    response = test_client.delete("/api/race-category/1/")
    assert response.status_code == 401


def test_delete_category_forbidden_non_admin(test_client, add_test_data, regular_user_auth_headers):
    """Test deleting category as non-admin returns 403."""
    response = test_client.delete("/api/race-category/1/", headers=regular_user_auth_headers)
    assert response.status_code == 403


def test_race_category_translation_crud(test_client, add_test_data, admin_auth_headers):
    create_resp = test_client.post(
        "/api/race-category/1/translations/",
        json={"language": "cs", "name": "Kola CZ", "description": "Na libovolnem kole."},
        headers=admin_auth_headers,
    )
    assert create_resp.status_code == 201

    list_resp = test_client.get("/api/race-category/1/translations/", headers=admin_auth_headers)
    assert list_resp.status_code == 200
    assert any(item["language"] == "cs" for item in list_resp.json)

    update_resp = test_client.put(
        "/api/race-category/1/translations/cs/",
        json={"name": "Kola Upr", "description": "Upraveno"},
        headers=admin_auth_headers,
    )
    assert update_resp.status_code == 200

    translated_resp = test_client.get("/api/race-category/?lang=cs", headers=admin_auth_headers)
    assert translated_resp.status_code == 200
    assert translated_resp.json[0]["name"] == "Kola Upr"
    assert translated_resp.json[0]["description"] == "Upraveno"

    delete_resp = test_client.delete("/api/race-category/1/translations/cs/", headers=admin_auth_headers)
    assert delete_resp.status_code == 200
