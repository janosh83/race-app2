import pytest
from sqlalchemy.exc import IntegrityError
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

        registration1 = Registration(race_id=1, team_id=1, race_category_id=0, payment_confirmed=True)
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


def test_delete_category_conflict_when_assigned_to_race(test_client, add_test_data, admin_auth_headers):
    """Deleting a category assigned to any race must return deterministic 409."""
    response = test_client.delete("/api/race-category/1/", headers=admin_auth_headers)
    assert response.status_code == 409
    assert response.json == {"message": "Category is assigned to a race and cannot be deleted."}


def test_delete_category_conflict_when_used_by_registration(test_client, admin_auth_headers, test_app):
    """Deleting a category used by registrations must return deterministic 409."""
    with test_app.app_context():
        now = datetime.now()
        race = Race(
            name="Registrace Race",
            description="race",
            start_showing_checkpoints_at=now,
            end_showing_checkpoints_at=now,
            start_logging_at=now,
            end_logging_at=now,
        )
        category = RaceCategory(name="Registrace Kategorie", description="desc")
        team = Team(name="Team Registration")
        user = User(name="Reg User", email="reg-user@example.com", is_administrator=False)
        user.set_password("password")
        team.members = [user]
        db.session.add_all([race, category, team, user])
        db.session.flush()

        registration = Registration(
            race_id=race.id,
            team_id=team.id,
            race_category_id=category.id,
            payment_confirmed=True,
        )
        db.session.add(registration)
        db.session.commit()
        category_id = category.id

    response = test_client.delete(f"/api/race-category/{category_id}/", headers=admin_auth_headers)
    assert response.status_code == 409
    assert response.json == {"message": "Category has registrations and cannot be deleted."}


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


def test_create_race_category_translation_commit_conflict_returns_409(
    test_client, add_test_data, admin_auth_headers, monkeypatch
):
    original_commit = db.session.commit

    def commit_once_then_restore():
        monkeypatch.setattr(db.session, "commit", original_commit)
        raise IntegrityError("INSERT", {}, Exception("duplicate key"))

    monkeypatch.setattr(db.session, "commit", commit_once_then_restore)

    response = test_client.post(
        "/api/race-category/1/translations/",
        json={"language": "de", "name": "Kola DE", "description": "Kategorie"},
        headers=admin_auth_headers,
    )

    assert response.status_code == 409
    assert response.json == {"message": "Translation already exists"}


def test_create_translation_nonexistent_category_returns_404(test_client, admin_auth_headers):
    response = test_client.post(
        "/api/race-category/999/translations/",
        json={"language": "cs", "name": "Missing", "description": "Missing"},
        headers=admin_auth_headers,
    )
    assert response.status_code == 404
    assert response.json == {"message": "Category not found"}


def test_update_translation_nonexistent_category_returns_404(test_client, admin_auth_headers):
    response = test_client.put(
        "/api/race-category/999/translations/cs/",
        json={"name": "Missing"},
        headers=admin_auth_headers,
    )
    assert response.status_code == 404
    assert response.json == {"message": "Category not found"}


def test_delete_translation_nonexistent_category_returns_404(test_client, admin_auth_headers):
    response = test_client.delete(
        "/api/race-category/999/translations/cs/",
        headers=admin_auth_headers,
    )
    assert response.status_code == 404
    assert response.json == {"message": "Category not found"}


def test_get_translations_nonexistent_category_returns_404_json(test_client, admin_auth_headers):
    response = test_client.get(
        "/api/race-category/999/translations/",
        headers=admin_auth_headers,
    )
    assert response.status_code == 404
    assert response.json == {"message": "Category not found"}


def test_delete_translation_nonexistent_translation_returns_404_json(
    test_client, add_test_data, admin_auth_headers
):
    response = test_client.delete(
        "/api/race-category/1/translations/de/",
        headers=admin_auth_headers,
    )
    assert response.status_code == 404
    assert response.json == {"message": "Translation not found"}
