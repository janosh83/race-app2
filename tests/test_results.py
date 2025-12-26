import pytest
from datetime import datetime, timedelta
from app import db
from app.models import Race, Checkpoint, Team, Registration, RaceCategory, User, Task


@pytest.fixture
def add_test_data(test_app):
    """Seed two races with teams, checkpoints, tasks, and registrations."""
    with test_app.app_context():
        now = datetime.utcnow()
        open_from = now - timedelta(minutes=15)
        open_to = now + timedelta(minutes=15)

        # Races
        race1 = Race(
            name="Jarní jízda",
            description="24 hodin objevování Česka",
            start_showing_checkpoints_at=open_from,
            end_showing_checkpoints_at=open_to,
            start_logging_at=open_from,
            end_logging_at=open_to,
        )
        race2 = Race(
            name="Letní sprint",
            description="Rychlá letní soutěž",
            start_showing_checkpoints_at=open_from,
            end_showing_checkpoints_at=open_to,
            start_logging_at=open_from,
            end_logging_at=open_to,
        )
        db.session.add_all([race1, race2])
        db.session.commit()

        # Checkpoints for race 1 (1, 1, 1 points)
        check1 = Checkpoint(title="Praha", latitude=50.0755, longitude=14.4378, description="Capital", numOfPoints=1, race_id=race1.id)
        check2 = Checkpoint(title="Brno", latitude=49.1950, longitude=16.6068, description="City", numOfPoints=1, race_id=race1.id)
        check3 = Checkpoint(title="Ostrava", latitude=49.8209, longitude=18.2625, description="City", numOfPoints=1, race_id=race1.id)
        db.session.add_all([check1, check2, check3])

        # Checkpoints for race 2 (1, 2 points)
        check4 = Checkpoint(title="Plzeň", latitude=49.7475, longitude=13.3776, description="City", numOfPoints=1, race_id=race2.id)
        check5 = Checkpoint(title="Liberec", latitude=50.7671, longitude=15.0562, description="City", numOfPoints=2, race_id=race2.id)
        db.session.add_all([check4, check5])

        # Tasks for race 1 (2, 3 points)
        task1 = Task(title="T1", description="d1", numOfPoints=2, race_id=race1.id)
        task2 = Task(title="T2", description="d2", numOfPoints=3, race_id=race1.id)
        db.session.add_all([task1, task2])

        # Teams
        team1 = Team(name="Rychlíci")
        team2 = Team(name="Dobrodruzi")
        team3 = Team(name="Objevitelé")
        team4 = Team(name="Cestovatelé")
        team5 = Team(name="Průzkumníci")
        db.session.add_all([team1, team2, team3, team4, team5])
        db.session.commit()

        # Category
        category = RaceCategory(name="Kola", description="Na libovolném kole.")
        db.session.add(category)
        db.session.commit()

        # Registrations
        reg1 = Registration(race_id=race1.id, team_id=team1.id, race_category_id=category.id)
        reg2 = Registration(race_id=race1.id, team_id=team2.id, race_category_id=category.id)
        reg3 = Registration(race_id=race1.id, team_id=team3.id, race_category_id=category.id)
        reg4 = Registration(race_id=race2.id, team_id=team4.id, race_category_id=category.id)
        reg5 = Registration(race_id=race2.id, team_id=team5.id, race_category_id=category.id)
        db.session.add_all([reg1, reg2, reg3, reg4, reg5])
        db.session.commit()


# Checkpoint-only results
def test_get_race_results_checkpoints_only(test_client, add_test_data, admin_auth_headers):
    """Test race results with only checkpoint visits."""
    # Team1: 1 checkpoint (Praha = 1 point)
    test_client.post("/api/race/1/checkpoints/log/", json={"checkpoint_id": 1, "team_id": 1}, headers=admin_auth_headers)
    # Team2: 2 checkpoints (Brno + Ostrava = 1 + 1 = 2 points)
    test_client.post("/api/race/1/checkpoints/log/", json={"checkpoint_id": 2, "team_id": 2}, headers=admin_auth_headers)
    test_client.post("/api/race/1/checkpoints/log/", json={"checkpoint_id": 3, "team_id": 2}, headers=admin_auth_headers)
    # Team3: no checkpoints

    resp = test_client.get("/api/race/1/results/", headers=admin_auth_headers)
    assert resp.status_code == 200
    assert len(resp.json) == 3
    
    by_team = {r["team_id"]: r for r in resp.json}
    assert by_team[1]["team"] == "Rychlíci"
    assert by_team[1]["points_for_checkpoints"] == 1
    assert by_team[1]["points_for_tasks"] == 0
    assert by_team[1]["total_points"] == 1
    
    assert by_team[2]["team"] == "Dobrodruzi"
    assert by_team[2]["points_for_checkpoints"] == 2
    assert by_team[2]["points_for_tasks"] == 0
    assert by_team[2]["total_points"] == 2
    
    assert by_team[3]["team"] == "Objevitelé"
    assert by_team[3]["points_for_checkpoints"] == 0
    assert by_team[3]["points_for_tasks"] == 0
    assert by_team[3]["total_points"] == 0


