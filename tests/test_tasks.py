import pytest
from app import create_app, db
from app.models import Race, Task, TaskLog, User, Team, Registration, RaceCategory
from datetime import datetime, timedelta

@pytest.fixture
def test_app():
    # Use testing configuration
    app = create_app("app.config.TestConfig")
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()

@pytest.fixture
def test_client(test_app):
    # Create test client
    return test_app.test_client()

@pytest.fixture
def add_test_data(test_app):
    # Insert test data
    with test_app.app_context():
        now = datetime.now()
        some_time_earlier = now - timedelta(minutes=10)
        some_time_later = now + timedelta(minutes=10)
        
        # Create race category
        category1 = RaceCategory(name="Standard", description="Standard category")
        db.session.add(category1)
        db.session.commit()
        
        # Create race
        race1 = Race(
            name="Spring Race", 
            description="24 hours of exploration",
            start_showing_checkpoints_at=some_time_earlier,
            end_showing_checkpoints_at=some_time_later,
            start_logging_at=some_time_earlier,
            end_logging_at=some_time_later
        )
        db.session.add(race1)
        db.session.commit()

        # Create users
        admin_user = User(name="Admin User", email="admin@example.com", is_administrator=True)
        admin_user.set_password("password")
        
        regular_user = User(name="Regular User", email="user@example.com", is_administrator=False)
        regular_user.set_password("password")
        
        db.session.add_all([admin_user, regular_user])
        db.session.commit()

        # Create team
        team1 = Team(name="Team Alpha")
        team1.members.append(regular_user)
        db.session.add(team1)
        db.session.commit()

        # Create registration
        registration1 = Registration(race_id=race1.id, team_id=team1.id, race_category_id=category1.id)
        db.session.add(registration1)
        db.session.commit()

        # Create tasks
        task1 = Task(title="Task 1", description="First task", numOfPoints=5, race_id=race1.id)
        task2 = Task(title="Task 2", description="Second task", numOfPoints=10, race_id=race1.id)
        task3 = Task(title="Task 3", description="Third task with no points", numOfPoints=1, race_id=race1.id)
        
        db.session.add_all([task1, task2, task3])
        db.session.commit()

def test_get_all_tasks(test_client, add_test_data):
    """Test getting all tasks for a race"""
    response = test_client.post("/auth/login/", json={"email": "admin@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}

    response = test_client.get("/api/race/1/tasks/", headers=headers)
    assert response.status_code == 200
    assert len(response.json) == 3
    assert response.json[0]["title"] == "Task 1"
    assert response.json[1]["title"] == "Task 2"
    assert response.json[2]["title"] == "Task 3"

def test_get_single_task(test_client, add_test_data):
    """Test getting a single task by ID"""
    response = test_client.post("/auth/login/", json={"email": "admin@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}

    response = test_client.get("/api/race/1/tasks/1/", headers=headers)
    assert response.status_code == 200
    assert response.json["title"] == "Task 1"
    assert response.json["description"] == "First task"
    assert response.json["numOfPoints"] == 5
    
    response = test_client.get("/api/race/1/tasks/2/", headers=headers)
    assert response.status_code == 200
    assert response.json["title"] == "Task 2"
    assert response.json["description"] == "Second task"
    assert response.json["numOfPoints"] == 10

    # Test non-existent task
    response = test_client.get("/api/race/1/tasks/999/", headers=headers)
    assert response.status_code == 404

def test_create_single_task(test_client, add_test_data):
    """Test creating a single task (admin only)"""
    response = test_client.post("/auth/login/", json={"email": "admin@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}

    response = test_client.post("/api/race/1/tasks/", json={
        "title": "Task 4",
        "description": "Fourth task",
        "numOfPoints": 15
    }, headers=headers)
    assert response.status_code == 201
    assert response.json["title"] == "Task 4"
    assert response.json["description"] == "Fourth task"
    assert response.json["numOfPoints"] == 15

    # Verify task was created
    response = test_client.get("/api/race/1/tasks/", headers=headers)
    assert response.status_code == 200
    assert len(response.json) == 4

def test_create_multiple_tasks(test_client, add_test_data):
    """Test creating multiple tasks at once (admin only)"""
    response = test_client.post("/auth/login/", json={"email": "admin@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}

    response = test_client.post("/api/race/1/tasks/", json=[
        {"title": "Batch Task 1", "description": "First batch task", "numOfPoints": 8},
        {"title": "Batch Task 2", "description": "Second batch task", "numOfPoints": 12}
    ], headers=headers)
    assert response.status_code == 201
    assert len(response.json) == 2
    assert response.json[0]["title"] == "Batch Task 1"
    assert response.json[1]["title"] == "Batch Task 2"

    # Verify tasks were created
    response = test_client.get("/api/race/1/tasks/", headers=headers)
    assert response.status_code == 200
    assert len(response.json) == 5

def test_create_task_non_admin(test_client, add_test_data):
    """Test that non-admin users cannot create tasks"""
    response = test_client.post("/auth/login/", json={"email": "user@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}

    response = test_client.post("/api/race/1/tasks/", json={
        "title": "Unauthorized Task",
        "description": "Should fail",
        "numOfPoints": 5
    }, headers=headers)
    assert response.status_code == 403

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

def test_create_task_with_field_aliases(test_client, add_test_data):
    """Test creating task with alternative field names"""
    response = test_client.post("/auth/login/", json={"email": "admin@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}

    # Test with 'name' instead of 'title'
    response = test_client.post("/api/race/1/tasks/", json={
        "name": "Alias Task",
        "desc": "Using alias fields",
        "numPoints": 7
    }, headers=headers)
    assert response.status_code == 201
    assert response.json["title"] == "Alias Task"
    assert response.json["description"] == "Using alias fields"
    assert response.json["numOfPoints"] == 7

def test_create_task_missing_title(test_client, add_test_data):
    """Test creating task without required title field"""
    response = test_client.post("/auth/login/", json={"email": "admin@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}

    response = test_client.post("/api/race/1/tasks/", json={
        "description": "No title provided",
        "numOfPoints": 5
    }, headers=headers)
    assert response.status_code == 400
    assert "Missing required field" in response.json["message"]

def test_task_without_authentication(test_client, add_test_data):
    """Test accessing task endpoints without authentication"""
    # Attempt to get tasks without token
    response = test_client.get("/api/race/1/tasks/")
    assert response.status_code == 401

    # Attempt to create task without token
    response = test_client.post("/api/race/1/tasks/", json={
        "title": "Unauthorized",
        "description": "Should fail"
    })
    assert response.status_code == 401
