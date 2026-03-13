import pytest
import io
from app import create_app, db
from app.models import Race, Team, Checkpoint, User, RaceCategory, Registration, Task, CheckpointLog, TaskLog, Image
from datetime import datetime, timedelta

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
    with test_app.app_context():
        now = datetime.now()
        some_time_earlier = now - timedelta(minutes=10)
        some_time_later = now + timedelta(minutes=10)
        race_category1 = RaceCategory(name="Kola", description="Na libovoln0m kole.")
        race1 = Race(name="Jarní jízda", description="24 hodin objevování Česka", start_showing_checkpoints_at=some_time_earlier,
                     end_showing_checkpoints_at=some_time_later, start_logging_at=some_time_earlier, end_logging_at=some_time_later)

        team1 = Team(name="Team1")
        team2 = Team(name="Team2")
        team3 = Team(name="Team3")

        user1 = User(name="User1", email="example1@example.com", is_administrator=True)
        user1.set_password("password")
        user2 = User(name="User2", email="example2@example.com")
        user2.set_password("password")
        team1.members = [user1, user2]

        user3 = User(name="User3", email="example3@example.com")
        user3.set_password("password")
        user4 = User(name="User4", email="example4@example.com")
        user4.set_password("password")
        team2.members = [user3, user4]

        user5 = User(name="User5", email="example5@example.com")
        user5.set_password("password")
        team3.members = [user5]

        checkpoint1 = Checkpoint(title="Checkpoint 1", latitude=50.0, longitude=14.0, description="Description", numOfPoints=1, race_id=1)
        checkpoint2 = Checkpoint(title="Checkpoint 2", latitude=50.0, longitude=14.5, description="Description", numOfPoints=2, race_id=1)
        checkpoint3 = Checkpoint(title="Checkpoint 3", latitude=50.5, longitude=15.0, description="Description", numOfPoints=1, race_id=1)

        registration1 = Registration(race_id=1, team_id=1, race_category_id=1, payment_confirmed=True)
        registration2 = Registration(race_id=1, team_id=2, race_category_id=1, payment_confirmed=True)
        registration3 = Registration(race_id=1, team_id=3, race_category_id=1, payment_confirmed=True)

        race1.race_categories = [race_category1]
        race1.registrations = [registration1, registration2, registration3]

        admin_u = User(name="Admin", email="admin@example.com", is_administrator=True)
        admin_u.set_password("password")
        reg_u = User(name="User", email="user@example.com", is_administrator=False)
        reg_u.set_password("password")
        team1.members.extend([admin_u, reg_u])

        db.session.add_all([race1, race_category1, team1, team2, team3, registration1, registration2, registration3, checkpoint1, checkpoint2, checkpoint3, admin_u, reg_u])
        db.session.commit()

        # seed tasks for status/log tests
        task1 = Task(title="Task 1", description="d1", numOfPoints=1, race_id=1)
        task2 = Task(title="Task 2", description="d2", numOfPoints=2, race_id=1)
        task3 = Task(title="Task 3", description="d3", numOfPoints=3, race_id=1)
        db.session.add_all([task1, task2, task3])
        db.session.commit()

@pytest.fixture
def add_test_data_early_logginmg(test_app):
    with test_app.app_context():
        now = datetime.now()
        in_5min = now + timedelta(minutes=5)
        in_15min = now + timedelta(minutes=15)
        race_category1 = RaceCategory(name="Kola", description="Na libovoln0m kole.")
        race1 = Race(name="Jarní jízda", description="24 hodin objevování Česka", start_showing_checkpoints_at=in_5min,
                     end_showing_checkpoints_at=in_15min, start_logging_at=in_5min, end_logging_at=in_15min)

        team1 = Team(name="Team1")

        user1 = User(name="User1", email="example1@example.com", is_administrator=True)
        user1.set_password("password")
        user2 = User(name="User2", email="example2@example.com")
        user2.set_password("password")
        team1.members = [user1, user2]


        checkpoint1 = Checkpoint(title="Checkpoint 1", latitude=50.0, longitude=14.0, description="Description", numOfPoints=1, race_id=1)
        checkpoint2 = Checkpoint(title="Checkpoint 2", latitude=50.0, longitude=14.5, description="Description", numOfPoints=2, race_id=1)

        registration1 = Registration(race_id=1, team_id=1, race_category_id=1, payment_confirmed=True)

        race1.race_categories = [race_category1]
        race1.registrations = [registration1]

        db.session.add_all([race1, race_category1, team1, registration1, checkpoint1, checkpoint2])
        db.session.commit()

