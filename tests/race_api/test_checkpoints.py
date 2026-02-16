import pytest
from app import db
from app.models import Race, Checkpoint, User, CheckpointTranslation
from datetime import datetime, timedelta


@pytest.fixture
def add_test_data(test_app):
    """Seed a race with two checkpoints and an admin user."""
    with test_app.app_context():
        # Admin user used by legacy tests
        admin = User(name="Admin", email="example1@example.com", is_administrator=True)
        admin.set_password("password")
        db.session.add(admin)

        # Create a race with open logging window
        now = datetime.utcnow()
        race = Race(
            name="Test Race",
            start_showing_checkpoints_at=now,
            end_showing_checkpoints_at=now + timedelta(hours=2),
            start_logging_at=now - timedelta(hours=1),
            end_logging_at=now + timedelta(hours=1),
        )
        db.session.add(race)
        db.session.commit()

        # Checkpoints for race id=1
        cp1 = Checkpoint(
            title="Praha",
            latitude=50.0755381,
            longitude=14.4378005,
            description="Hlavní město České republiky",
            numOfPoints=1,
            race_id=race.id,
        )
        cp2 = Checkpoint(
            title="Brno",
            latitude=49.1950602,
            longitude=16.6068371,
            description="Město na jihu Moravy",
            numOfPoints=1,
            race_id=race.id,
        )
        db.session.add_all([cp1, cp2])
        db.session.commit()

        translation = CheckpointTranslation(
            checkpoint_id=cp1.id,
            language="cs",
            title="Kontrola 1",
            description="Prvni kontrola",
        )
        db.session.add(translation)
        db.session.commit()
        yield



def test_get_race_checkpoints(test_client, add_test_data, admin_auth_headers):
    """Test endpoint GET /api/race/race_id/checkpoints/checkpoint_id """
    response = test_client.get("/api/race/1/checkpoints/1/", headers=admin_auth_headers) # get first checkpoint
    assert response.status_code == 200
    assert response.json == {
        "id": 1, 
        "title": "Praha", 
        "latitude": 50.0755381, 
        "longitude": 14.4378005, 
        "description": "Hlavní město České republiky", 
        "numOfPoints": 1
    }

    response = test_client.get("/api/race/1/checkpoints/2/", headers=admin_auth_headers) # get second checkpoint
    assert response.status_code == 200
    assert response.json == {
        "id": 2, 
        "title": "Brno", 
        "latitude": 49.1950602, 
        "longitude": 16.6068371, 
        "description": "Město na jihu Moravy", 
        "numOfPoints": 1
    }

    response = test_client.get("/api/race/1/checkpoints/3/", headers=admin_auth_headers) # non existing checkpoint
    assert response.status_code == 404

    response = test_client.get("/api/race/2/checkpoints/1/", headers=admin_auth_headers) # non existing race
    assert response.status_code == 404

    response = test_client.get("/api/race/1/checkpoints/", headers=admin_auth_headers) # get all checkpoints for race
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

    response = test_client.get("/api/race/1/checkpoints/1/?lang=cs", headers=admin_auth_headers)
    assert response.status_code == 200
    assert response.json["title"] == "Kontrola 1"
    assert response.json["description"] == "Prvni kontrola"

    response = test_client.get("/api/race/1/checkpoints/?lang=cs", headers=admin_auth_headers)
    assert response.status_code == 200
    by_id = {item["id"]: item for item in response.json}
    assert by_id[1]["title"] == "Kontrola 1"
    assert by_id[1]["description"] == "Prvni kontrola"

