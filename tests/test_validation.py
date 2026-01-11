"""
Comprehensive validation tests for all endpoints with Marshmallow schemas.
Tests cover:
- Missing required fields
- Invalid data types
- Invalid field values (boundary checks)
- Valid payloads with optional fields
"""

import pytest
from datetime import datetime, timedelta
from app import db
from app.models import User, Race, RaceCategory, Team, Checkpoint, Task


@pytest.fixture
def admin_token(test_client):
    """Create an admin user and return their access token"""
    test_client.post("/auth/register/", json={
        "name": "Admin",
        "email": "admin@example.com",
        "password": "admin123",
        "is_administrator": True
    })
    response = test_client.post("/auth/login/", json={
        "email": "admin@example.com",
        "password": "admin123"
    })
    return response.json['access_token']


@pytest.fixture
def test_race(test_app):
    """Create a test race"""
    with test_app.app_context():
        now = datetime.now()
        race = Race(
            name="Test Race",
            description="Test Description",
            start_showing_checkpoints_at=now,
            end_showing_checkpoints_at=now + timedelta(hours=1),
            start_logging_at=now,
            end_logging_at=now + timedelta(hours=2)
        )
        db.session.add(race)
        db.session.commit()
        return race.id


# ============================================================================
# Auth Validation Tests
# ============================================================================

class TestAuthValidation:
    """Validate auth endpoints"""

    def test_register_missing_email(self, test_client):
        """Missing email should return 400"""
        response = test_client.post("/auth/register/", json={
            "name": "Test User",
            "password": "password123"
        })
        assert response.status_code == 400

    def test_register_missing_password(self, test_client):
        """Missing password should return 400"""
        response = test_client.post("/auth/register/", json={
            "name": "Test User",
            "email": "test@example.com"
        })
        assert response.status_code == 400

    def test_register_invalid_email_format(self, test_client):
        """Invalid email format should return 400"""
        response = test_client.post("/auth/register/", json={
            "name": "Test User",
            "email": "not-an-email",
            "password": "password123"
        })
        assert response.status_code == 400

    def test_register_valid_with_optional_fields(self, test_client):
        """Valid registration with all optional fields"""
        response = test_client.post("/auth/register/", json={
            "name": "Test User",
            "email": "valid@example.com",
            "password": "password123",
            "is_administrator": False
        })
        assert response.status_code == 201

    def test_login_missing_email(self, test_client):
        """Missing email in login should return 400"""
        response = test_client.post("/auth/login/", json={
            "password": "password123"
        })
        assert response.status_code == 400

    def test_login_missing_password(self, test_client):
        """Missing password in login should return 400"""
        response = test_client.post("/auth/login/", json={
            "email": "test@example.com"
        })
        assert response.status_code == 400

    def test_login_invalid_email_format(self, test_client):
        """Invalid email format in login should return 400"""
        response = test_client.post("/auth/login/", json={
            "email": "invalid-email",
            "password": "password123"
        })
        assert response.status_code == 400

    def test_password_reset_request_missing_email(self, test_client):
        """Missing email in password reset request should return 400"""
        response = test_client.post("/auth/request-password-reset/", json={})
        assert response.status_code == 400
        assert response.json["msg"] == "Email is required"

    def test_password_reset_request_invalid_email(self, test_client):
        """Invalid email format in password reset should return 400"""
        response = test_client.post("/auth/request-password-reset/", json={
            "email": "invalid-email"
        })
        assert response.status_code == 400

    def test_password_reset_missing_token(self, test_client):
        """Missing token in password reset should return 400"""
        response = test_client.post("/auth/reset-password/", json={
            "new_password": "newpass123"
        })
        assert response.status_code == 400

    def test_password_reset_missing_password(self, test_client):
        """Missing password in reset should return 400"""
        response = test_client.post("/auth/reset-password/", json={
            "token": "some-token"
        })
        assert response.status_code == 400


# ============================================================================
# Race Category Validation Tests
# ============================================================================

class TestRaceCategoryValidation:
    """Validate race category endpoints"""

    def test_create_race_category_missing_name(self, test_client, admin_token):
        """Missing name should return 400"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = test_client.post("/api/race-category/", json={
            "description": "Test category"
        }, headers=headers)
        assert response.status_code == 400

    def test_create_race_category_empty_name(self, test_client, admin_token):
        """Empty name should return 400"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = test_client.post("/api/race-category/", json={
            "name": "",
            "description": "Test category"
        }, headers=headers)
        assert response.status_code == 400

    def test_create_race_category_valid_minimal(self, test_client, admin_token):
        """Valid category with only name"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = test_client.post("/api/race-category/", json={
            "name": "Beginner"
        }, headers=headers)
        assert response.status_code == 201
        assert response.json["name"] == "Beginner"
        assert response.json["description"] == ""

    def test_create_race_category_valid_with_description(self, test_client, admin_token):
        """Valid category with name and description"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = test_client.post("/api/race-category/", json={
            "name": "Advanced",
            "description": "For experienced racers"
        }, headers=headers)
        assert response.status_code == 201
        assert response.json["name"] == "Advanced"
        assert response.json["description"] == "For experienced racers"


