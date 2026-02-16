import pytest
from app import db
from app.models import Race, Task, TaskLog, User, Team, Registration, RaceCategory, TaskTranslation
from datetime import datetime, timedelta

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

        translation = TaskTranslation(
            task_id=task1.id,
            language="cs",
            title="Ukol 1",
            description="Prvni ukol",
        )
        db.session.add(translation)
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

    response = test_client.get("/api/race/1/tasks/1/?lang=cs", headers=headers)
    assert response.status_code == 200
    assert response.json["title"] == "Ukol 1"
    assert response.json["description"] == "Prvni ukol"

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
    assert "errors" in response.json
    assert "title" in str(response.json["errors"])

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

def test_get_single_task_unauthorized(test_client, add_test_data):
    """Explicitly verify 401 for get_task without JWT"""
    response = test_client.get("/api/race/1/tasks/1/")
    assert response.status_code == 401

def test_create_task_invalid_race_404(test_client, add_test_data):
    """Creating a task for a non-existent race returns 404"""
    response = test_client.post("/auth/login/", json={"email": "admin@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}

    resp = test_client.post(
        "/api/race/999/tasks/",
        json={"title": "Invalid Race Task", "description": "Should 404", "numOfPoints": 3},
        headers=headers,
    )
    assert resp.status_code == 404
    assert resp.json.get("message") == "Race not found"


def test_get_tasks_with_translation_lang_param(test_client, add_test_data):
    """Translated fields are returned when lang is provided."""
    response = test_client.post("/auth/login/", json={"email": "admin@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}

    response = test_client.get("/api/race/1/tasks/?lang=cs", headers=headers)
    assert response.status_code == 200
    tasks_by_id = {item["id"]: item for item in response.json}
    assert tasks_by_id[1]["title"] == "Ukol 1"
    assert tasks_by_id[1]["description"] == "Prvni ukol"
    assert tasks_by_id[2]["title"] == "Task 2"
