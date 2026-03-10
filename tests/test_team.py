import pytest
from sqlalchemy.exc import IntegrityError
from app import db
from app.models import Race, Team, RaceCategory, Registration, RegistrationPaymentAttempt, User
from datetime import datetime, timedelta

@pytest.fixture
def add_test_data(test_app):
    # Vložení testovacích dat
    with test_app.app_context():
        now = datetime.now()
        some_time_earlier = now - timedelta(minutes=10)
        some_time_later = now + timedelta(minutes=10)
        race1 = Race(name="Jarní jízda", description="24 hodin objevování Česka", start_showing_checkpoints_at=some_time_earlier,
                     end_showing_checkpoints_at=some_time_earlier, start_logging_at=some_time_later, end_logging_at=some_time_later)
        race2 = Race(name="Hill Bill Rally", description="Roadtrip po Balkáně", start_showing_checkpoints_at=some_time_earlier,
                     end_showing_checkpoints_at=some_time_earlier, start_logging_at=some_time_later, end_logging_at=some_time_later)

        race_category1 = RaceCategory(name="Motorka", description="Pro v3echny motorkáře")
        race_category2 = RaceCategory(name="Auto", description="Pro motoristy")

        race1.categories.append(race_category2)
        race2.categories.append(race_category1)
        race2.categories.append(race_category2)

        team1 = Team(name="Team1")
        team2 = Team(name="Team2")
        team3 = Team(name="Team3")

        db.session.add_all([race1, race2, race_category1, race_category2, team1, team2, team3])
        db.session.commit()

def test_get_teams(test_client, add_test_data):
    response = test_client.get("/api/team/")
    assert response.status_code == 200
    assert response.json == [
        {"id": 1, "name": "Team1"},
        {"id": 2, "name": "Team2"},
        {"id": 3, "name": "Team3"}
    ]

def test_get_single_team(test_client, add_test_data):
    response = test_client.get("/api/team/1/")
    assert response.status_code == 200
    assert response.json == {"id": 1, "name": "Team1"}

    response = test_client.get("/api/team/4/") # non existing team
    assert response.status_code == 404


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


