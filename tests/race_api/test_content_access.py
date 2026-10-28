"""Who may read a race's checkpoints and tasks, and when.

Admins always; other users only with a paid registration for the race and
only while checkpoints are shown (start_showing <= now <= end_showing).
"""
from datetime import datetime, timedelta

import pytest

from app import create_app, db
from app.models import Checkpoint, Race, RaceCategory, Registration, Task, Team, User

PASSWORD = "password"
NOT_SHOWN = "Checkpoints and tasks for this race are not shown at this time."
NOT_REGISTERED = "You are not registered for this race."

# race name -> (start_showing, end_showing) in hours from now
RACES = {
    "before": (2, 4),
    "showing": (-1, 1),
    "after": (-4, -2),
}

# Read endpoints for checkpoints and tasks; {team} is the requesting user's team.
ENDPOINTS = [
    "/api/race/{race}/checkpoints/",
    "/api/race/{race}/checkpoints/{checkpoint}/",
    "/api/race/{race}/checkpoints/{team}/status/",
    "/api/race/{race}/tasks/",
    "/api/race/{race}/tasks/{task}/",
    "/api/race/{race}/tasks/{team}/status/",
]


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
def ids(test_app):
    """Seed one race per phase. Team 'member' is registered (paid) for all of
    them, team 'unpaid' has unpaid registrations, team 'outsider' none."""
    now = datetime.now()
    category = RaceCategory(name="Open")
    db.session.add(category)
    db.session.flush()

    result = {"races": {}, "teams": {}}
    races = {}
    for name, (start, end) in RACES.items():
        race = Race(
            name=name,
            description=name,
            start_showing_checkpoints_at=now + timedelta(hours=start),
            end_showing_checkpoints_at=now + timedelta(hours=end),
            start_logging_at=now + timedelta(hours=start),
            end_logging_at=now + timedelta(hours=end),
        )
        race.checkpoints.append(Checkpoint(title=f"{name} checkpoint", latitude=50.0, longitude=14.0, numOfPoints=1))
        race.tasks.append(Task(title=f"{name} task", description="d", numOfPoints=1))
        races[name] = race
        db.session.add(race)

    admin = User(name="admin", email="admin@example.com", is_administrator=True)
    admin.set_password(PASSWORD)
    db.session.add(admin)
    for key in ("member", "unpaid", "outsider"):
        user = User(name=key, email=f"{key}@example.com")
        user.set_password(PASSWORD)
        team = Team(name=key, members=[user])
        db.session.add(team)
        db.session.flush()
        result["teams"][key] = team.id
        if key != "outsider":
            for race in races.values():
                db.session.add(Registration(race=race, team=team, race_category_id=category.id,
                                            payment_confirmed=key == "member"))
    db.session.commit()

    for name, race in races.items():
        result["races"][name] = {"race": race.id, "checkpoint": race.checkpoints[0].id, "task": race.tasks[0].id}
    result["teams"]["admin"] = result["teams"]["outsider"]  # admins may read any team
    return result


def _get(test_client, ids, user, race, endpoint):
    login = test_client.post("/auth/login/", json={"email": f"{user}@example.com", "password": PASSWORD})
    headers = {"Authorization": f"Bearer {login.json['access_token']}"}
    url = endpoint.format(team=ids["teams"][user], **ids["races"][race])
    return test_client.get(url, headers=headers)


@pytest.mark.parametrize("endpoint", ENDPOINTS)
def test_member_reads_content_while_shown(test_client, ids, endpoint):
    response = _get(test_client, ids, "member", "showing", endpoint)
    assert response.status_code == 200
    assert "showing" in str(response.json)


@pytest.mark.parametrize("race", ["before", "after"])
@pytest.mark.parametrize("endpoint", ENDPOINTS)
def test_member_cannot_read_content_outside_showing_window(test_client, ids, endpoint, race):
    response = _get(test_client, ids, "member", race, endpoint)
    assert response.status_code == 403
    assert response.json["message"] == NOT_SHOWN
    assert f"{race} checkpoint" not in response.get_data(as_text=True)


@pytest.mark.parametrize("race", list(RACES))
@pytest.mark.parametrize("endpoint", ENDPOINTS)
def test_admin_reads_content_any_time(test_client, ids, endpoint, race):
    response = _get(test_client, ids, "admin", race, endpoint)
    assert response.status_code == 200


@pytest.mark.parametrize("user", ["unpaid", "outsider"])
@pytest.mark.parametrize("endpoint", [e for e in ENDPOINTS if "{team}" not in e])
def test_unregistered_user_cannot_read_content(test_client, ids, endpoint, user):
    response = _get(test_client, ids, user, "showing", endpoint)
    assert response.status_code == 403
    assert response.json["message"] == NOT_REGISTERED


@pytest.mark.parametrize("endpoint", [e for e in ENDPOINTS if "{team}" in e])
def test_unpaid_team_cannot_read_own_status(test_client, ids, endpoint):
    response = _get(test_client, ids, "unpaid", "showing", endpoint)
    assert response.status_code == 403
    assert response.json["message"] == NOT_REGISTERED