# ============================================================================
# Checkpoint Validation Tests
# ============================================================================

class TestCheckpointValidation:
    """Validate checkpoint endpoints"""

    def test_update_checkpoint_empty_title(self, test_client, admin_token, test_app, test_race):
        """Empty title should return 400"""
        with test_app.app_context():
            checkpoint = Checkpoint(
                title="Original",
                description="Test",
                latitude=50.0,
                longitude=14.0,
                numOfPoints=1,
                race_id=test_race
            )
            db.session.add(checkpoint)
            db.session.commit()
            cp_id = checkpoint.id

        headers = {"Authorization": f"Bearer {admin_token}"}
        response = test_client.put(f"/api/checkpoint/{cp_id}/", json={
            "title": ""
        }, headers=headers)
        assert response.status_code == 400

    def test_update_checkpoint_negative_points(self, test_client, admin_token, test_app, test_race):
        """Negative numOfPoints should return 400"""
        with test_app.app_context():
            checkpoint = Checkpoint(
                title="Original",
                description="Test",
                latitude=50.0,
                longitude=14.0,
                numOfPoints=1,
                race_id=test_race
            )
            db.session.add(checkpoint)
            db.session.commit()
            cp_id = checkpoint.id

        headers = {"Authorization": f"Bearer {admin_token}"}
        response = test_client.put(f"/api/checkpoint/{cp_id}/", json={
            "numOfPoints": -5
        }, headers=headers)
        assert response.status_code == 400

    def test_update_checkpoint_invalid_latitude_type(self, test_client, admin_token, test_app, test_race):
        """Non-numeric latitude should return 400"""
        with test_app.app_context():
            checkpoint = Checkpoint(
                title="Original",
                description="Test",
                latitude=50.0,
                longitude=14.0,
                numOfPoints=1,
                race_id=test_race
            )
            db.session.add(checkpoint)
            db.session.commit()
            cp_id = checkpoint.id

        headers = {"Authorization": f"Bearer {admin_token}"}
        response = test_client.put(f"/api/checkpoint/{cp_id}/", json={
            "latitude": "not-a-number"
        }, headers=headers)
        assert response.status_code == 400

    def test_update_checkpoint_valid_partial(self, test_client, admin_token, test_app, test_race):
        """Valid partial update with only some fields"""
        with test_app.app_context():
            checkpoint = Checkpoint(
                title="Original",
                description="Test",
                latitude=50.0,
                longitude=14.0,
                numOfPoints=1,
                race_id=test_race
            )
            db.session.add(checkpoint)
            db.session.commit()
            cp_id = checkpoint.id

        headers = {"Authorization": f"Bearer {admin_token}"}
        response = test_client.put(f"/api/checkpoint/{cp_id}/", json={
            "title": "Updated",
            "numOfPoints": 5
        }, headers=headers)
        assert response.status_code == 200
        assert response.json["title"] == "Updated"
        assert response.json["numOfPoints"] == 5


# ============================================================================
# Task Validation Tests
# ============================================================================

