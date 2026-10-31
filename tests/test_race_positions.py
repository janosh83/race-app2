from datetime import datetime, timedelta, timezone

import pytest

from app import db
from app.models import Race, RaceCategory, Registration, Team, TeamPosition, User


def _login(test_client, email):
    response = test_client.post('/auth/login/', json={'email': email, 'password': 'pw'})
    return {'Authorization': f"Bearer {response.json['access_token']}"}


@pytest.fixture(scope='function')
def race_setup(test_app):
    with test_app.app_context():
        now = datetime.utcnow()
        running = Race(
            name='Running race',
            description='Logging window open',
            start_showing_checkpoints_at=now - timedelta(hours=2),
            end_showing_checkpoints_at=now + timedelta(hours=2),
            start_logging_at=now - timedelta(hours=1),
            end_logging_at=now + timedelta(hours=1),
        )
        planning = Race(
            name='Planning race',
            description='Checkpoints shown, logging not started yet',
            start_showing_checkpoints_at=now - timedelta(hours=1),
            end_showing_checkpoints_at=now + timedelta(hours=5),
            start_logging_at=now + timedelta(hours=1),
            end_logging_at=now + timedelta(hours=4),
        )
        db.session.add_all([running, planning])
        db.session.flush()

        category = RaceCategory(name='Category', description='Test category')
        team = Team(name='Runners')
        unpaid_team = Team(name='Unpaid')
        db.session.add_all([category, team, unpaid_team])
        db.session.flush()

        users = {}
        for key, name, member_of in [
            ('anna', 'Anna', team),
            ('bob', 'Bob', team),
            ('carl', 'Carl', unpaid_team),
            ('dana', 'Dana', None),
        ]:
            user = User(name=name, email=f'{key}@test.com')
            user.set_password('pw')
            if member_of is not None:
                user.teams.append(member_of)
            db.session.add(user)
            users[key] = user

        db.session.add_all([
            Registration(race_id=running.id, team_id=team.id, race_category_id=category.id, payment_confirmed=True),
            Registration(race_id=planning.id, team_id=team.id, race_category_id=category.id, payment_confirmed=True),
            Registration(race_id=running.id, team_id=unpaid_team.id, race_category_id=category.id, payment_confirmed=False),
        ])
        db.session.commit()
        return {'running': running.id, 'planning': planning.id, 'team': team.id}


def test_report_position_stores_fix(test_client, test_app, race_setup):
    headers = _login(test_client, 'anna@test.com')
    recorded = datetime.now(timezone.utc) - timedelta(minutes=2)

    response = test_client.post(
        f"/api/race/{race_setup['running']}/positions/",
        json={'latitude': 50.1, 'longitude': 14.2, 'accuracy': 12.5, 'recorded_at': recorded.isoformat()},
        headers=headers,
    )

    assert response.status_code == 201
    assert response.json == {'stored': True}
    with test_app.app_context():
        position = TeamPosition.query.one()
        assert position.team_id == race_setup['team']
        assert (position.latitude, position.longitude, position.accuracy_m) == (50.1, 14.2, 12.5)
        assert position.recorded_at == recorded.replace(tzinfo=None).replace(microsecond=position.recorded_at.microsecond)


def test_report_position_outside_logging_window_is_rejected(test_client, test_app, race_setup):
    headers = _login(test_client, 'anna@test.com')

    response = test_client.post(
        f"/api/race/{race_setup['planning']}/positions/",
        json={'latitude': 50.1, 'longitude': 14.2},
        headers=headers,
    )

    assert response.status_code == 403
    with test_app.app_context():
        assert TeamPosition.query.count() == 0


@pytest.mark.parametrize('email', ['carl@test.com', 'dana@test.com'])
def test_report_position_requires_paid_registration(test_client, race_setup, email):
    headers = _login(test_client, email)

    response = test_client.post(
        f"/api/race/{race_setup['running']}/positions/",
        json={'latitude': 50.1, 'longitude': 14.2},
        headers=headers,
    )

    assert response.status_code == 403


def test_report_position_requires_auth(test_client, race_setup):
    response = test_client.post(f"/api/race/{race_setup['running']}/positions/", json={'latitude': 50, 'longitude': 14})
    assert response.status_code == 401