def test_get_race_results_tasks_only(test_client, add_test_data, admin_auth_headers):
    """Test race results with only task completions."""
    # Team1: Task1 (2 points)
    test_client.post("/api/race/1/tasks/log/", json={"task_id": 1, "team_id": 1}, headers=admin_auth_headers)
    # Team2: Task1 + Task2 (2 + 3 = 5 points)
    test_client.post("/api/race/1/tasks/log/", json={"task_id": 1, "team_id": 2}, headers=admin_auth_headers)
    test_client.post("/api/race/1/tasks/log/", json={"task_id": 2, "team_id": 2}, headers=admin_auth_headers)
    # Team3: no tasks

    resp = test_client.get("/api/race/1/results/", headers=admin_auth_headers)
    assert resp.status_code == 200
    
    by_team = {r["team_id"]: r for r in resp.json}
    assert by_team[1]["points_for_checkpoints"] == 0
    assert by_team[1]["points_for_tasks"] == 2
    assert by_team[1]["total_points"] == 2
    
    assert by_team[2]["points_for_checkpoints"] == 0
    assert by_team[2]["points_for_tasks"] == 5
    assert by_team[2]["total_points"] == 5
    
    assert by_team[3]["points_for_checkpoints"] == 0
    assert by_team[3]["points_for_tasks"] == 0
    assert by_team[3]["total_points"] == 0


def test_get_race_results_mixed_checkpoints_and_tasks(test_client, add_test_data, admin_auth_headers):
    """Test race results combining both checkpoint visits and task completions."""
    # Team1: 1 checkpoint (1 point) + 1 task (2 points) = 3 total
    test_client.post("/api/race/1/checkpoints/log/", json={"checkpoint_id": 1, "team_id": 1}, headers=admin_auth_headers)
    test_client.post("/api/race/1/tasks/log/", json={"task_id": 1, "team_id": 1}, headers=admin_auth_headers)
    
    # Team2: 2 checkpoints (2 points) + 1 task (3 points) = 5 total
    test_client.post("/api/race/1/checkpoints/log/", json={"checkpoint_id": 2, "team_id": 2}, headers=admin_auth_headers)
    test_client.post("/api/race/1/checkpoints/log/", json={"checkpoint_id": 3, "team_id": 2}, headers=admin_auth_headers)
    test_client.post("/api/race/1/tasks/log/", json={"task_id": 2, "team_id": 2}, headers=admin_auth_headers)

    resp = test_client.get("/api/race/1/results/", headers=admin_auth_headers)
    assert resp.status_code == 200
    
    by_team = {r["team_id"]: r for r in resp.json}
    assert by_team[1]["points_for_checkpoints"] == 1
    assert by_team[1]["points_for_tasks"] == 2
    assert by_team[1]["total_points"] == 3
    
    assert by_team[2]["points_for_checkpoints"] == 2
    assert by_team[2]["points_for_tasks"] == 3
    assert by_team[2]["total_points"] == 5


def test_get_race_results_empty_race(test_client, add_test_data, admin_auth_headers):
    """Test race results when no checkpoints or tasks have been logged."""
    resp = test_client.get("/api/race/1/results/", headers=admin_auth_headers)
    assert resp.status_code == 200
    assert len(resp.json) == 3
    
    # All teams with 0 points
    for team_result in resp.json:
        assert team_result["points_for_checkpoints"] == 0
        assert team_result["points_for_tasks"] == 0
        assert team_result["total_points"] == 0


def test_get_race_results_invalid_race_404(test_client, add_test_data, admin_auth_headers):
    """Test that invalid race returns 404."""
    resp = test_client.get("/api/race/999/results/", headers=admin_auth_headers)
    assert resp.status_code == 404


def test_get_race_results_requires_auth(test_client, add_test_data):
    """Test that unauthenticated users cannot access results."""
    resp = test_client.get("/api/race/1/results/")
    assert resp.status_code == 401


def test_get_race_results_different_races(test_client, add_test_data, admin_auth_headers):
    """Test results for different races are isolated."""
    # Log for race 1
    test_client.post("/api/race/1/checkpoints/log/", json={"checkpoint_id": 1, "team_id": 1}, headers=admin_auth_headers)
    
    # Log for race 2 (different checkpoints with different points)
    test_client.post("/api/race/2/checkpoints/log/", json={"checkpoint_id": 4, "team_id": 4}, headers=admin_auth_headers)  # 1 point
    test_client.post("/api/race/2/checkpoints/log/", json={"checkpoint_id": 5, "team_id": 4}, headers=admin_auth_headers)  # 2 points

    # Race 1 results
    resp1 = test_client.get("/api/race/1/results/", headers=admin_auth_headers)
    assert resp1.status_code == 200
    team1_r1 = next(r for r in resp1.json if r["team_id"] == 1)
    assert team1_r1["points_for_checkpoints"] == 1

    # Race 2 results
    resp2 = test_client.get("/api/race/2/results/", headers=admin_auth_headers)
    assert resp2.status_code == 200
    team4_r2 = next(r for r in resp2.json if r["team_id"] == 4)
    assert team4_r2["points_for_checkpoints"] == 3  # 1 + 2 from two checkpoints


def test_get_race_results_includes_category(test_client, add_test_data, admin_auth_headers):
    """Test that results include the race category name."""
    resp = test_client.get("/api/race/1/results/", headers=admin_auth_headers)
    assert resp.status_code == 200
    
    for team_result in resp.json:
        assert team_result["category"] == "Kola"
        assert "team" in team_result
        assert "team_id" in team_result