class TestTaskValidation:
    """Validate task endpoints"""

    def test_update_task_empty_title(self, test_client, admin_token, test_app, test_race):
        """Empty title should return 400"""
        with test_app.app_context():
            task = Task(
                title="Original",
                description="Test",
                numOfPoints=1,
                race_id=test_race
            )
            db.session.add(task)
            db.session.commit()
            task_id = task.id

        headers = {"Authorization": f"Bearer {admin_token}"}
        response = test_client.put(f"/api/task/{task_id}/", json={
            "title": ""
        }, headers=headers)
        assert response.status_code == 400

    def test_update_task_zero_points(self, test_client, admin_token, test_app, test_race):
        """Zero numOfPoints should return 400 (minimum is 1)"""
        with test_app.app_context():
            task = Task(
                title="Original",
                description="Test",
                numOfPoints=1,
                race_id=test_race
            )
            db.session.add(task)
            db.session.commit()
            task_id = task.id

        headers = {"Authorization": f"Bearer {admin_token}"}
        response = test_client.put(f"/api/task/{task_id}/", json={
            "numOfPoints": 0
        }, headers=headers)
        assert response.status_code == 400

    def test_update_task_negative_points(self, test_client, admin_token, test_app, test_race):
        """Negative numOfPoints should return 400"""
        with test_app.app_context():
            task = Task(
                title="Original",
                description="Test",
                numOfPoints=1,
                race_id=test_race
            )
            db.session.add(task)
            db.session.commit()
            task_id = task.id

        headers = {"Authorization": f"Bearer {admin_token}"}
        response = test_client.put(f"/api/task/{task_id}/", json={
            "numOfPoints": -3
        }, headers=headers)
        assert response.status_code == 400

    def test_update_task_valid_partial(self, test_client, admin_token, test_app, test_race):
        """Valid partial update"""
        with test_app.app_context():
            task = Task(
                title="Original",
                description="Test",
                numOfPoints=1,
                race_id=test_race
            )
            db.session.add(task)
            db.session.commit()
            task_id = task.id

        headers = {"Authorization": f"Bearer {admin_token}"}
        response = test_client.put(f"/api/task/{task_id}/", json={
            "title": "Updated Task",
            "numOfPoints": 10
        }, headers=headers)
        assert response.status_code == 200
        assert response.json["title"] == "Updated Task"
        assert response.json["numOfPoints"] == 10


# ============================================================================
# Team Validation Tests
# ============================================================================

class TestTeamValidation:
    """Validate team endpoints"""

    def test_create_team_missing_name(self, test_client):
        """Missing name should return 400"""
        response = test_client.post("/api/team/", json={})
        assert response.status_code == 400

    def test_create_team_empty_name(self, test_client):
        """Empty name should return 400"""
        response = test_client.post("/api/team/", json={
            "name": ""
        })
        assert response.status_code == 400

    def test_create_team_valid(self, test_client):
        """Valid team creation"""
        response = test_client.post("/api/team/", json={
            "name": "Team Alpha"
        })
        assert response.status_code == 201
        assert response.json["name"] == "Team Alpha"

    def test_add_members_missing_user_ids(self, test_client, test_app):
        """Missing user_ids should return 400"""
        # First create a team
        with test_app.app_context():
            team = Team(name="Team Beta")
            db.session.add(team)
            db.session.commit()
            team_id = team.id

        response = test_client.post(f"/api/team/{team_id}/members/", json={})
        assert response.status_code == 400

    def test_add_members_empty_user_ids_list(self, test_client, test_app):
        """Empty user_ids list should return 400"""
        # First create a team
        with test_app.app_context():
            team = Team(name="Team Gamma")
            db.session.add(team)
            db.session.commit()
            team_id = team.id

        response = test_client.post(f"/api/team/{team_id}/members/", json={
            "user_ids": []
        })
        assert response.status_code == 400

    def test_add_members_non_integer_user_id(self, test_client, test_app):
        """Non-integer user_id should return 400"""
        # First create a team
        with test_app.app_context():
            team = Team(name="Team Delta")
            db.session.add(team)
            db.session.commit()
            team_id = team.id

        response = test_client.post(f"/api/team/{team_id}/members/", json={
            "user_ids": ["not-an-integer"]
        })
        assert response.status_code == 400

    def test_signup_team_for_race_missing_team_id(self, test_client, test_race):
        """Missing team_id in signup should return 400"""
        response = test_client.post(f"/api/team/race/{test_race}/", json={
            "race_category_id": 1
        })
        assert response.status_code == 400

    def test_signup_team_for_race_missing_category_id(self, test_client, test_race):
        """Missing race_category_id in signup should return 400"""
        response = test_client.post(f"/api/team/race/{test_race}/", json={
            "team_id": 1
        })
        assert response.status_code == 400

    def test_signup_team_for_race_invalid_team_id_type(self, test_client, test_race):
        """Non-integer team_id should return 400"""
        response = test_client.post(f"/api/team/race/{test_race}/", json={
            "team_id": "not-integer",
            "race_category_id": 1
        })
        assert response.status_code == 400

    def test_signup_team_for_race_invalid_category_id_type(self, test_client, test_race):
        """Non-integer race_category_id should return 400"""
        response = test_client.post(f"/api/team/race/{test_race}/", json={
            "team_id": 1,
            "race_category_id": "not-integer"
        })
        assert response.status_code == 400


# ============================================================================
# Note: race_api race_categories endpoints are tested via the race API
# and do not require additional validation tests as they follow the same
# validation patterns as other endpoints with proper error handling
# ============================================================================

