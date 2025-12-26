"""
Test cases for app/routes/user.py endpoints.

Tests the user endpoints:
- GET /api/user/signed-races/ - Get races the current user is signed to
"""

import pytest
from app import db
from app.models import Race, Team, User, RaceCategory, Registration
from datetime import datetime, timedelta


@pytest.fixture
def add_test_data(test_app):
    """Create test data including users, teams, races, and registrations."""
    with test_app.app_context():
        now = datetime.now()
        some_time_earlier = now - timedelta(minutes=10)
        some_time_later = now + timedelta(minutes=10)
        
        # Create race categories
        category1 = RaceCategory(name="Bikes", description="For cyclists")
        category2 = RaceCategory(name="Cars", description="For drivers")
        db.session.add_all([category1, category2])
        db.session.commit()
        
        # Create races
        race1 = Race(
            name="Spring Race", 
            description="24 hours exploring",
            start_showing_checkpoints_at=some_time_earlier,
            end_showing_checkpoints_at=some_time_later,
            start_logging_at=some_time_earlier,
            end_logging_at=some_time_later
        )
        race2 = Race(
            name="Summer Challenge",
            description="Weekend adventure",
            start_showing_checkpoints_at=some_time_earlier + timedelta(days=30),
            end_showing_checkpoints_at=some_time_later + timedelta(days=30),
            start_logging_at=some_time_earlier + timedelta(days=30),
            end_logging_at=some_time_later + timedelta(days=30)
        )
        race3 = Race(
            name="Winter Rally",
            description="Cold weather challenge",
            start_showing_checkpoints_at=some_time_earlier + timedelta(days=60),
            end_showing_checkpoints_at=some_time_later + timedelta(days=60),
            start_logging_at=some_time_earlier + timedelta(days=60),
            end_logging_at=some_time_later + timedelta(days=60)
        )
        
        db.session.add_all([race1, race2, race3])
        db.session.commit()
        
        # Create users
        user1 = User(name="User One", email="user1@example.com", is_administrator=False)
        user1.set_password("password")
        
        user2 = User(name="User Two", email="user2@example.com", is_administrator=False)
        user2.set_password("password")
        
        user3 = User(name="User Three", email="user3@example.com", is_administrator=False)
        user3.set_password("password")
        
        db.session.add_all([user1, user2, user3])
        db.session.commit()
        
        # Create teams
        team1 = Team(name="Team Alpha")
        team1.members.append(user1)  # user1 in team1
        
        team2 = Team(name="Team Beta")
        team2.members.append(user1)  # user1 also in team2
        team2.members.append(user2)  # user2 in team2
        
        team3 = Team(name="Team Gamma")
        team3.members.append(user2)  # user2 also in team3
        
        team4 = Team(name="Team Omega")
        # team4 has no members (user3 is not in any team)
        
        db.session.add_all([team1, team2, team3, team4])
        db.session.commit()
        
        # Create registrations
        # Team1 signed for race1 with category1
        reg1 = Registration(race_id=race1.id, team_id=team1.id, race_category_id=category1.id)
        
        # Team2 signed for race2 with category2
        reg2 = Registration(race_id=race2.id, team_id=team2.id, race_category_id=category2.id)
        
        # Team3 signed for race1 with category2
        reg3 = Registration(race_id=race1.id, team_id=team3.id, race_category_id=category2.id)
        
        # Team4 signed for race3 with category1 (no members in this team)
        reg4 = Registration(race_id=race3.id, team_id=team4.id, race_category_id=category1.id)
        
        db.session.add_all([reg1, reg2, reg3, reg4])
        db.session.commit()


# GET /api/user/signed-races/ endpoint tests

