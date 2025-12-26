import pytest
from app import create_app, db
from app.models import Race, Checkpoint, CheckpointLog, User
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
    # insert test data
    with test_app.app_context():
        now = datetime.now()
        some_time_earlier = now - timedelta(minutes=10)
        some_time_later = now + timedelta(minutes=10)
        race1 = Race(name="Jarní jízda", description="24 hodin objevování Česka", start_showing_checkpoints_at=some_time_earlier, 
                     end_showing_checkpoints_at=some_time_later, start_logging_at=some_time_earlier, end_logging_at=some_time_later)

        check1 = Checkpoint(title="Praha", latitude=50.0755381, longitude=14.4378005, description="Hlavní město České republiky", numOfPoints = 1)
        check2 = Checkpoint(title="Brno", latitude=49.1950602, longitude=16.6068371, description="Město na jihu Moravy", numOfPoints = 1)
        check1.race_id = 1
        check2.race_id = 1

        db.session.add_all([race1, check1, check2])
        db.session.commit()

def test_get_all_races(test_client, add_test_data):
    """Test endpoint GET /api/race """
    response = test_client.get("/api/race/")
    assert response.status_code == 200
    assert response.json[0]["id"] == 1
    assert response.json[0]["name"] == "Jarní jízda"
    assert response.json[0]["description"] == "24 hodin objevování Česka"
    # testing more races is done below as part of test_create_race

    # TODO: test also empty race list

    # FIXME: test time constraints for race

def test_get_single_race(test_client, add_test_data):
    """Test endpoint GET /api/race/race_id """
    response = test_client.get("/api/race/1/") # race exist
    assert response.status_code == 200
    assert response.json["id"] == 1
    assert response.json["name"] == "Jarní jízda"
    assert response.json["description"] == "24 hodin objevování Česka"

    response = test_client.get("/api/race/2/") # non existing race
    assert response.status_code == 404

    # FIXME: test time constraints for race

def test_create_race(test_client, add_test_data):
    """Test endpoint POST /api/race """
    # login as an admin
    response = test_client.post("/auth/register/", json={"name": "test", "email": "test@example.com", "password": "test", "is_administrator": True})
    response = test_client.post("/auth/login/", json={"email": "test@example.com", "password": "test"})
    access_token = response.json["access_token"]

    now = datetime.now()
    some_time_later = now + timedelta(minutes=10)
    # create the race
    response = test_client.post("/api/race/", json={
        "name": "Hill Bill Rally", 
        "description": "Roadtrip po Balkáně.",
        "start_showing_checkpoints_at": now.isoformat(),
        "end_showing_checkpoints_at": some_time_later.isoformat(),
        "start_logging_at": now.isoformat(),
        "end_logging_at": some_time_later.isoformat()}, headers={"Authorization": f"Bearer {access_token}"})
    assert response.status_code == 201
    data = response.get_json()
    assert response.json["id"] == 2
    assert response.json["name"] == "Hill Bill Rally"
    assert response.json["description"] == "Roadtrip po Balkáně."

    response = test_client.get("/api/race/") # get all races to see added race
    assert response.status_code == 200
    assert response.json[0]["id"] == 1
    assert response.json[1]["id"] == 2
    assert response.json[0]["name"] == "Jarní jízda"
    assert response.json[1]["name"] == "Hill Bill Rally"
    assert response.json[0]["description"] == "24 hodin objevování Česka"
    assert response.json[1]["description"] == "Roadtrip po Balkáně."
    

    response = test_client.delete("/api/race/1/", headers={"Authorization": f"Bearer {access_token}"}) # FIXME: test is failing due to checkpoints assigned to the race, TODO: write separate test for deleting race
    assert response.status_code == 400  # Cannot delete race with checkpoints

    response = test_client.get("/api/race/") # get all races to see both races still exist
    assert response.status_code == 200
    assert len(response.json) == 2