@pytest.fixture
def add_test_data_late_logginmg(test_app):
    with test_app.app_context():
        now = datetime.now()
        before_5min = now - timedelta(minutes=5)
        before_15min = now - timedelta(minutes=15)

        race_category1 = RaceCategory(name="Kola", description="Na libovoln0m kole.")
        race1 = Race(name="Jarní jízda", description="24 hodin objevování Česka", start_showing_checkpoints_at=before_15min,
                     end_showing_checkpoints_at=before_5min, start_logging_at=before_15min, end_logging_at=before_5min)

        team1 = Team(name="Team1")

        user1 = User(name="User1", email="example1@example.com", is_administrator=True)
        user1.set_password("password")
        user2 = User(name="User2", email="example2@example.com")
        user2.set_password("password")
        team1.members = [user1, user2]

        checkpoint1 = Checkpoint(title="Checkpoint 1", latitude=50.0, longitude=14.0, description="Description", numOfPoints=1, race_id=1)
        checkpoint2 = Checkpoint(title="Checkpoint 2", latitude=50.0, longitude=14.5, description="Description", numOfPoints=2, race_id=1)

        registration1 = Registration(race_id=1, team_id=1, race_category_id=1, payment_confirmed=True)

        race1.race_categories = [race_category1]
        race1.registrations = [registration1]

        db.session.add_all([race1, race_category1, team1, registration1, checkpoint1, checkpoint2])
        db.session.commit()