def test_get_signed_races_success(test_client, add_test_data):
    """Test getting signed races for user with multiple registrations."""
    # Login as user1 who is in team1 (race1) and team2 (race2)
    response = test_client.post("/auth/login/", json={"email": "user1@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}
    
    response = test_client.get("/api/user/signed-races/", headers=headers)
    assert response.status_code == 200
    assert "signed_races" in response.json
    
    signed_races = response.json["signed_races"]
    assert len(signed_races) == 2
    
    # Check race details are present
    race_ids = [race["race_id"] for race in signed_races]
    assert 1 in race_ids  # Spring Race
    assert 2 in race_ids  # Summer Challenge
    
    # Verify structure of returned data
    for race in signed_races:
        assert "race_id" in race
        assert "team_id" in race
        assert "race_name" in race
        assert "race_category" in race
        assert "race_description" in race
        assert "start_showing_checkpoints" in race
        assert "end_showing_checkpoints" in race
        assert "start_logging" in race
        assert "end_logging" in race


def test_get_signed_races_specific_details(test_client, add_test_data):
    """Test that returned race details match expected values."""
    # Login as user1
    response = test_client.post("/auth/login/", json={"email": "user1@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}
    
    response = test_client.get("/api/user/signed-races/", headers=headers)
    assert response.status_code == 200
    
    signed_races = response.json["signed_races"]
    
    # Find Spring Race
    spring_race = next((r for r in signed_races if r["race_id"] == 1), None)
    assert spring_race is not None
    assert spring_race["race_name"] == "Spring Race"
    assert spring_race["race_description"] == "24 hours exploring"
    assert spring_race["race_category"] == "Bikes"
    assert spring_race["team_id"] == 1
    
    # Find Summer Challenge
    summer_race = next((r for r in signed_races if r["race_id"] == 2), None)
    assert summer_race is not None
    assert summer_race["race_name"] == "Summer Challenge"
    assert summer_race["race_description"] == "Weekend adventure"
    assert summer_race["race_category"] == "Cars"
    assert summer_race["team_id"] == 2


def test_get_signed_races_user_in_multiple_teams_same_race(test_client, add_test_data):
    """Test user who is in multiple teams signed for different races."""
    # Login as user2 who is in team2 (race2) and team3 (race1)
    response = test_client.post("/auth/login/", json={"email": "user2@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}
    
    response = test_client.get("/api/user/signed-races/", headers=headers)
    assert response.status_code == 200
    
    signed_races = response.json["signed_races"]
    assert len(signed_races) == 2
    
    race_ids = [race["race_id"] for race in signed_races]
    assert 1 in race_ids  # Spring Race (via team3)
    assert 2 in race_ids  # Summer Challenge (via team2)


def test_get_signed_races_no_registrations(test_client, add_test_data):
    """Test user who is not in any team returns empty list."""
    # Login as user3 who is not in any team
    response = test_client.post("/auth/login/", json={"email": "user3@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}
    
    response = test_client.get("/api/user/signed-races/", headers=headers)
    assert response.status_code == 200
    assert "signed_races" in response.json
    assert len(response.json["signed_races"]) == 0


def test_get_signed_races_unauthorized(test_client, add_test_data):
    """Test getting signed races without JWT returns 401."""
    response = test_client.get("/api/user/signed-races/")
    assert response.status_code == 401


def test_get_signed_races_invalid_token(test_client, add_test_data):
    """Test getting signed races with invalid JWT returns 422."""
    headers = {"Authorization": "Bearer invalid_token_here"}
    response = test_client.get("/api/user/signed-races/", headers=headers)
    assert response.status_code == 422


def test_get_signed_races_admin_user(test_client, add_test_data, admin_auth_headers):
    """Test that admin users can also get their signed races."""
    # The admin_auth_headers fixture creates an admin user
    # This admin is not in any team, so should return empty list
    response = test_client.get("/api/user/signed-races/", headers=admin_auth_headers)
    assert response.status_code == 200
    assert "signed_races" in response.json
    # Admin created by fixture is not in any team
    assert len(response.json["signed_races"]) == 0


def test_get_signed_races_timing_fields_format(test_client, add_test_data):
    """Test that timing fields are returned in proper format."""
    # Login as user1
    response = test_client.post("/auth/login/", json={"email": "user1@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}
    
    response = test_client.get("/api/user/signed-races/", headers=headers)
    assert response.status_code == 200
    
    signed_races = response.json["signed_races"]
    assert len(signed_races) > 0
    
    # Check that timing fields are present and not None
    for race in signed_races:
        assert race["start_showing_checkpoints"] is not None
        assert race["end_showing_checkpoints"] is not None
        assert race["start_logging"] is not None
        assert race["end_logging"] is not None
        # These should be datetime strings in ISO format
        assert isinstance(race["start_showing_checkpoints"], str)
        assert isinstance(race["end_showing_checkpoints"], str)
        assert isinstance(race["start_logging"], str)
        assert isinstance(race["end_logging"], str)


def test_get_signed_races_returns_correct_team_id(test_client, add_test_data):
    """Test that the correct team_id is returned for each race."""
    # Login as user1 who is in team1 for race1 and team2 for race2
    response = test_client.post("/auth/login/", json={"email": "user1@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}
    
    response = test_client.get("/api/user/signed-races/", headers=headers)
    assert response.status_code == 200
    
    signed_races = response.json["signed_races"]
    
    # Find races and verify team IDs
    for race in signed_races:
        if race["race_id"] == 1:  # Spring Race
            assert race["team_id"] == 1  # Should be team1
        elif race["race_id"] == 2:  # Summer Challenge
            assert race["team_id"] == 2  # Should be team2