def test_add_members_by_member_details_creates_users(test_client, add_test_data):
    """Members payload with name/email creates users and assigns them to team."""
    response = test_client.post(
        "/api/team/1/members/",
        json={
            "members": [
                {"name": "Alice", "email": "alice@example.com"},
                {"name": "Bob", "email": "bob@example.com"},
            ]
        },
    )
    assert response.status_code == 201
    assert response.json["team_id"] == 1
    assert len(response.json["user_ids"]) == 2

    response = test_client.get("/api/team/1/members/")
    assert response.status_code == 200
    assert response.json == [{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]


def test_add_members_by_member_details_sets_preferred_language(test_client, add_test_data, test_app):
    """Members payload stores preferred_language for newly created users."""
    response = test_client.post(
        "/api/team/1/members/",
        json={
            "members": [
                {"name": "Alice", "email": "alice-lang@example.com", "preferred_language": "cs"},
                {"name": "Bob", "email": "bob-lang@example.com", "preferred_language": "de"},
            ]
        },
    )
    assert response.status_code == 201

    with test_app.app_context():
        alice = User.query.filter_by(email="alice-lang@example.com").first()
        bob = User.query.filter_by(email="bob-lang@example.com").first()
        assert alice is not None
        assert bob is not None
        assert alice.preferred_language == "cs"
        assert bob.preferred_language == "de"

def test_team_signup(test_client, add_test_data, admin_auth_headers):
    # Test přihlášení týmu k závodu
    response = test_client.post("/api/team/race/1/", json={"team_id": 1, "race_category_id": 1}, headers=admin_auth_headers) # race category id 1 = Auto, OK for race Jarní jízda
    assert response.status_code == 201
    assert response.json == {"team_id": 1, "race_id": 1, 'race_category': 'Auto'}

    # Test získání týmů podle závodu
    response = test_client.post("/api/team/race/1/", json={"team_id": 2, "race_category_id": 1}, headers=admin_auth_headers) # race category id 1 = Auto, OK for race Jarní jízda
    response = test_client.get("/api/team/race/1/", headers=admin_auth_headers)
    assert len(response.json) == 2
    first = response.json[0]
    second = response.json[1]

    assert first["id"] == 1
    assert first["name"] == "Team1"
    assert first["members"] == []
    assert first["race_category"] == "Auto"
    assert first["email_sent"] is False
    assert first["disqualified"] is False
    assert first["payment_confirmed"] is False
    assert first["payment_details"]["attempts"] == []

    assert second["id"] == 2
    assert second["name"] == "Team2"
    assert second["members"] == []
    assert second["race_category"] == "Auto"
    assert second["email_sent"] is False
    assert second["disqualified"] is False
    assert second["payment_confirmed"] is False
    assert second["payment_details"]["attempts"] == []


# Additional tests for GET /team/race/<race_id>/

def test_get_teams_by_race_not_found(test_client, add_test_data, admin_auth_headers):
    """Test getting teams for non-existent race returns empty list."""
    response = test_client.get("/api/team/race/999/", headers=admin_auth_headers)
    assert response.status_code == 200
    assert response.json == []


def test_get_teams_by_race_no_teams(test_client, add_test_data, admin_auth_headers):
    """Test getting teams for race with no registrations returns empty list."""
    # Race 2 has no registered teams
    response = test_client.get("/api/team/race/2/", headers=admin_auth_headers)
    assert response.status_code == 200
    assert response.json == []


# Additional tests for POST /team/race/<race_id>/

def test_team_signup_team_not_found(test_client, add_test_data):
    """Test signing up non-existent team returns 404."""
    response = test_client.post("/api/team/race/1/", json={"team_id": 999, "race_category_id": 1})
    assert response.status_code == 404


def test_team_signup_race_not_found(test_client, add_test_data):
    """Test signing up team to non-existent race returns 404."""
    response = test_client.post("/api/team/race/999/", json={"team_id": 1, "race_category_id": 1})
    assert response.status_code == 404


def test_team_signup_race_category_not_found(test_client, add_test_data):
    """Test signing up with non-existent race category returns 404."""
    response = test_client.post("/api/team/race/1/", json={"team_id": 1, "race_category_id": 999})
    assert response.status_code == 404


def test_team_signup_category_not_available_for_race(test_client, add_test_data):
    """Test signing up with category not available for race returns 400."""
    # Race 1 (Jarní jízda) only has category 1 (Auto), not category 2 (Motorka)
    response = test_client.post("/api/team/race/1/", json={"team_id": 1, "race_category_id": 2})
    assert response.status_code == 400
    assert "Category not available for the race" in response.json["message"]


def test_team_signup_duplicate_returns_409(test_client, add_test_data):
    """Duplicate team signup should return deterministic 409."""
    first = test_client.post("/api/team/race/1/", json={"team_id": 1, "race_category_id": 1})
    assert first.status_code == 201

    duplicate = test_client.post("/api/team/race/1/", json={"team_id": 1, "race_category_id": 1})
    assert duplicate.status_code == 409
    assert duplicate.json == {"message": "Team is already registered for this race"}


def test_team_signup_commit_conflict_returns_409(test_client, add_test_data, monkeypatch):
    """Commit-time unique conflict in signup should return deterministic 409."""
    original_commit = db.session.commit

    def fail_once_then_restore():
        monkeypatch.setattr(db.session, "commit", original_commit)
        raise IntegrityError("INSERT", {}, Exception("duplicate key"))

    monkeypatch.setattr(db.session, "commit", fail_once_then_restore)

    response = test_client.post("/api/team/race/1/", json={"team_id": 1, "race_category_id": 1})
    assert response.status_code == 409
    assert response.json == {"message": "Team is already registered for this race"}


# Additional tests for POST /<team_id>/members/

def test_add_members_team_not_found(test_client, add_test_data):
    """Test adding members to non-existent team returns 404."""
    response = test_client.post("/auth/register/", json={"name": "John", "email": "john@example.com", "password": "password"})
    assert response.status_code == 201

    response = test_client.post("/api/team/999/members/", json={"user_ids": [1]})
    assert response.status_code == 404


def test_add_members_user_not_found(test_client, add_test_data):
    """Test adding non-existent user to team returns 404."""
    response = test_client.post("/api/team/1/members/", json={"user_ids": [999]})
    assert response.status_code == 404


def test_add_members_empty_array(test_client, add_test_data):
    """Test adding empty array of members."""
    response = test_client.post("/api/team/1/members/", json={"user_ids": []})
    assert response.status_code == 400


# Additional tests for GET /<team_id>/members/

def test_get_members_team_not_found(test_client, add_test_data):
    """Test getting members of non-existent team returns 404."""
    response = test_client.get("/api/team/999/members/")
    assert response.status_code == 404


# Tests for DELETE /<team_id>/members/ (admin only)

def test_remove_all_members_success(test_client, add_test_data, admin_auth_headers):
    """Test removing all members from team as admin."""
    # Add members first
    response = test_client.post("/auth/register/", json={"name": "John", "email": "john@example.com", "password": "password"})
    response = test_client.post("/auth/register/", json={"name": "Peter", "email": "peter@example.com", "password": "password"})
    response = test_client.post("/api/team/1/members/", json={"user_ids": [1, 2]})
    assert response.status_code == 201

    # Verify members were added
    response = test_client.get("/api/team/1/members/")
    assert len(response.json) == 2

    # Remove all members
    response = test_client.delete("/api/team/1/members/", headers=admin_auth_headers)
    assert response.status_code == 200
    assert response.json["message"] == "All members removed successfully"

    # Verify members were removed
    response = test_client.get("/api/team/1/members/")
    assert response.json == []


def test_remove_all_members_team_not_found(test_client, add_test_data, admin_auth_headers):
    """Test removing members from non-existent team returns 404."""
    response = test_client.delete("/api/team/999/members/", headers=admin_auth_headers)
    assert response.status_code == 404


def test_remove_all_members_unauthorized(test_client, add_test_data):
    """Test removing members without JWT returns 401."""
    response = test_client.delete("/api/team/1/members/")
    assert response.status_code == 401


def test_remove_all_members_forbidden_non_admin(test_client, add_test_data, regular_user_auth_headers):
    """Test removing members as non-admin returns 403."""
    response = test_client.delete("/api/team/1/members/", headers=regular_user_auth_headers)
    assert response.status_code == 403


# Tests for DELETE /<team_id>/ (admin only)

def test_delete_team_success(test_client, add_test_data, admin_auth_headers):
    """Test deleting team without members as admin."""
    # Team 3 has no members
    response = test_client.delete("/api/team/3/", headers=admin_auth_headers)
    assert response.status_code == 200
    assert response.json["message"] == "Team deleted successfully"

    # Verify team is deleted
    response = test_client.get("/api/team/3/")
    assert response.status_code == 404


def test_delete_team_with_members(test_client, add_test_data, admin_auth_headers):
    """Test deleting team with members returns 400."""
    # Add members to team 1
    response = test_client.post("/auth/register/", json={"name": "John", "email": "john@example.com", "password": "password"})
    response = test_client.post("/api/team/1/members/", json={"user_ids": [1]})
    assert response.status_code == 201

    # Try to delete team with members
    response = test_client.delete("/api/team/1/", headers=admin_auth_headers)
    assert response.status_code == 400
    assert "Cannot delete the team" in response.json["message"]
    assert "has members" in response.json["message"]


def test_delete_team_not_found(test_client, add_test_data, admin_auth_headers):
    """Test deleting non-existent team returns 404."""
    response = test_client.delete("/api/team/999/", headers=admin_auth_headers)
    assert response.status_code == 404


def test_delete_team_unauthorized(test_client, add_test_data):
    """Test deleting team without JWT returns 401."""
    response = test_client.delete("/api/team/1/")
    assert response.status_code == 401


def test_delete_team_forbidden_non_admin(test_client, add_test_data, regular_user_auth_headers):
    """Test deleting team as non-admin returns 403."""
    response = test_client.delete("/api/team/1/", headers=regular_user_auth_headers)
    assert response.status_code == 403

# Tests for DELETE /team/race/<race_id>/team/<team_id>/ (delete registration, admin only)

def test_delete_registration_success(test_client, add_test_data, admin_auth_headers):
    """Test deleting a registration as admin."""
    # First, create a registration
    response = test_client.post("/api/team/race/1/", json={"team_id": 1, "race_category_id": 1}, headers=admin_auth_headers)
    assert response.status_code == 201

    # Verify registration exists
    response = test_client.get("/api/team/race/1/", headers=admin_auth_headers)
    assert response.status_code == 200
    assert len(response.json) == 1

    # Delete the registration
    response = test_client.delete("/api/team/race/1/team/1/", headers=admin_auth_headers)
    assert response.status_code == 200
    assert response.json["message"] == "Registration deleted successfully"

    # Verify registration is deleted
    response = test_client.get("/api/team/race/1/", headers=admin_auth_headers)
    assert response.status_code == 200
    assert len(response.json) == 0


def test_delete_registration_not_found(test_client, add_test_data, admin_auth_headers):
    """Test deleting non-existent registration returns 404."""
    # Try to delete registration that doesn't exist
    response = test_client.delete("/api/team/race/1/team/999/", headers=admin_auth_headers)
    assert response.status_code == 404


def test_delete_registration_race_not_found(test_client, add_test_data, admin_auth_headers):
    """Test deleting registration for non-existent race returns 404."""
    response = test_client.delete("/api/team/race/999/team/1/", headers=admin_auth_headers)
    assert response.status_code == 404


def test_delete_registration_unauthorized(test_client, add_test_data, admin_auth_headers):
    """Test deleting registration without JWT returns 401."""
    # First, create a registration as admin
    response = test_client.post("/api/team/race/1/", json={"team_id": 1, "race_category_id": 1}, headers=admin_auth_headers)
    assert response.status_code == 201

    # Try to delete without auth
    response = test_client.delete("/api/team/race/1/team/1/")
    assert response.status_code == 401


def test_delete_registration_forbidden_non_admin(test_client, add_test_data, admin_auth_headers, regular_user_auth_headers):
    """Test deleting registration as non-admin returns 403."""
    # First, create a registration as admin
    response = test_client.post("/api/team/race/1/", json={"team_id": 1, "race_category_id": 1}, headers=admin_auth_headers)
    assert response.status_code == 201

    # Try to delete as non-admin
    response = test_client.delete("/api/team/race/1/team/1/", headers=regular_user_auth_headers)
    assert response.status_code == 403


def test_delete_registration_multiple_registrations(test_client, add_test_data, admin_auth_headers):
    """Test deleting one registration doesn't affect others."""
    # Create multiple registrations
    response = test_client.post("/api/team/race/1/", json={"team_id": 1, "race_category_id": 1}, headers=admin_auth_headers)
    assert response.status_code == 201
    response = test_client.post("/api/team/race/1/", json={"team_id": 2, "race_category_id": 1}, headers=admin_auth_headers)
    assert response.status_code == 201

    # Verify both exist
    response = test_client.get("/api/team/race/1/", headers=admin_auth_headers)
    assert response.status_code == 200
    assert len(response.json) == 2

    # Delete one registration
    response = test_client.delete("/api/team/race/1/team/1/", headers=admin_auth_headers)
    assert response.status_code == 200

    # Verify only one remains
    response = test_client.get("/api/team/race/1/", headers=admin_auth_headers)
    assert response.status_code == 200
    assert len(response.json) == 1
    assert response.json[0]["id"] == 2


# Tests for PATCH /team/race/<race_id>/team/<team_id>/disqualify/ (admin only)

def test_disqualify_and_revert_team_success(test_client, test_app, add_test_data, admin_auth_headers):
    """Admin can disqualify and later revert a team within a race."""
    # Create a registration
    response = test_client.post(
        "/api/team/race/1/",
        json={"team_id": 1, "race_category_id": 1},
        headers=admin_auth_headers,
    )
    assert response.status_code == 201

    # Disqualify the team
    response = test_client.patch(
        "/api/team/race/1/team/1/disqualify/",
        json={"disqualified": True},
        headers=admin_auth_headers,
    )
    assert response.status_code == 200
    assert response.json["disqualified"] is True

    with test_app.app_context():
        reg = Registration.query.filter_by(race_id=1, team_id=1).first()
        assert reg is not None and reg.disqualified is True

    # Revert disqualification
    response = test_client.patch(
        "/api/team/race/1/team/1/disqualify/",
        json={"disqualified": False},
        headers=admin_auth_headers,
    )
    assert response.status_code == 200
    assert response.json["disqualified"] is False

    with test_app.app_context():
        reg = Registration.query.filter_by(race_id=1, team_id=1).first()
        assert reg is not None and reg.disqualified is False


def test_disqualify_missing_field(test_client, add_test_data, admin_auth_headers):
    """Request without disqualified field returns 400 with validation errors."""
    # Need registration
    response = test_client.post(
        "/api/team/race/1/",
        json={"team_id": 1, "race_category_id": 1},
        headers=admin_auth_headers,
    )
    assert response.status_code == 201

    response = test_client.patch(
        "/api/team/race/1/team/1/disqualify/",
        json={},
        headers=admin_auth_headers,
    )
    assert response.status_code == 400
    assert "disqualified" in response.json.get("errors", {})


def test_disqualify_not_found_registration(test_client, add_test_data, admin_auth_headers):
    """Disqualifying non-existent registration returns 404."""
    response = test_client.patch(
        "/api/team/race/1/team/999/disqualify/",
        json={"disqualified": True},
        headers=admin_auth_headers,
    )
    assert response.status_code == 404


def test_disqualify_unauthorized(test_client, add_test_data):
    """Disqualify endpoint requires authentication."""
    response = test_client.patch(
        "/api/team/race/1/team/1/disqualify/",
        json={"disqualified": True},
    )
    assert response.status_code == 401


def test_disqualify_forbidden_for_non_admin(test_client, add_test_data, regular_user_auth_headers):
    """Disqualify endpoint is admin-only; non-admin gets 403."""
    response = test_client.patch(
        "/api/team/race/1/team/1/disqualify/",
        json={"disqualified": True},
        headers=regular_user_auth_headers,
    )
    assert response.status_code == 403


def test_race_results_include_disqualified_flag(test_client, add_test_data, admin_auth_headers):
    """Race results payload includes disqualified boolean for each team."""
    # Register a paid team and fetch results (default: not disqualified)
    response = test_client.post(
        "/api/team/race/1/",
        json={"team_id": 1, "race_category_id": 1},
        headers=admin_auth_headers,
    )
    assert response.status_code == 201

    with test_client.application.app_context():
        registration = Registration.query.filter_by(race_id=1, team_id=1).first()
        registration.payment_confirmed = True
        db.session.commit()

    response = test_client.get("/api/race/1/results/", headers=admin_auth_headers)
    assert response.status_code == 200
    assert len(response.json) == 1
    assert response.json[0]["disqualified"] is False

    # Disqualify and check results reflect the flag
    response = test_client.patch(
        "/api/team/race/1/team/1/disqualify/",
        json={"disqualified": True},
        headers=admin_auth_headers,
    )
    assert response.status_code == 200

    response = test_client.get("/api/race/1/results/", headers=admin_auth_headers)
    assert response.status_code == 200
    assert len(response.json) == 1
    assert response.json[0]["disqualified"] is True


# Tests for POST /team/race/<race_id>/send-registration-emails/ (admin only)

def test_send_registration_emails_success(test_client, add_test_data, admin_auth_headers, mocker):
    """Test sending registration emails successfully."""
    # Mock the email service
    mock_email_service = mocker.patch('app.services.email_service.EmailService.send_registration_confirmation_email', return_value=True)

    # Create users and add them to teams
    response = test_client.post("/auth/register/", json={"name": "John", "email": "john@example.com", "password": "password"})
    response = test_client.post("/auth/register/", json={"name": "Peter", "email": "peter@example.com", "password": "password"})
    response = test_client.post("/api/team/1/members/", json={"user_ids": [1, 2]})

    response = test_client.post("/auth/register/", json={"name": "Alice", "email": "alice@example.com", "password": "password"})
    response = test_client.post("/api/team/2/members/", json={"user_ids": [3]})

    # Register teams to race
    response = test_client.post("/api/team/race/1/", json={"team_id": 1, "race_category_id": 1}, headers=admin_auth_headers)
    assert response.status_code == 201
    response = test_client.post("/api/team/race/1/", json={"team_id": 2, "race_category_id": 1}, headers=admin_auth_headers)
    assert response.status_code == 201

    with test_client.application.app_context():
        Registration.query.filter_by(race_id=1, team_id=1).first().payment_confirmed = True
        Registration.query.filter_by(race_id=1, team_id=2).first().payment_confirmed = True
        db.session.commit()

    # Send emails
    response = test_client.post("/api/team/race/1/send-registration-emails/", headers=admin_auth_headers)
    assert response.status_code == 200
    assert response.json["sent"] == 3
    assert response.json["failed"] == 0

    # Verify email service was called for each member
    assert mock_email_service.call_count == 3


def test_send_registration_emails_no_registrations(test_client, add_test_data, admin_auth_headers, mocker):
    """Test sending emails for race with no registrations."""
    mock_email_service = mocker.patch('app.services.email_service.EmailService.send_registration_confirmation_email', return_value=True)

    # Race 2 has no registrations
    response = test_client.post("/api/team/race/2/send-registration-emails/", headers=admin_auth_headers)
    assert response.status_code == 200
    assert response.json["sent"] == 0
    assert response.json["failed"] == 0

    # Verify no emails were sent
    assert mock_email_service.call_count == 0


def test_send_registration_emails_teams_without_members(test_client, add_test_data, admin_auth_headers, mocker):
    """Test sending emails for teams without members."""
    mock_email_service = mocker.patch('app.services.email_service.EmailService.send_registration_confirmation_email', return_value=True)

    # Register team without members
    response = test_client.post("/api/team/race/1/", json={"team_id": 1, "race_category_id": 1}, headers=admin_auth_headers)
    assert response.status_code == 201

    with test_client.application.app_context():
        Registration.query.filter_by(race_id=1, team_id=1).first().payment_confirmed = True
        db.session.commit()

    # Send emails
    response = test_client.post("/api/team/race/1/send-registration-emails/", headers=admin_auth_headers)
    assert response.status_code == 200
    assert response.json["sent"] == 0
    assert response.json["failed"] == 0

    # Verify no emails were sent
    assert mock_email_service.call_count == 0


def test_send_registration_emails_partial_failure(test_client, add_test_data, admin_auth_headers, mocker):
    """Test sending emails with some failures."""
    # Mock email service to fail for specific email
    def mock_send_email(user_email, user_name, race_name, team_name, race_category, reset_token, language=None, **kwargs):
        if user_email == "peter@example.com":
            raise ValueError("Email sending failed")
        return True

    mock_email_service = mocker.patch('app.services.email_service.EmailService.send_registration_confirmation_email', side_effect=mock_send_email)

    # Create users and add them to team
    # Note: admin_auth_headers creates an admin user with ID 1, so John will be ID 2 and Peter ID 3
    response = test_client.post("/auth/register/", json={"name": "John", "email": "john@example.com", "password": "password"})
    assert response.status_code == 201

    response = test_client.post("/auth/register/", json={"name": "Peter", "email": "peter@example.com", "password": "password"})
    assert response.status_code == 201

    response = test_client.post("/api/team/1/members/", json={"user_ids": [2, 3]})  # John=2, Peter=3

    # Register team to race
    response = test_client.post("/api/team/race/1/", json={"team_id": 1, "race_category_id": 1}, headers=admin_auth_headers)
    assert response.status_code == 201

    with test_client.application.app_context():
        Registration.query.filter_by(race_id=1, team_id=1).first().payment_confirmed = True
        db.session.commit()

    # Send emails
    response = test_client.post("/api/team/race/1/send-registration-emails/", headers=admin_auth_headers)
    assert response.status_code == 200
    # When one email fails, the sent count decreases and failed increases
    assert response.json["sent"] == 1
    assert response.json["failed"] == 1


def test_send_registration_emails_race_not_found(test_client, add_test_data, admin_auth_headers):
    """Test sending emails for non-existent race returns 404."""
    response = test_client.post("/api/team/race/999/send-registration-emails/", headers=admin_auth_headers)
    assert response.status_code == 404


def test_send_registration_emails_unauthorized(test_client, add_test_data):
    """Test sending emails without JWT returns 401."""
    response = test_client.post("/api/team/race/1/send-registration-emails/")
    assert response.status_code == 401


def test_send_registration_emails_forbidden_non_admin(test_client, add_test_data, regular_user_auth_headers):
    """Test sending emails as non-admin returns 403."""
    response = test_client.post("/api/team/race/1/send-registration-emails/", headers=regular_user_auth_headers)
    assert response.status_code == 403


def test_send_registration_emails_only_unsent(test_client, add_test_data, admin_auth_headers, mocker):
    """Test that emails are only sent to registrations that haven't received emails yet."""
    mock_email_service = mocker.patch('app.services.email_service.EmailService.send_registration_confirmation_email', return_value=True)

    # Create users and add them to teams
    response = test_client.post("/auth/register/", json={"name": "John", "email": "john@example.com", "password": "password"})
    response = test_client.post("/api/team/1/members/", json={"user_ids": [1]})

    response = test_client.post("/auth/register/", json={"name": "Alice", "email": "alice@example.com", "password": "password"})
    response = test_client.post("/api/team/2/members/", json={"user_ids": [2]})

    # Register both teams to race
    response = test_client.post("/api/team/race/1/", json={"team_id": 1, "race_category_id": 1}, headers=admin_auth_headers)
    assert response.status_code == 201
    response = test_client.post("/api/team/race/1/", json={"team_id": 2, "race_category_id": 1}, headers=admin_auth_headers)
    assert response.status_code == 201

    with test_client.application.app_context():
        Registration.query.filter_by(race_id=1, team_id=1).first().payment_confirmed = True
        Registration.query.filter_by(race_id=1, team_id=2).first().payment_confirmed = True
        db.session.commit()

    # Send emails first time
    response = test_client.post("/api/team/race/1/send-registration-emails/", headers=admin_auth_headers)
    assert response.status_code == 200
    assert response.json["sent"] == 2
    assert response.json["failed"] == 0
    assert mock_email_service.call_count == 2

    # Send emails again - should send to no one since all received emails
    response = test_client.post("/api/team/race/1/send-registration-emails/", headers=admin_auth_headers)
    assert response.status_code == 200
    assert response.json["sent"] == 0
    assert response.json["failed"] == 0
    # Call count should still be 2 (no new calls)
    assert mock_email_service.call_count == 2


def test_send_registration_emails_sets_reset_token(test_client, add_test_data, admin_auth_headers, mocker):
    """Test that password reset tokens are generated for users."""
    mock_email_service = mocker.patch('app.services.email_service.EmailService.send_registration_confirmation_email', return_value=True)

    # Create user and add to team
    response = test_client.post("/auth/register/", json={"name": "John", "email": "john@example.com", "password": "password"})
    response = test_client.post("/api/team/1/members/", json={"user_ids": [1]})

    # Register team to race
    response = test_client.post("/api/team/race/1/", json={"team_id": 1, "race_category_id": 1}, headers=admin_auth_headers)
    assert response.status_code == 201

    with test_client.application.app_context():
        Registration.query.filter_by(race_id=1, team_id=1).first().payment_confirmed = True
        db.session.commit()

    # Verify user has no reset token initially
    from app.models import User
    with test_client.application.app_context():
        user = User.query.filter_by(id=1).first()
        assert user.reset_token is None

    # Send emails
    response = test_client.post("/api/team/race/1/send-registration-emails/", headers=admin_auth_headers)
    assert response.status_code == 200
    assert response.json["sent"] == 1

    # Verify user now has a reset token
    with test_client.application.app_context():
        user = User.query.filter_by(id=1).first()
        assert user.reset_token is not None
        assert user.reset_token_expiry is not None

    # Verify email was called with reset_token parameter
    assert mock_email_service.call_count == 1
    call_args = mock_email_service.call_args[1]
    assert 'reset_token' in call_args
    assert call_args['reset_token'] is not None


def test_retry_registration_payment_creates_pending_attempt(test_client, add_test_data, admin_auth_headers, test_app, monkeypatch):
    """Admin retry endpoint creates a pending payment attempt and returns checkout URL."""
    with test_app.app_context():
        race = Race.query.filter_by(id=1).first()
        race.registration_slug = "retry-individual"
        race.registration_enabled = True
        race.allow_team_registration = False
        race.allow_individual_registration = True
        race.registration_currency = "czk"
        race.registration_driver_amount_cents = 250
        race.registration_codriver_amount_cents = 150
        db.session.commit()

    response = test_client.post(
        "/api/team/race/1/",
        json={"team_id": 1, "race_category_id": 1},
        headers=admin_auth_headers,
    )
    assert response.status_code == 201

    monkeypatch.setattr(
        "app.routes.race_api.registration.create_registration_checkout_session",
        lambda **kwargs: {
            "session_id": "cs_retry_driver_1",
            "checkout_url": "https://checkout.stripe.com/c/pay/cs_retry_driver_1",
        },
    )

    retry_response = test_client.post(
        "/api/race/1/team/1/payments/retry/",
        json={"payment_type": "driver"},
        headers=admin_auth_headers,
    )
    assert retry_response.status_code == 201
    assert retry_response.json["payment_type"] == "driver"
    assert "checkout_url" in retry_response.json

    with test_app.app_context():
        registration = Registration.query.filter_by(race_id=1, team_id=1).first()
        attempt = RegistrationPaymentAttempt.query.filter_by(
            registration_id=registration.id,
            stripe_session_id="cs_retry_driver_1",
        ).first()
        assert attempt is not None
        assert attempt.payment_type == "driver"
        assert attempt.status == "pending"


def test_mark_registration_payment_toggle_updates_aggregate(test_client, add_test_data, admin_auth_headers, test_app):
    """Manual mark paid/unpaid endpoint updates attempts and aggregate registration payment state."""
    with test_app.app_context():
        race = Race.query.filter_by(id=1).first()
        race.allow_team_registration = False
        race.allow_individual_registration = True
        race.registration_driver_amount_cents = 250
        race.registration_codriver_amount_cents = 150
        db.session.commit()

    response = test_client.post(
        "/api/team/race/1/",
        json={"team_id": 1, "race_category_id": 1},
        headers=admin_auth_headers,
    )
    assert response.status_code == 201

    mark_paid = test_client.patch(
        "/api/race/1/team/1/payments/mark/",
        json={"payment_type": "driver", "confirmed": True},
        headers=admin_auth_headers,
    )
    assert mark_paid.status_code == 200
    assert mark_paid.json["payment_confirmed"] is True

    with test_app.app_context():
        registration = Registration.query.filter_by(race_id=1, team_id=1).first()
        assert registration.payment_confirmed is True
        assert registration.payment_confirmed_at is not None
        confirmed_attempt = RegistrationPaymentAttempt.query.filter_by(
            registration_id=registration.id,
            payment_type="driver",
            status="confirmed",
        ).first()
        assert confirmed_attempt is not None

    mark_unpaid = test_client.patch(
        "/api/race/1/team/1/payments/mark/",
        json={"payment_type": "driver", "confirmed": False},
        headers=admin_auth_headers,
    )
    assert mark_unpaid.status_code == 200
    assert mark_unpaid.json["payment_confirmed"] is False

    with test_app.app_context():
        registration = Registration.query.filter_by(race_id=1, team_id=1).first()
        assert registration.payment_confirmed is False
        assert registration.payment_confirmed_at is None
        assert registration.stripe_session_id is None
        confirmed_attempt = RegistrationPaymentAttempt.query.filter_by(
            registration_id=registration.id,
            payment_type="driver",
            status="confirmed",
        ).first()
        assert confirmed_attempt is None


def test_reconcile_registration_payment_confirms_paid_attempt(test_client, add_test_data, admin_auth_headers, test_app, monkeypatch):
    """Reconcile endpoint confirms pending Stripe attempt when Stripe reports payment_status=paid."""
    with test_app.app_context():
        race = Race.query.filter_by(id=1).first()
        race.allow_team_registration = False
        race.allow_individual_registration = True
        race.registration_driver_amount_cents = 250
        race.registration_codriver_amount_cents = 150
        db.session.commit()

    response = test_client.post(
        "/api/team/race/1/",
        json={"team_id": 1, "race_category_id": 1},
        headers=admin_auth_headers,
    )
    assert response.status_code == 201

    with test_app.app_context():
        registration = Registration.query.filter_by(race_id=1, team_id=1).first()
        pending_attempt = RegistrationPaymentAttempt(
            registration_id=registration.id,
            stripe_session_id="cs_reconcile_paid_1",
            payment_type="driver",
            status="pending",
            amount_cents=25000,
            currency="czk",
        )
        db.session.add(pending_attempt)
        db.session.commit()

    monkeypatch.setattr(
        "app.routes.race_api.registration.get_checkout_session_payment_state",
        lambda **kwargs: {
            "session_id": "cs_reconcile_paid_1",
            "payment_status": "paid",
            "status": "complete",
            "payment_intent": "pi_test_1",
        },
    )

    reconcile_response = test_client.post(
        "/api/race/1/team/1/payments/reconcile/",
        json={"payment_type": "driver"},
        headers=admin_auth_headers,
    )

    assert reconcile_response.status_code == 200
    assert reconcile_response.json["payment_confirmed"] is True
    assert reconcile_response.json["stripe_status"]["payment_status"] == "paid"

    with test_app.app_context():
        registration = Registration.query.filter_by(race_id=1, team_id=1).first()
        assert registration.payment_confirmed is True
        assert registration.payment_confirmed_at is not None

        attempt = RegistrationPaymentAttempt.query.filter_by(
            registration_id=registration.id,
            stripe_session_id="cs_reconcile_paid_1",
        ).first()
        assert attempt is not None
        assert attempt.status == "confirmed"
        assert attempt.confirmed_at is not None