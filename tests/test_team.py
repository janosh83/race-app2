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
    assert response.json == [{"id": 1, "name": "Team1", "members": [], 'race_category': 'Auto'}, {"id": 2, "name": "Team2", "members": [], 'race_category': 'Auto'}]


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
    # Race 1 (Jarní jízda) only has category 2 (Auto), not category 1 (Motorka)
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