def test_create_checkpoint(test_client, add_test_data, admin_auth_headers):
    response = test_client.post("/api/race/1/checkpoints/", json={
        "title": "Checkpoint 3", "description": "Třetí checkpoint", "latitude": 50.0955, "longitude": 14.4578, "numOfPoints": 3}, headers=admin_auth_headers)
    assert response.status_code == 201

    response = test_client.get("/api/checkpoint/3/", headers=admin_auth_headers)
    assert response.status_code == 200
    assert response.json["title"] == "Checkpoint 3"
    assert response.json["description"] == "Třetí checkpoint"
    assert response.json["latitude"] == 50.0955
    assert response.json["longitude"] == 14.4578
    assert response.json["numOfPoints"] == 3

    response = test_client.get("/api/race/1/checkpoints/", headers=admin_auth_headers)
    assert response.status_code == 200
    assert len(response.json) == 3


def test_create_checkpoint_multipart_form_admin(test_client, add_test_data, admin_auth_headers):
    # Create via multipart/form-data
    data = {
        "title": "Form CP",
        "description": "Created via form",
        "latitude": 50.1234,
        "longitude": 14.9876,
        "numOfPoints": 5,
    }
    resp = test_client.post(
        "/api/race/1/checkpoints/",
        data=data,
        headers=admin_auth_headers,
        content_type="multipart/form-data",
    )
    assert resp.status_code == 201
    assert resp.json["title"] == "Form CP"
    assert resp.json["numOfPoints"] == 5

    # Verify it appears in list
    list_resp = test_client.get("/api/race/1/checkpoints/", headers=admin_auth_headers)
    assert list_resp.status_code == 200
    assert any(cp["title"] == "Form CP" for cp in list_resp.json)


def test_create_checkpoint_array_payload_admin(test_client, add_test_data, admin_auth_headers):
    payload = [
        {"title": "Bulk A", "latitude": 50.2, "longitude": 14.2, "description": "A", "numOfPoints": 2},
        {"title": "Bulk B", "latitude": 50.3, "longitude": 14.3, "description": "B", "numOfPoints": 3},
    ]
    resp = test_client.post(
        "/api/race/1/checkpoints/",
        json=payload,
        headers=admin_auth_headers,
    )
    assert resp.status_code == 201
    assert isinstance(resp.json, list)
    assert len(resp.json) == 2
    titles = {item["title"] for item in resp.json}
    assert {"Bulk A", "Bulk B"} <= titles

    # Verify list includes new items
    list_resp = test_client.get("/api/race/1/checkpoints/", headers=admin_auth_headers)
    assert list_resp.status_code == 200
    list_titles = {cp["title"] for cp in list_resp.json}
    assert {"Bulk A", "Bulk B"} <= list_titles


def test_create_checkpoint_field_aliases_admin(test_client, add_test_data, admin_auth_headers):
    # Use aliases: name, lat, lng, desc, numPoints
    payload = {
        "name": "Alias CP",
        "lat": 50.4444,
        "lng": 14.5555,
        "desc": "Using aliases",
        "numPoints": 7,
    }
    resp = test_client.post(
        "/api/race/1/checkpoints/",
        json=payload,
        headers=admin_auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json["title"] == "Alias CP"
    assert resp.json["latitude"] == 50.4444
    assert resp.json["longitude"] == 14.5555
    assert resp.json["description"] == "Using aliases"
    assert resp.json["numOfPoints"] == 7


def test_create_checkpoint_missing_title_400(test_client, add_test_data, admin_auth_headers):
    # Missing both 'title' and 'name' should yield 400
    resp = test_client.post(
        "/api/race/1/checkpoints/",
        json={"description": "no title"},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 400
    assert "errors" in resp.json
    assert "title" in str(resp.json["errors"])


def test_create_checkpoint_invalid_race_404(test_client, add_test_data, admin_auth_headers):
    resp = test_client.post(
        "/api/race/999/checkpoints/",
        json={"title": "Invalid Race"},
        headers=admin_auth_headers,
    )
    assert resp.status_code == 404
    assert resp.json.get("message") == "Race not found"


def test_create_checkpoint_non_admin_forbidden_403(test_client, add_test_data, regular_user_auth_headers):
    resp = test_client.post(
        "/api/race/1/checkpoints/",
        json={"title": "No Admin"},
        headers=regular_user_auth_headers,
    )
    assert resp.status_code == 403