def test_create_race_requires_admin(test_client):
    """Test that creating a race requires admin privileges."""
    # register non-admin user
    test_client.post("/auth/register/", json={"name": "user", "email": "user@example.com", "password": "pass"})
    response = test_client.post("/auth/login/", json={"email": "user@example.com", "password": "pass"})
    access_token = response.json["access_token"]
    
    now = datetime.now()
    later = now + timedelta(hours=1)
    
    # try to create race as non-admin
    response = test_client.post("/api/race/", json={
        "name": "Test Race",
        "description": "Should fail",
        "start_showing_checkpoints_at": now.isoformat(),
        "end_showing_checkpoints_at": later.isoformat(),
        "start_logging_at": now.isoformat(),
        "end_logging_at": later.isoformat()
    }, headers={"Authorization": f"Bearer {access_token}"})
    
    assert response.status_code == 403


def test_update_race(test_client, add_test_data):
    """Test endpoint PUT /api/race/<race_id>"""
    # login as admin
    test_client.post("/auth/register/", json={"name": "admin", "email": "admin@example.com", "password": "pass", "is_administrator": True})
    response = test_client.post("/auth/login/", json={"email": "admin@example.com", "password": "pass"})
    access_token = response.json["access_token"]
    
    # update race name only
    response = test_client.put("/api/race/1/", json={"name": "Updated Name"}, 
                              headers={"Authorization": f"Bearer {access_token}"})
    assert response.status_code == 200
    assert response.json["name"] == "Updated Name"
    assert response.json["description"] == "24 hodin objevování Česka"  # unchanged
    
    # update description only
    response = test_client.put("/api/race/1/", json={"description": "New description"}, 
                              headers={"Authorization": f"Bearer {access_token}"})
    assert response.status_code == 200
    assert response.json["name"] == "Updated Name"  # still updated
    assert response.json["description"] == "New description"
    
    # update multiple fields
    now = datetime.now()
    new_time = now + timedelta(days=1)
    response = test_client.put("/api/race/1/", json={
        "name": "Final Name",
        "description": "Final Description",
        "start_logging_at": new_time.isoformat()
    }, headers={"Authorization": f"Bearer {access_token}"})
    assert response.status_code == 200
    assert response.json["name"] == "Final Name"
    assert response.json["description"] == "Final Description"


def test_update_race_not_found(test_client):
    """Test updating non-existent race returns 404."""
    test_client.post("/auth/register/", json={"name": "admin", "email": "admin@example.com", "password": "pass", "is_administrator": True})
    response = test_client.post("/auth/login/", json={"email": "admin@example.com", "password": "pass"})
    access_token = response.json["access_token"]
    
    response = test_client.put("/api/race/999/", json={"name": "Test"}, 
                              headers={"Authorization": f"Bearer {access_token}"})
    assert response.status_code == 404


def test_update_race_requires_admin(test_client, add_test_data):
    """Test that updating a race requires admin privileges."""
    # non-admin user
    test_client.post("/auth/register/", json={"name": "user", "email": "user@example.com", "password": "pass"})
    response = test_client.post("/auth/login/", json={"email": "user@example.com", "password": "pass"})
    access_token = response.json["access_token"]
    
    response = test_client.put("/api/race/1/", json={"name": "Hacked"}, 
                              headers={"Authorization": f"Bearer {access_token}"})
    assert response.status_code == 403


def test_delete_race_success(test_client):
    """Test deleting a race without any dependencies."""
    # create admin and race
    test_client.post("/auth/register/", json={"name": "admin", "email": "admin@example.com", "password": "pass", "is_administrator": True})
    response = test_client.post("/auth/login/", json={"email": "admin@example.com", "password": "pass"})
    access_token = response.json["access_token"]
    
    now = datetime.now()
    later = now + timedelta(hours=1)
    
    response = test_client.post("/api/race/", json={
        "name": "Deletable Race",
        "description": "Will be deleted",
        "start_showing_checkpoints_at": now.isoformat(),
        "end_showing_checkpoints_at": later.isoformat(),
        "start_logging_at": now.isoformat(),
        "end_logging_at": later.isoformat()
    }, headers={"Authorization": f"Bearer {access_token}"})
    race_id = response.json["id"]
    
    # delete it
    response = test_client.delete(f"/api/race/{race_id}/", headers={"Authorization": f"Bearer {access_token}"})
    assert response.status_code == 200
    
    # verify it's gone
    response = test_client.get(f"/api/race/{race_id}/")
    assert response.status_code == 404


