"""Race times are stored as naive UTC, so every "now" they're compared with
must be UTC too, whatever the server's local time zone.

The admin form sends times as UTC ISO strings (`toISOString()`) and the API
returns them as RFC 822 "GMT" strings, which the browser reads as UTC. These
tests run the server in a non-UTC zone (Europe/Prague where the platform lets
us switch; otherwise whatever the machine uses) so that comparing against
local time would fail.
"""
import os
import time
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime

import pytest

from app import create_app, db
from app.models import Checkpoint, RaceCategory, Registration, Team, User

PASSWORD = "password"


@pytest.fixture(autouse=True)
def non_utc_server_time():
    if not hasattr(time, "tzset"):  # Windows: keep the machine's zone
        yield
        return
    previous = os.environ.get("TZ")
    os.environ["TZ"] = "Europe/Prague"
    time.tzset()
    yield
    if previous is None:
        del os.environ["TZ"]
    else:
        os.environ["TZ"] = previous
    time.tzset()


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
def users(test_app):
    admin = User(name="admin", email="admin@example.com", is_administrator=True)
    member = User(name="member", email="member@example.com")
    for user in (admin, member):
        user.set_password(PASSWORD)
    team = Team(name="Team", members=[member])
    category = RaceCategory(name="Open")
    db.session.add_all([admin, team, category])
    db.session.commit()
    return {"team_id": team.id, "category_id": category.id}


def _headers(test_client, email):
    login = test_client.post("/auth/login/", json={"email": email, "password": PASSWORD})
    return {"Authorization": f"Bearer {login.json['access_token']}"}


def _utc_iso(minutes_from_now):
    """What the admin form sends: new Date(local).toISOString()."""
    moment = datetime.now(timezone.utc) + timedelta(minutes=minutes_from_now)
    return moment.isoformat(timespec="seconds").replace("+00:00", "Z")


def _create_race(test_client, users, show, log):
    """Create a race through the admin API, register the team and add a
    checkpoint. `show` and `log` are (start, end) in minutes from now."""
    times = {
        "start_showing_checkpoints_at": _utc_iso(show[0]),
        "end_showing_checkpoints_at": _utc_iso(show[1]),
        "start_logging_at": _utc_iso(log[0]),
        "end_logging_at": _utc_iso(log[1]),
    }
    response = test_client.post(
        "/api/race/",
        json={"name": "Race", "description": "d", **times},
        headers=_headers(test_client, "admin@example.com"),
    )
    assert response.status_code == 201
    race_id = response.json["id"]
    checkpoint = Checkpoint(title="CP", latitude=50.0, longitude=14.0, numOfPoints=1, race_id=race_id)
    db.session.add_all([
        checkpoint,
        Registration(race_id=race_id, team_id=users["team_id"], race_category_id=users["category_id"],
                     payment_confirmed=True),
    ])
    db.session.commit()
    return race_id, checkpoint.id, times


def _log_visit(test_client, users, race_id, checkpoint_id):
    return test_client.post(
        f"/api/race/{race_id}/checkpoints/log/",
        json={"checkpoint_id": checkpoint_id, "team_id": users["team_id"]},
        headers=_headers(test_client, "member@example.com"),
    )


def test_times_round_trip_as_utc(test_client, users):
    race_id, _, sent = _create_race(test_client, users, show=(-10, 10), log=(-10, 10))

    race = test_client.get(f"/api/race/{race_id}/", headers=_headers(test_client, "admin@example.com")).json
    for field, value in sent.items():
        returned = parsedate_to_datetime(race[field])  # e.g. "Wed, 28 Oct 2026 17:05:00 GMT"
        assert returned == datetime.fromisoformat(value.replace("Z", "+00:00")), field


def test_member_can_log_inside_utc_window(test_client, users):
    race_id, checkpoint_id, _ = _create_race(test_client, users, show=(-10, 10), log=(-10, 10))

    assert _log_visit(test_client, users, race_id, checkpoint_id).status_code == 201
    status = test_client.get(
        f"/api/race/{race_id}/checkpoints/{users['team_id']}/status/",
        headers=_headers(test_client, "member@example.com"),
    )
    assert status.status_code == 200


def test_member_cannot_log_before_utc_window(test_client, users):
    # Opens in 10 minutes; a server comparing with UTC+1 local time would
    # already think it's open.
    race_id, checkpoint_id, _ = _create_race(test_client, users, show=(10, 120), log=(10, 120))

    assert _log_visit(test_client, users, race_id, checkpoint_id).status_code == 403