@pytest.mark.parametrize('payload', [
    {},
    {'latitude': 91, 'longitude': 14},
    {'latitude': 50, 'longitude': 181},
    {'latitude': 50, 'longitude': 14, 'accuracy': -1},
])
def test_report_position_validates_payload(test_client, race_setup, payload):
    headers = _login(test_client, 'anna@test.com')
    response = test_client.post(f"/api/race/{race_setup['running']}/positions/", json=payload, headers=headers)
    assert response.status_code == 400


def test_report_position_throttles_per_user(test_client, test_app, race_setup):
    anna = _login(test_client, 'anna@test.com')
    bob = _login(test_client, 'bob@test.com')
    url = f"/api/race/{race_setup['running']}/positions/"

    assert test_client.post(url, json={'latitude': 50.1, 'longitude': 14.2}, headers=anna).status_code == 201
    second = test_client.post(url, json={'latitude': 50.2, 'longitude': 14.3}, headers=anna)
    assert second.status_code == 200
    assert second.json == {'stored': False, 'reason': 'too_soon'}
    # Another member of the same team is not throttled by Anna's report.
    assert test_client.post(url, json={'latitude': 50.3, 'longitude': 14.4}, headers=bob).status_code == 201

    with test_app.app_context():
        assert TeamPosition.query.count() == 2


def test_report_position_drops_stale_and_clamps_future_fixes(test_client, test_app, race_setup):
    url = f"/api/race/{race_setup['running']}/positions/"
    stale = (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()
    future = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()

    response = test_client.post(url, json={'latitude': 50, 'longitude': 14, 'recorded_at': stale},
                                headers=_login(test_client, 'anna@test.com'))
    assert response.json == {'stored': False, 'reason': 'stale'}

    response = test_client.post(url, json={'latitude': 50, 'longitude': 14, 'recorded_at': future},
                                headers=_login(test_client, 'bob@test.com'))
    assert response.status_code == 201
    with test_app.app_context():
        assert TeamPosition.query.one().recorded_at <= datetime.utcnow()


def test_team_paths_include_member_positions_in_time_order(test_client, test_app, race_setup, admin_auth_headers):
    with test_app.app_context():
        anna = User.query.filter_by(email='anna@test.com').one()
        bob = User.query.filter_by(email='bob@test.com').one()
        base = datetime(2026, 5, 1, 10, 0, 0)
        race_id, team_id = race_setup['running'], race_setup['team']
        db.session.add_all([
            TeamPosition(race_id=race_id, team_id=team_id, user_id=anna.id, latitude=50.3, longitude=14.3, recorded_at=base + timedelta(minutes=20)),
            TeamPosition(race_id=race_id, team_id=team_id, user_id=bob.id, latitude=50.2, longitude=14.2, accuracy_m=8, recorded_at=base + timedelta(minutes=10)),
            TeamPosition(race_id=race_id, team_id=team_id, user_id=anna.id, latitude=50.1, longitude=14.1, recorded_at=base),
            # Positions from another race must not leak in.
            TeamPosition(race_id=race_setup['planning'], team_id=team_id, user_id=anna.id, latitude=1, longitude=1, recorded_at=base),
        ])
        db.session.commit()

    response = test_client.get(f"/api/race/{race_setup['running']}/team-paths/", headers=admin_auth_headers)

    assert response.status_code == 200
    teams = {team['team_name']: team for team in response.json['teams']}
    positions = teams['Runners']['positions']
    assert [(p['latitude'], p['user_name']) for p in positions] == [(50.1, 'Anna'), (50.2, 'Bob'), (50.3, 'Anna')]
    assert positions[1]['accuracy'] == 8
    assert positions[0]['recorded_at'] == '2026-05-01T10:00:00'
    assert teams['Unpaid']['positions'] == []


def test_deleting_user_removes_their_positions(test_client, test_app, race_setup, admin_auth_headers):
    with test_app.app_context():
        dana = User.query.filter_by(email='dana@test.com').one()
        db.session.add(TeamPosition(race_id=race_setup['running'], team_id=race_setup['team'], user_id=dana.id,
                                    latitude=50, longitude=14, recorded_at=datetime.utcnow()))
        db.session.commit()
        dana_id = dana.id

    response = test_client.delete(f'/api/user/{dana_id}/', headers=admin_auth_headers)

    assert response.status_code == 200
    with test_app.app_context():
        assert TeamPosition.query.count() == 0