def test_delete_race_with_checkpoints(test_client, add_test_data):
    """Test that race with checkpoints cannot be deleted."""
    test_client.post("/auth/register/", json={"name": "admin", "email": "admin@example.com", "password": "pass", "is_administrator": True})
    response = test_client.post("/auth/login/", json={"email": "admin@example.com", "password": "pass"})
    access_token = response.json["access_token"]
    
    # race 1 has checkpoints from fixture
    response = test_client.delete("/api/race/1/", headers={"Authorization": f"Bearer {access_token}"})
    assert response.status_code == 400
    assert "checkpoints" in response.json["message"]


def test_delete_race_not_found(test_client):
    """Test deleting non-existent race returns 404."""
    test_client.post("/auth/register/", json={"name": "admin", "email": "admin@example.com", "password": "pass", "is_administrator": True})
    response = test_client.post("/auth/login/", json={"email": "admin@example.com", "password": "pass"})
    access_token = response.json["access_token"]
    
    response = test_client.delete("/api/race/999/", headers={"Authorization": f"Bearer {access_token}"})
    assert response.status_code == 404


def test_delete_race_requires_admin(test_client, add_test_data):
    """Test that deleting a race requires admin privileges."""
    test_client.post("/auth/register/", json={"name": "user", "email": "user@example.com", "password": "pass"})
    response = test_client.post("/auth/login/", json={"email": "user@example.com", "password": "pass"})
    access_token = response.json["access_token"]
    
    response = test_client.delete("/api/race/1/", headers={"Authorization": f"Bearer {access_token}"})
    assert response.status_code == 403


def test_get_races_empty(test_client):
    """Test getting races when database is empty."""
    response = test_client.get("/api/race/")
    assert response.status_code == 200
    assert response.json == []


def test_delete_race_with_tasks(test_client, test_app):
    """Test that race with tasks cannot be deleted."""
    from app.models import Task
    
    with test_app.app_context():
        # create admin
        test_client.post("/auth/register/", json={"name": "admin", "email": "admin@example.com", "password": "pass", "is_administrator": True})
        response = test_client.post("/auth/login/", json={"email": "admin@example.com", "password": "pass"})
        access_token = response.json["access_token"]
        
        # create a race
        now = datetime.now()
        later = now + timedelta(hours=1)
        response = test_client.post("/api/race/", json={
            "name": "Race with Tasks",
            "description": "Has tasks",
            "start_showing_checkpoints_at": now.isoformat(),
            "end_showing_checkpoints_at": later.isoformat(),
            "start_logging_at": now.isoformat(),
            "end_logging_at": later.isoformat()
        }, headers={"Authorization": f"Bearer {access_token}"})
        race_id = response.json["id"]
        
        # add a task to the race
        task = Task(title="Test Task", description="Task desc", numOfPoints=10, race_id=race_id)
        db.session.add(task)
        db.session.commit()
        
        # try to delete race with tasks
        response = test_client.delete(f"/api/race/{race_id}/", headers={"Authorization": f"Bearer {access_token}"})
        assert response.status_code == 400
        assert "tasks" in response.json["message"]


def test_delete_race_with_registrations(test_client, test_app):
    """Test that race with registrations cannot be deleted."""
    from app.models import Team, RaceCategory, Registration
    
    with test_app.app_context():
        # create admin
        test_client.post("/auth/register/", json={"name": "admin", "email": "admin@example.com", "password": "pass", "is_administrator": True})
        response = test_client.post("/auth/login/", json={"email": "admin@example.com", "password": "pass"})
        access_token = response.json["access_token"]
        
        # create a race
        now = datetime.now()
        later = now + timedelta(hours=1)
        response = test_client.post("/api/race/", json={
            "name": "Race with Registrations",
            "description": "Has registrations",
            "start_showing_checkpoints_at": now.isoformat(),
            "end_showing_checkpoints_at": later.isoformat(),
            "start_logging_at": now.isoformat(),
            "end_logging_at": later.isoformat()
        }, headers={"Authorization": f"Bearer {access_token}"})
        race_id = response.json["id"]
        
        # add team, category and registration
        team = Team(name="Test Team")
        category = RaceCategory(name="Test Category")
        db.session.add(team)
        db.session.add(category)
        db.session.commit()
        
        registration = Registration(race_id=race_id, team_id=team.id, race_category_id=category.id)
        db.session.add(registration)
        db.session.commit()
        
        # try to delete race with registrations
        response = test_client.delete(f"/api/race/{race_id}/", headers={"Authorization": f"Bearer {access_token}"})
        assert response.status_code == 400
        assert "registrations" in response.json["message"]


