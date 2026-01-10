"""
Test cases for app/routes/task.py endpoints.

Tests the admin-only task endpoints:
- GET /api/task/<task_id>/ - Get single task details
- DELETE /api/task/<task_id>/ - Delete task with logs and images
"""

import pytest
from app import db
from app.models import Race, Task, TaskLog, Image, Team, Registration, RaceCategory
from datetime import datetime, timedelta


@pytest.fixture
def add_test_data(test_app):
    """Create test data including tasks, logs, and images."""
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

        # Create teams
        team1 = Team(name="Team Alpha")
        team2 = Team(name="Team Beta")
        db.session.add_all([team1, team2])
        db.session.commit()

        # Create registrations
        registration1 = Registration(race_id=race1.id, team_id=team1.id, race_category_id=category1.id)
        registration2 = Registration(race_id=race1.id, team_id=team2.id, race_category_id=category1.id)
        db.session.add_all([registration1, registration2])
        db.session.commit()

        # Create tasks
        task1 = Task(title="Task 1", description="First task", numOfPoints=5, race_id=race1.id)
        task2 = Task(title="Task 2", description="Second task", numOfPoints=10, race_id=race1.id)
        task3 = Task(title="Task with logs", description="Has logs", numOfPoints=15, race_id=race1.id)
        
        db.session.add_all([task1, task2, task3])
        db.session.commit()

        # Create image
        image1 = Image(filename="test_image.jpg")
        db.session.add(image1)
        db.session.commit()

        # Create task logs (different teams to avoid unique constraint violation)
        log1 = TaskLog(task_id=task3.id, team_id=team1.id, race_id=race1.id, image_id=image1.id)
        log2 = TaskLog(task_id=task3.id, team_id=team2.id, race_id=race1.id, image_id=None)
        
        db.session.add_all([log1, log2])
        db.session.commit()


# GET /api/task/<task_id>/ endpoint tests

def test_get_task_success(test_client, add_test_data, admin_auth_headers):
    """Test getting a task successfully as admin."""
    response = test_client.get("/api/task/1/", headers=admin_auth_headers)
    assert response.status_code == 200
    assert response.json["id"] == 1
    assert response.json["title"] == "Task 1"
    assert response.json["description"] == "First task"
    assert response.json["numOfPoints"] == 5


def test_get_task_with_different_data(test_client, add_test_data, admin_auth_headers):
    """Test getting different tasks returns correct data."""
    response = test_client.get("/api/task/2/", headers=admin_auth_headers)
    assert response.status_code == 200
    assert response.json["id"] == 2
    assert response.json["title"] == "Task 2"
    assert response.json["description"] == "Second task"
    assert response.json["numOfPoints"] == 10


def test_get_task_not_found(test_client, add_test_data, admin_auth_headers):
    """Test getting non-existent task returns 404."""
    response = test_client.get("/api/task/999/", headers=admin_auth_headers)
    assert response.status_code == 404


def test_get_task_unauthorized(test_client, add_test_data):
    """Test getting task without JWT returns 401."""
    response = test_client.get("/api/task/1/")
    assert response.status_code == 401


def test_get_task_forbidden_non_admin(test_client, add_test_data, regular_user_auth_headers):
    """Test getting task as non-admin returns 403."""
    response = test_client.get("/api/task/1/", headers=regular_user_auth_headers)
    assert response.status_code == 403


# DELETE /api/task/<task_id>/ endpoint tests

def test_delete_task_success(test_client, add_test_data, admin_auth_headers):
    """Test deleting a task successfully as admin."""
    response = test_client.delete("/api/task/1/", headers=admin_auth_headers)
    assert response.status_code == 200
    assert response.json["message"] == "Task and associated logs deleted."
    
    # Verify task is deleted
    response = test_client.get("/api/task/1/", headers=admin_auth_headers)
    assert response.status_code == 404


# PUT /api/task/<task_id>/ endpoint tests

def test_update_task_success(test_client, add_test_data, admin_auth_headers):
    """Test updating a task successfully as admin."""
    update_data = {
        "title": "Updated Task 1",
        "description": "Updated description",
        "numOfPoints": 15
    }
    response = test_client.put("/api/task/1/", json=update_data, headers=admin_auth_headers)
    assert response.status_code == 200
    assert response.json["title"] == "Updated Task 1"
    assert response.json["description"] == "Updated description"
    assert response.json["numOfPoints"] == 15
    
    # Verify the update persisted
    response = test_client.get("/api/task/1/", headers=admin_auth_headers)
    assert response.status_code == 200
    assert response.json["title"] == "Updated Task 1"
    assert response.json["description"] == "Updated description"
    assert response.json["numOfPoints"] == 15