def test_log_visit(test_client, add_test_data):
    response = test_client.post("/auth/login/", json={"email": "example1@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}

    # Test logging of single visit (user is an admin)
    response = test_client.post("/api/race/1/checkpoints/log/", headers = headers, json={"checkpoint_id": 1, "team_id": 1})
    assert response.status_code == 201
    assert response.json["checkpoint_id"] == 1
    assert response.json["team_id"] == 1
    assert response.json["race_id"] == 1

    # Test logging of single visit (user is member of the team)
    response = test_client.post("/auth/login/", json={"email": "example2@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}
    response = test_client.post("/api/race/1/checkpoints/log/", headers = headers, json={"checkpoint_id": 2, "team_id": 1})
    assert response.status_code == 201
    assert response.json["checkpoint_id"] == 2
    assert response.json["team_id"] == 1
    assert response.json["race_id"] == 1

    # Test logging of visit with image
    with open("tests/test_image.jpg", "rb") as img:
        data = {"image": img, "checkpoint_id": 3, "team_id": 1}
        response = test_client.post(
            "/api/race/1/checkpoints/log/",
            headers=headers,
            data=data,
            content_type='multipart/form-data'
        )
    assert response.status_code == 201
    assert response.json["checkpoint_id"] == 3
    assert response.json["team_id"] == 1
    assert response.json["image_id"] == 1

    # test logging of checkpoint visit by non-existing team
    response = test_client.post("/api/race/1/checkpoints/log/", headers = headers, json={"checkpoint_id": 2, "team_id": 4})
    assert response.status_code == 404

    # test logging of non-existing checkpoint team
    response = test_client.post("/api/race/1/checkpoints/log/", headers = headers, json={"checkpoint_id": 4, "team_id": 2})
    assert response.status_code == 403


def test_log_visit_duplicate_returns_conflict(test_client, add_test_data):
    response = test_client.post("/auth/login/", json={"email": "example2@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}

    first = test_client.post(
        "/api/race/1/checkpoints/log/",
        headers=headers,
        json={"checkpoint_id": 1, "team_id": 1},
    )
    assert first.status_code == 201

    duplicate = test_client.post(
        "/api/race/1/checkpoints/log/",
        headers=headers,
        json={"checkpoint_id": 1, "team_id": 1},
    )
    assert duplicate.status_code == 409
    assert "already logged" in duplicate.json["message"]


def test_log_visit_duplicate_with_image_does_not_orphan_image_row(test_client, test_app, add_test_data):
    response = test_client.post("/auth/login/", json={"email": "example2@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}

    first = test_client.post(
        "/api/race/1/checkpoints/log/",
        headers=headers,
        json={"checkpoint_id": 1, "team_id": 1},
    )
    assert first.status_code == 201

    with open("tests/test_image.jpg", "rb") as img:
        duplicate = test_client.post(
            "/api/race/1/checkpoints/log/",
            headers=headers,
            data={"image": img, "checkpoint_id": 1, "team_id": 1},
            content_type="multipart/form-data",
        )

    assert duplicate.status_code == 409

    with test_app.app_context():
        assert CheckpointLog.query.filter_by(race_id=1, team_id=1, checkpoint_id=1).count() == 1
        assert Image.query.count() == 0


def test_log_visit_rejects_non_image_payload_with_image_extension(test_client, add_test_data):
    response = test_client.post("/auth/login/", json={"email": "example2@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}

    data = {
        "image": (io.BytesIO(b"this is not an image"), "fake.jpg"),
        "checkpoint_id": "1",
        "team_id": "1",
    }
    resp = test_client.post(
        "/api/race/1/checkpoints/log/",
        headers=headers,
        data=data,
        content_type="multipart/form-data",
    )

    assert resp.status_code == 400
    assert "Invalid image" in resp.json["message"]


def test_log_visit_rejects_oversized_upload(test_client, test_app, add_test_data):
    test_app.config["MAX_CONTENT_LENGTH"] = 256
    response = test_client.post("/auth/login/", json={"email": "example2@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}

    data = {
        "image": (io.BytesIO(b"x" * 2048), "large.jpg"),
        "checkpoint_id": "1",
        "team_id": "1",
    }
    resp = test_client.post(
        "/api/race/1/checkpoints/log/",
        headers=headers,
        data=data,
        content_type="multipart/form-data",
    )

    assert resp.status_code == 413

def test_log_visit_early(test_client, add_test_data_early_logginmg):

    # Test logging of single visit (user is member of the team)
    response = test_client.post("/auth/login/", json={"email": "example2@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}
    response = test_client.post("/api/race/1/checkpoints/log/", headers = headers, json={"checkpoint_id": 2, "team_id": 1})
    assert response.status_code == 403

    # Test logging of single visit (user is an admin)
    response = test_client.post("/auth/login/", json={"email": "example1@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}
    response = test_client.post("/api/race/1/checkpoints/log/", headers = headers, json={"checkpoint_id": 1, "team_id": 1})
    assert response.status_code == 201
    assert response.json["checkpoint_id"] == 1
    assert response.json["team_id"] == 1
    assert response.json["race_id"] == 1

def test_log_visit_late(test_client, add_test_data_late_logginmg):

    # Test logging of single visit (user is member of the team)
    response = test_client.post("/auth/login/", json={"email": "example2@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}
    response = test_client.post("/api/race/1/checkpoints/log/", headers = headers, json={"checkpoint_id": 2, "team_id": 1})
    assert response.status_code == 403

    # Test logging of single visit (user is an admin)
    response = test_client.post("/auth/login/", json={"email": "example1@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}
    response = test_client.post("/api/race/1/checkpoints/log/", headers = headers, json={"checkpoint_id": 1, "team_id": 1})
    assert response.status_code == 201
    assert response.json["checkpoint_id"] == 1
    assert response.json["team_id"] == 1
    assert response.json["race_id"] == 1



def test_get_checkpoints_with_status(test_client, add_test_data):
    response = test_client.post("/auth/login/", json={"email": "example2@example.com", "password": "password"})
    headers1 = {"Authorization": f"Bearer {response.json['access_token']}"}

    # 0 visits
    response = test_client.get("/api/race/1/checkpoints/1/status/", headers = headers1)
    assert response.status_code == 200
    assert len(response.json) == 3
    assert response.json[0]["numOfPoints"] == 1
    assert response.json[0]["visited"] == False
    assert response.json[1]["visited"] == False
    assert response.json[2]["visited"] == False

    # 1 visit
    response = test_client.post("/api/race/1/checkpoints/log/", headers = headers1, json={"checkpoint_id": 1, "team_id": 1})
    response = test_client.get("/api/race/1/checkpoints/1/status/", headers = headers1)
    assert response.status_code == 200
    assert len(response.json) == 3
    assert response.json[0]["visited"] == True
    assert response.json[1]["visited"] == False
    assert response.json[2]["visited"] == False

    # 2 visits
    response = test_client.post("/api/race/1/checkpoints/log/", headers = headers1, json={"checkpoint_id": 3, "team_id": 1})
    response = test_client.get("/api/race/1/checkpoints/1/status/", headers = headers1)
    assert response.status_code == 200
    assert len(response.json) == 3
    assert response.json[0]["visited"] == True
    assert response.json[1]["visited"] == False
    assert response.json[2]["visited"] == True


def test_get_checkpoints_with_status_handles_missing_image_row(test_client, test_app, add_test_data):
    response = test_client.post("/auth/login/", json={"email": "example2@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}

    # Create a visit with image metadata.
    with open("tests/test_image.jpg", "rb") as img:
        data = {"image": img, "checkpoint_id": 1, "team_id": 1}
        log_response = test_client.post(
            "/api/race/1/checkpoints/log/",
            headers=headers,
            data=data,
            content_type="multipart/form-data",
        )
    assert log_response.status_code == 201

    # Simulate stale reference: remove the image row while checkpoint log still points to image_id.
    with test_app.app_context():
        visit = CheckpointLog.query.filter_by(race_id=1, team_id=1, checkpoint_id=1).first()
        assert visit is not None
        assert visit.image_id is not None
        stale_image_id = visit.image_id

        image = Image.query.filter_by(id=stale_image_id).first()
        assert image is not None
        db.session.delete(image)
        db.session.commit()

    # Endpoint should remain successful and simply omit missing image metadata.
    status_response = test_client.get("/api/race/1/checkpoints/1/status/", headers=headers)
    assert status_response.status_code == 200

    cp1 = next(item for item in status_response.json if item["id"] == 1)
    assert cp1["visited"] is True
    assert "image_filename" not in cp1

def test_unlog_visits(test_client, add_test_data):
    response = test_client.post("/auth/login/", json={"email": "example1@example.com", "password": "password"})
    admin_header = {"Authorization": f"Bearer {response.json['access_token']}"}

    response = test_client.post("/auth/login/", json={"email": "example2@example.com", "password": "password"})
    headers1 = {"Authorization": f"Bearer {response.json['access_token']}"}

    response = test_client.post("/auth/login/", json={"email": "example3@example.com", "password": "password"})
    headers2 = {"Authorization": f"Bearer {response.json['access_token']}"}

    response = test_client.post("/api/race/1/checkpoints/log/", headers = headers1, json={"checkpoint_id": 1, "team_id": 1})
    response = test_client.post("/api/race/1/checkpoints/log/", headers = headers1, json={"checkpoint_id": 2, "team_id": 1})
    response = test_client.post("/api/race/1/checkpoints/log/", headers = headers2, json={"checkpoint_id": 1, "team_id": 2})
    # team 1 visits checkpoint 1 and 2
    # team 2 visits checkpoint 1

    # delete visit of checkpoint 2
    response = test_client.delete("/api/race/1/checkpoints/log/", headers = headers1, json={"checkpoint_id": 2, "team_id": 1})
    assert response.status_code == 200
    response = test_client.get("/api/race/1/visits/1/", headers = headers1)
    assert response.status_code == 200
    assert len(response.json) == 1

    # test delete visit of non-existing visit
    response = test_client.delete("/api/race/1/checkpoints/log/", headers = headers1, json={"checkpoint_id": 2, "team_id": 1})
    assert response.status_code == 404

    # delete visit of checkpoint 2 (no visits for team 1 logged)
    response = test_client.delete("/api/race/1/checkpoints/log/", headers = headers1, json={"checkpoint_id": 1, "team_id": 1})
    assert response.status_code == 200
    response = test_client.get("/api/race/1/visits/1/", headers = headers1)
    assert response.status_code == 200
    assert len(response.json) == 0


def test_get_visits_by_team_includes_image_filename(test_client, add_test_data):
    response = test_client.post("/auth/login/", json={"email": "example2@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}

    with open("tests/test_image.jpg", "rb") as img:
        create_response = test_client.post(
            "/api/race/1/checkpoints/log/",
            headers=headers,
            data={"image": img, "checkpoint_id": 1, "team_id": 1},
            content_type="multipart/form-data",
        )
    assert create_response.status_code == 201

    response = test_client.get("/api/race/1/visits/1/", headers=headers)
    assert response.status_code == 200
    assert len(response.json) == 1
    image_filename = response.json[0].get("image_filename")
    assert image_filename
    assert image_filename.endswith(".jpg")


def test_unlog_visit_handles_missing_image_row(test_client, test_app, add_test_data):
    response = test_client.post("/auth/login/", json={"email": "example2@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}

    # Create visit with image first.
    with open("tests/test_image.jpg", "rb") as img:
        create_resp = test_client.post(
            "/api/race/1/checkpoints/log/",
            headers=headers,
            data={"image": img, "checkpoint_id": 1, "team_id": 1},
            content_type="multipart/form-data",
        )
    assert create_resp.status_code == 201

    # Simulate stale image_id by deleting image row while log still references it.
    with test_app.app_context():
        log = CheckpointLog.query.filter_by(race_id=1, team_id=1, checkpoint_id=1).first()
        assert log is not None
        assert log.image_id is not None
        image = Image.query.filter_by(id=log.image_id).first()
        assert image is not None
        db.session.delete(image)
        db.session.commit()

    # Unlog should still succeed even with missing image row.
    unlog_resp = test_client.delete(
        "/api/race/1/checkpoints/log/",
        headers=headers,
        json={"checkpoint_id": 1, "team_id": 1},
    )
    assert unlog_resp.status_code == 200
    assert unlog_resp.json["message"] == "Log deleted successfully."

    with test_app.app_context():
        assert CheckpointLog.query.filter_by(race_id=1, team_id=1, checkpoint_id=1).first() is None


def test_log_task_completion_by_team_member(test_client, add_test_data):
    """Test logging task completion by a team member"""
    response = test_client.post("/auth/login/", json={"email": "user@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}

    response = test_client.post("/api/race/1/tasks/log/", json={
        "task_id": 1,
        "team_id": 1
    }, headers=headers)
    assert response.status_code == 201
    assert response.json["task_id"] == 1
    assert response.json["team_id"] == 1
    assert response.json["race_id"] == 1

def test_log_task_completion_with_image(test_client, add_test_data):
    """Test logging task completion with image upload"""
    response = test_client.post("/auth/login/", json={"email": "user@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}

    # Test logging task with image
    with open("tests/test_image.jpg", "rb") as img:
        data = {"image": img, "task_id": 2, "team_id": 1}
        response = test_client.post(
            "/api/race/1/tasks/log/",
            headers=headers,
            data=data,
            content_type='multipart/form-data'
        )
    assert response.status_code == 201
    assert response.json["task_id"] == 2
    assert response.json["team_id"] == 1
    assert response.json["race_id"] == 1
    assert response.json["image_id"] == 1

def test_log_task_completion_by_admin(test_client, add_test_data):
    """Test logging task completion by admin"""
    response = test_client.post("/auth/login/", json={"email": "admin@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}

    response = test_client.post("/api/race/1/tasks/log/", json={
        "task_id": 2,
        "team_id": 1
    }, headers=headers)
    assert response.status_code == 201
    assert response.json["task_id"] == 2
    assert response.json["team_id"] == 1

def test_log_task_completion_duplicate(test_client, add_test_data):
    """Test that the same task cannot be logged twice by the same team"""
    response = test_client.post("/auth/login/", json={"email": "user@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}

    # First log
    response = test_client.post("/api/race/1/tasks/log/", json={
        "task_id": 1,
        "team_id": 1
    }, headers=headers)
    assert response.status_code == 201

    # Second log (should fail due to unique constraint)
    response = test_client.post("/api/race/1/tasks/log/", json={
        "task_id": 1,
        "team_id": 1
    }, headers=headers)
    assert response.status_code == 409  # Conflict
    assert "already logged" in response.json["message"]


def test_log_task_completion_duplicate_with_image_does_not_orphan_image_row(test_client, test_app, add_test_data):
    response = test_client.post("/auth/login/", json={"email": "user@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}

    first = test_client.post(
        "/api/race/1/tasks/log/",
        json={"task_id": 1, "team_id": 1},
        headers=headers,
    )
    assert first.status_code == 201

    with open("tests/test_image.jpg", "rb") as img:
        duplicate = test_client.post(
            "/api/race/1/tasks/log/",
            headers=headers,
            data={"image": img, "task_id": 1, "team_id": 1},
            content_type="multipart/form-data",
        )

    assert duplicate.status_code == 409
    assert "already logged" in duplicate.json["message"]

    with test_app.app_context():
        assert Image.query.count() == 0


def test_log_task_completion_rejects_non_image_payload_with_image_extension(test_client, add_test_data):
    response = test_client.post("/auth/login/", json={"email": "user@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}

    data = {
        "image": (io.BytesIO(b"this is not an image"), "fake.jpg"),
        "task_id": "1",
        "team_id": "1",
    }
    resp = test_client.post(
        "/api/race/1/tasks/log/",
        headers=headers,
        data=data,
        content_type="multipart/form-data",
    )

    assert resp.status_code == 400
    assert "Invalid image" in resp.json["message"]





def test_get_tasks_with_status(test_client, add_test_data):
    """Team member sees completion status per task"""
    response = test_client.post("/auth/login/", json={"email": "user@example.com", "password": "password"})
    headers_user = {"Authorization": f"Bearer {response.json['access_token']}"}

    # initial: none completed
    response = test_client.get("/api/race/1/tasks/1/status/", headers=headers_user)
    assert response.status_code == 200
    assert len(response.json) == 3
    assert all(not item["completed"] for item in response.json)

    # complete two tasks
    test_client.post("/api/race/1/tasks/log/", json={"task_id": 1, "team_id": 1}, headers=headers_user)
    test_client.post("/api/race/1/tasks/log/", json={"task_id": 3, "team_id": 1}, headers=headers_user)

    response = test_client.get("/api/race/1/tasks/1/status/", headers=headers_user)
    assert response.status_code == 200
    status_by_id = {item["id"]: item for item in response.json}
    assert status_by_id[1]["completed"] is True
    assert status_by_id[2]["completed"] is False
    assert status_by_id[3]["completed"] is True


def test_get_tasks_with_status_includes_image_filename(test_client, add_test_data):
    response = test_client.post("/auth/login/", json={"email": "user@example.com", "password": "password"})
    headers_user = {"Authorization": f"Bearer {response.json['access_token']}"}

    with open("tests/test_image.jpg", "rb") as img:
        create_resp = test_client.post(
            "/api/race/1/tasks/log/",
            headers=headers_user,
            data={"image": img, "task_id": 1, "team_id": 1},
            content_type="multipart/form-data",
        )
    assert create_resp.status_code == 201

    response = test_client.get("/api/race/1/tasks/1/status/", headers=headers_user)
    assert response.status_code == 200
    status_by_id = {item["id"]: item for item in response.json}
    image_filename = status_by_id[1].get("image_filename")
    assert image_filename
    assert image_filename.endswith(".jpg")


def test_get_task_completions_by_team_includes_image_filename(test_client, add_test_data):
    response = test_client.post("/auth/login/", json={"email": "user@example.com", "password": "password"})
    headers_user = {"Authorization": f"Bearer {response.json['access_token']}"}

    with open("tests/test_image.jpg", "rb") as img:
        create_resp = test_client.post(
            "/api/race/1/tasks/log/",
            headers=headers_user,
            data={"image": img, "task_id": 1, "team_id": 1},
            content_type="multipart/form-data",
        )
    assert create_resp.status_code == 201

    response = test_client.get("/api/race/1/task-completions/1/", headers=headers_user)
    assert response.status_code == 200
    assert len(response.json) == 1
    image_filename = response.json[0].get("image_filename")
    assert image_filename
    assert image_filename.endswith(".jpg")

def test_unlog_task_completion_by_team_member(test_client, add_test_data):
    """Test deleting task completion log by team member"""
    response = test_client.post("/auth/login/", json={"email": "user@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}

    # First log the task
    response = test_client.post("/api/race/1/tasks/log/", json={
        "task_id": 1,
        "team_id": 1
    }, headers=headers)
    assert response.status_code == 201

    # Now delete the log
    response = test_client.delete("/api/race/1/tasks/log/", json={
        "task_id": 1,
        "team_id": 1
    }, headers=headers)
    assert response.status_code == 200
    assert response.json["message"] == "Log deleted successfully."

def test_unlog_task_completion_by_admin(test_client, add_test_data):
    """Test deleting task completion log by admin"""
    # First log as user
    response = test_client.post("/auth/login/", json={"email": "user@example.com", "password": "password"})
    headers_user = {"Authorization": f"Bearer {response.json['access_token']}"}

    response = test_client.post("/api/race/1/tasks/log/", json={
        "task_id": 2,
        "team_id": 1
    }, headers=headers_user)
    assert response.status_code == 201

    # Delete as admin
    response = test_client.post("/auth/login/", json={"email": "admin@example.com", "password": "password"})
    headers_admin = {"Authorization": f"Bearer {response.json['access_token']}"}

    response = test_client.delete("/api/race/1/tasks/log/", json={
        "task_id": 2,
        "team_id": 1
    }, headers=headers_admin)
    assert response.status_code == 200
    assert response.json["message"] == "Log deleted successfully."


def test_unlog_task_completion_handles_missing_image_row(test_client, test_app, add_test_data):
    response = test_client.post("/auth/login/", json={"email": "user@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}

    with open("tests/test_image.jpg", "rb") as img:
        create_resp = test_client.post(
            "/api/race/1/tasks/log/",
            headers=headers,
            data={"image": img, "task_id": 1, "team_id": 1},
            content_type="multipart/form-data",
        )
    assert create_resp.status_code == 201

    with test_app.app_context():
        log = TaskLog.query.filter_by(race_id=1, team_id=1, task_id=1).first()
        assert log is not None
        assert log.image_id is not None
        image = Image.query.filter_by(id=log.image_id).first()
        assert image is not None
        db.session.delete(image)
        db.session.commit()

    unlog_resp = test_client.delete(
        "/api/race/1/tasks/log/",
        headers=headers,
        json={"task_id": 1, "team_id": 1},
    )
    assert unlog_resp.status_code == 200
    assert unlog_resp.json["message"] == "Log deleted successfully."

    with test_app.app_context():
        assert TaskLog.query.filter_by(race_id=1, team_id=1, task_id=1).first() is None


def test_get_tasks_with_status_handles_missing_image_row(test_client, test_app, add_test_data):
    response = test_client.post("/auth/login/", json={"email": "user@example.com", "password": "password"})
    headers_user = {"Authorization": f"Bearer {response.json['access_token']}"}

    with open("tests/test_image.jpg", "rb") as img:
        create_resp = test_client.post(
            "/api/race/1/tasks/log/",
            headers=headers_user,
            data={"image": img, "task_id": 1, "team_id": 1},
            content_type="multipart/form-data",
        )
    assert create_resp.status_code == 201

    with test_app.app_context():
        log = TaskLog.query.filter_by(race_id=1, team_id=1, task_id=1).first()
        assert log is not None
        assert log.image_id is not None
        image = Image.query.filter_by(id=log.image_id).first()
        assert image is not None
        db.session.delete(image)
        db.session.commit()

    response = test_client.get("/api/race/1/tasks/1/status/", headers=headers_user)
    assert response.status_code == 200
    status_by_id = {item["id"]: item for item in response.json}
    assert status_by_id[1]["completed"] is True
    assert "image_filename" not in status_by_id[1]

def test_unlog_task_completion_not_found(test_client, add_test_data):
    """Test deleting non-existent task log"""
    response = test_client.post("/auth/login/", json={"email": "user@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}

    response = test_client.delete("/api/race/1/tasks/log/", json={
        "task_id": 999,
        "team_id": 1
    }, headers=headers)
    assert response.status_code == 404
    assert response.json["message"] == "Log not found."


def test_get_checkpoints_with_status_unauthorized_user_forbidden(test_client, add_test_data):
    response = test_client.post("/auth/login/", json={"email": "example3@example.com", "password": "password"})
    headers_other = {"Authorization": f"Bearer {response.json['access_token']}"}
    denied = test_client.get("/api/race/1/checkpoints/1/status/", headers=headers_other)
    assert denied.status_code == 403


def test_log_task_completion_unauthorized_forbidden(test_client, add_test_data):
    response = test_client.post("/auth/login/", json={"email": "example3@example.com", "password": "password"})
    headers_other = {"Authorization": f"Bearer {response.json['access_token']}"}
    resp = test_client.post("/api/race/1/tasks/log/", json={"task_id": 1, "team_id": 1}, headers=headers_other)
    assert resp.status_code == 403


def test_log_visit_requires_paid_registration(test_client, test_app, add_test_data):
    """Team member cannot log checkpoint visit when payment is not confirmed."""
    with test_app.app_context():
        registration = Registration.query.filter_by(race_id=1, team_id=1).first()
        registration.payment_confirmed = False
        db.session.commit()

    response = test_client.post("/auth/login/", json={"email": "example2@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}

    denied = test_client.post(
        "/api/race/1/checkpoints/log/",
        headers=headers,
        json={"checkpoint_id": 1, "team_id": 1},
    )
    assert denied.status_code == 404


def test_log_task_requires_paid_registration(test_client, test_app, add_test_data):
    """Team member cannot log task completion when payment is not confirmed."""
    with test_app.app_context():
        registration = Registration.query.filter_by(race_id=1, team_id=1).first()
        registration.payment_confirmed = False
        db.session.commit()

    response = test_client.post("/auth/login/", json={"email": "example2@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}

    denied = test_client.post(
        "/api/race/1/tasks/log/",
        headers=headers,
        json={"task_id": 1, "team_id": 1},
    )
    assert denied.status_code == 404


def test_unlog_task_completion_unauthorized_forbidden_extra(test_client, add_test_data):
    # create as team member
    response = test_client.post("/auth/login/", json={"email": "example2@example.com", "password": "password"})
    headers_member = {"Authorization": f"Bearer {response.json['access_token']}"}
    test_client.post("/api/race/1/tasks/log/", json={"task_id": 1, "team_id": 1}, headers=headers_member)
    # try delete as other team member
    response = test_client.post("/auth/login/", json={"email": "example3@example.com", "password": "password"})
    headers_other = {"Authorization": f"Bearer {response.json['access_token']}"}
    denied = test_client.delete("/api/race/1/tasks/log/", json={"task_id": 1, "team_id": 1}, headers=headers_other)
    assert denied.status_code == 403


def test_get_tasks_with_status_unauthorized_user_forbidden(test_client, add_test_data):
    response = test_client.post("/auth/login/", json={"email": "example3@example.com", "password": "password"})
    headers_other = {"Authorization": f"Bearer {response.json['access_token']}"}
    denied = test_client.get("/api/race/1/tasks/1/status/", headers=headers_other)
    assert denied.status_code == 403