def test_delete_race_with_checkpoint_logs(test_client, test_app):
    """Test that race with checkpoint logs cannot be deleted."""
    from app.models import Team, User, Checkpoint
    
    with test_app.app_context():
        # create admin
        test_client.post("/auth/register/", json={"name": "admin", "email": "admin@example.com", "password": "pass", "is_administrator": True})
        response = test_client.post("/auth/login/", json={"email": "admin@example.com", "password": "pass"})
        access_token = response.json["access_token"]
        
        # create a race
        now = datetime.now()
        later = now + timedelta(hours=1)
        response = test_client.post("/api/race/", json={
            "name": "Race with Logs",
            "description": "Has logs",
            "start_showing_checkpoints_at": now.isoformat(),
            "end_showing_checkpoints_at": later.isoformat(),
            "start_logging_at": now.isoformat(),
            "end_logging_at": later.isoformat()
        }, headers={"Authorization": f"Bearer {access_token}"})
        race_id = response.json["id"]
        
        # add checkpoint and log
        checkpoint = Checkpoint(title="CP1", latitude=50.0, longitude=14.0, numOfPoints=1, race_id=race_id)
        team = Team(name="Team")
        user = User.query.filter_by(email="admin@example.com").first()
        db.session.add(checkpoint)
        db.session.add(team)
        db.session.commit()
        
        log = CheckpointLog(checkpoint_id=checkpoint.id, team_id=team.id, race_id=race_id)
        db.session.add(log)
        db.session.commit()
        
        # first remove the checkpoint relationship
        db.session.delete(checkpoint)
        db.session.commit()
        
        # try to delete race with logs
        response = test_client.delete(f"/api/race/{race_id}/", headers={"Authorization": f"Bearer {access_token}"})
        assert response.status_code == 400
        assert "visits" in response.json["message"]


def test_delete_race_with_task_logs(test_client, test_app):
    """Test that race with task logs cannot be deleted."""
    from app.models import Team, User, Task, TaskLog
    
    with test_app.app_context():
        # create admin
        test_client.post("/auth/register/", json={"name": "admin", "email": "admin@example.com", "password": "pass", "is_administrator": True})
        response = test_client.post("/auth/login/", json={"email": "admin@example.com", "password": "pass"})
        access_token = response.json["access_token"]
        
        # create a race
        now = datetime.now()
        later = now + timedelta(hours=1)
        response = test_client.post("/api/race/", json={
            "name": "Race with Task Logs",
            "description": "Has task logs",
            "start_showing_checkpoints_at": now.isoformat(),
            "end_showing_checkpoints_at": later.isoformat(),
            "start_logging_at": now.isoformat(),
            "end_logging_at": later.isoformat()
        }, headers={"Authorization": f"Bearer {access_token}"})
        race_id = response.json["id"]
        
        # add task and log
        task = Task(title="Task", description="Desc", numOfPoints=10, race_id=race_id)
        team = Team(name="Team")
        user = User.query.filter_by(email="admin@example.com").first()
        db.session.add(task)
        db.session.add(team)
        db.session.commit()
        
        task_log = TaskLog(task_id=task.id, team_id=team.id, race_id=race_id)
        db.session.add(task_log)
        db.session.commit()
        
        # first remove the task relationship
        db.session.delete(task)
        db.session.commit()
        
        # try to delete race with task logs
        response = test_client.delete(f"/api/race/{race_id}/", headers={"Authorization": f"Bearer {access_token}"})
        assert response.status_code == 400
        assert "task completions" in response.json["message"]