def test_update_task_partial(test_client, add_test_data, admin_auth_headers):
    """Test partial update of task (only some fields)."""
    update_data = {
        "title": "New Title Only"
    }
    response = test_client.put("/api/task/2/", json=update_data, headers=admin_auth_headers)
    assert response.status_code == 200
    assert response.json["title"] == "New Title Only"
    # Other fields should remain unchanged
    assert response.json["description"] == "Second task"
    assert response.json["numOfPoints"] == 10


def test_update_task_not_found(test_client, add_test_data, admin_auth_headers):
    """Test updating non-existent task returns 404."""
    update_data = {"title": "Test"}
    response = test_client.put("/api/task/999/", json=update_data, headers=admin_auth_headers)
    assert response.status_code == 404


def test_update_task_unauthorized(test_client, add_test_data):
    """Test updating task without JWT returns 401."""
    response = test_client.put("/api/task/1/", json={"title": "Test"})
    assert response.status_code == 401


def test_update_task_forbidden_non_admin(test_client, add_test_data, regular_user_auth_headers):
    """Test updating task as non-admin returns 403."""
    response = test_client.put("/api/task/1/", json={"title": "Test"}, headers=regular_user_auth_headers)
    assert response.status_code == 403


def test_delete_task_with_logs_and_images(test_client, add_test_data, admin_auth_headers):
    """Test deleting task with associated logs and images."""
    with test_client.application.app_context():
        # Verify task 3 has logs and images
        logs = TaskLog.query.filter_by(task_id=3).all()
        assert len(logs) == 2
        
        # Verify image exists
        image = Image.query.filter_by(id=1).first()
        assert image is not None
    
    # Delete the task
    response = test_client.delete("/api/task/3/", headers=admin_auth_headers)
    assert response.status_code == 200
    assert response.json["message"] == "Task and associated logs deleted."
    
    with test_client.application.app_context():
        # Verify task is deleted
        task = Task.query.filter_by(id=3).first()
        assert task is None
        
        # Verify logs are deleted
        logs = TaskLog.query.filter_by(task_id=3).all()
        assert len(logs) == 0
        
        # Verify image is deleted from database
        image = Image.query.filter_by(id=1).first()
        assert image is None


def test_delete_task_without_logs(test_client, add_test_data, admin_auth_headers):
    """Test deleting task that has no logs."""
    with test_client.application.app_context():
        # Verify task 2 has no logs
        logs = TaskLog.query.filter_by(task_id=2).all()
        assert len(logs) == 0
    
    response = test_client.delete("/api/task/2/", headers=admin_auth_headers)
    assert response.status_code == 200
    assert response.json["message"] == "Task and associated logs deleted."
    
    with test_client.application.app_context():
        # Verify task is deleted
        task = Task.query.filter_by(id=2).first()
        assert task is None


def test_delete_task_not_found(test_client, add_test_data, admin_auth_headers):
    """Test deleting non-existent task returns 404."""
    response = test_client.delete("/api/task/999/", headers=admin_auth_headers)
    assert response.status_code == 404


def test_delete_task_unauthorized(test_client, add_test_data):
    """Test deleting task without JWT returns 401."""
    response = test_client.delete("/api/task/1/")
    assert response.status_code == 401


def test_delete_task_forbidden_non_admin(test_client, add_test_data, regular_user_auth_headers):
    """Test deleting task as non-admin returns 403."""
    response = test_client.delete("/api/task/1/", headers=regular_user_auth_headers)
    assert response.status_code == 403


def test_delete_task_multiple_times(test_client, add_test_data, admin_auth_headers):
    """Test deleting same task twice returns 404 on second attempt."""
    # First deletion should succeed
    response = test_client.delete("/api/task/1/", headers=admin_auth_headers)
    assert response.status_code == 200
    
    # Second deletion should fail with 404
    response = test_client.delete("/api/task/1/", headers=admin_auth_headers)
    assert response.status_code == 404


def test_get_deleted_task(test_client, add_test_data, admin_auth_headers):
    """Test getting a task after it has been deleted returns 404."""
    # Delete the task
    response = test_client.delete("/api/task/1/", headers=admin_auth_headers)
    assert response.status_code == 200
    
    # Try to get the deleted task
    response = test_client.get("/api/task/1/", headers=admin_auth_headers)
    assert response.status_code == 404
