from datetime import datetime, timedelta

import pytest

from app import db
from app.models import Checkpoint, CheckpointLog, Race, RaceCategory, Registration, Team


@pytest.fixture(scope='function')
def add_test_data(test_app):
    with test_app.app_context():
        now = datetime.utcnow()
        race = Race(
            name='Paths race',
            description='Race for team paths endpoint tests',
            start_showing_checkpoints_at=now - timedelta(hours=1),
            end_showing_checkpoints_at=now + timedelta(hours=2),
            start_logging_at=now - timedelta(minutes=30),
            end_logging_at=now + timedelta(hours=1),
        )
        other_race = Race(
            name='Other race',
            description='Visits here must not leak into the paths race',
            start_showing_checkpoints_at=now - timedelta(hours=1),
            end_showing_checkpoints_at=now + timedelta(hours=2),
            start_logging_at=now - timedelta(minutes=30),
            end_logging_at=now + timedelta(hours=1),
        )
        db.session.add_all([race, other_race])
        db.session.flush()

        category = RaceCategory(name='Category A', description='Test category')
        db.session.add(category)
        db.session.flush()

        team_beta = Team(name='Beta')
        team_alpha = Team(name='Alpha')
        team_idle = Team(name='Idle')
        team_unregistered = Team(name='Not registered')
        db.session.add_all([team_beta, team_alpha, team_idle, team_unregistered])
        db.session.flush()

        db.session.add_all(
            [
                Registration(race_id=race.id, team_id=team_beta.id, race_category_id=category.id),
                Registration(race_id=race.id, team_id=team_alpha.id, race_category_id=category.id, disqualified=True),
                Registration(race_id=race.id, team_id=team_idle.id, race_category_id=category.id),
                Registration(race_id=other_race.id, team_id=team_unregistered.id, race_category_id=category.id),
            ]
        )

        cp_1 = Checkpoint(title='CP 1', latitude=50.0, longitude=14.0, numOfPoints=1, race_id=race.id)
        cp_2 = Checkpoint(title='CP 2', latitude=50.1, longitude=14.1, numOfPoints=2, race_id=race.id)
        cp_3 = Checkpoint(title='CP 3', latitude=50.2, longitude=14.2, numOfPoints=3, race_id=race.id)
        cp_other = Checkpoint(title='Other CP', latitude=40.0, longitude=10.0, numOfPoints=1, race_id=other_race.id)
        db.session.add_all([cp_1, cp_2, cp_3, cp_other])
        db.session.flush()

        base = datetime(2026, 5, 1, 10, 0, 0)
        db.session.add_all(
            [
                # Beta: inserted out of order on purpose; path must follow created_at.
                CheckpointLog(checkpoint_id=cp_1.id, team_id=team_beta.id, race_id=race.id, created_at=base + timedelta(minutes=50)),
                CheckpointLog(checkpoint_id=cp_3.id, team_id=team_beta.id, race_id=race.id, created_at=base + timedelta(minutes=10)),
                CheckpointLog(checkpoint_id=cp_2.id, team_id=team_beta.id, race_id=race.id, created_at=base + timedelta(minutes=30)),
                CheckpointLog(checkpoint_id=cp_2.id, team_id=team_alpha.id, race_id=race.id, created_at=base + timedelta(minutes=5)),
                CheckpointLog(checkpoint_id=cp_other.id, team_id=team_unregistered.id, race_id=other_race.id, created_at=base),
            ]
        )
        db.session.commit()


def test_get_team_paths_returns_ordered_visits(test_client, add_test_data, admin_auth_headers):
    response = test_client.get('/api/race/1/team-paths/', headers=admin_auth_headers)

    assert response.status_code == 200
    data = response.json
    assert data['race_id'] == 1
    assert data['checkpoints'] == [
        {'id': 1, 'title': 'CP 1', 'latitude': 50.0, 'longitude': 14.0, 'numOfPoints': 1},
        {'id': 2, 'title': 'CP 2', 'latitude': 50.1, 'longitude': 14.1, 'numOfPoints': 2},
        {'id': 3, 'title': 'CP 3', 'latitude': 50.2, 'longitude': 14.2, 'numOfPoints': 3},
    ]

    teams = data['teams']
    assert [team['team_name'] for team in teams] == ['Alpha', 'Beta', 'Idle']

    alpha, beta, idle = teams
    assert alpha['disqualified'] is True
    assert [visit['checkpoint_id'] for visit in alpha['visits']] == [2]

    assert beta['disqualified'] is False
    assert [visit['checkpoint_id'] for visit in beta['visits']] == [3, 2, 1]
    assert beta['visits'][0]['created_at'] == '2026-05-01T10:10:00'

    assert idle['visits'] == []


def test_get_team_paths_requires_auth(test_client, add_test_data):
    response = test_client.get('/api/race/1/team-paths/')
    assert response.status_code == 401


def test_get_team_paths_admin_only(test_client, add_test_data, regular_user_auth_headers):
    response = test_client.get('/api/race/1/team-paths/', headers=regular_user_auth_headers)
    assert response.status_code == 403


def test_get_team_paths_invalid_race_404(test_client, add_test_data, admin_auth_headers):
    response = test_client.get('/api/race/999/team-paths/', headers=admin_auth_headers)
    assert response.status_code == 404
