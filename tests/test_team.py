import pytest
from app import db
from app.models import Race, Team, RaceCategory
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

def test_team_signup(test_client, add_test_data, admin_auth_headers):
    # Test přihlášení týmu k závodu
    response = test_client.post("/api/team/race/1/", json={"team_id": 1, "race_category_id": 1}, headers=admin_auth_headers) # race category id 1 = Auto, OK for race Jarní jízda
    assert response.status_code == 201
    assert response.json == {"team_id": 1, "race_id": 1, 'race_category': 'Auto'}

    # Test získání týmů podle závodu
    response = test_client.post("/api/team/race/1/", json={"team_id": 2, "race_category_id": 1}, headers=admin_auth_headers) # race category id 1 = Auto, OK for race Jarní jízda
    response = test_client.get("/api/team/race/1/", headers=admin_auth_headers)
    assert response.json == [{"id": 1, "name": "Team1", "members": [], 'race_category': 'Auto', 'email_sent': False}, {"id": 2, "name": "Team2", "members": [], 'race_category': 'Auto', 'email_sent': False}]


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
    assert response.status_code == 201
    assert response.json == {"team_id": 1, "user_ids": []}


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


def test_delete_registration_unauthorized(test_client, add_test_data):
    """Test deleting registration without JWT returns 401."""
    # First, create a registration as admin
    response = test_client.post("/auth/register/", json={"name": "Admin", "email": "admin@example.com", "password": "password", "is_administrator": True})
    response = test_client.post("/auth/login/", json={"email": "admin@example.com", "password": "password"})
    admin_token = response.json["access_token"]
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    response = test_client.post("/api/team/race/1/", json={"team_id": 1, "race_category_id": 1}, headers=headers)
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
    def mock_send_email(user_email, user_name, race_name, team_name, race_category, reset_token):
        if user_email == "peter@example.com":
            raise Exception("Email sending failed")
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