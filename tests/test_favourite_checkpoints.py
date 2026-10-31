from datetime import datetime, timedelta

import pytest

from app import db
from app.models import Checkpoint, FavouriteCheckpoint, Race, RaceCategory, Registration, Team, User


def _login(test_client, email):
    response = test_client.post('/auth/login/', json={'email': email, 'password': 'pw'})
    return {'Authorization': f"Bearer {response.json['access_token']}"}


@pytest.fixture(scope='function')
def race_setup(test_app):
    with test_app.app_context():
        now = datetime.utcnow()
        shown = Race(
            name='Shown race',
            description='Checkpoints shown, logging not started yet',
            start_showing_checkpoints_at=now - timedelta(hours=1),
            end_showing_checkpoints_at=now + timedelta(hours=5),
            start_logging_at=now + timedelta(hours=1),
            end_logging_at=now + timedelta(hours=4),
        )
        hidden = Race(
            name='Hidden race',
            description='Checkpoints not shown yet',
            start_showing_checkpoints_at=now + timedelta(hours=1),
            end_showing_checkpoints_at=now + timedelta(hours=5),
            start_logging_at=now + timedelta(hours=2),
            end_logging_at=now + timedelta(hours=4),
        )
        db.session.add_all([shown, hidden])
        db.session.flush()

        category = RaceCategory(name='Category', description='Test category')
        team_a = Team(name='Team A')
        team_b = Team(name='Team B')
        db.session.add_all([category, team_a, team_b])
        db.session.flush()

        users = {}
        for key, team in [('anna', team_a), ('bob', team_a), ('cecil', team_b), ('dana', None)]:
            user = User(name=key.title(), email=f'{key}@test.com')
            user.set_password('pw')
            if team is not None:
                user.teams.append(team)
            db.session.add(user)
            users[key] = user

        db.session.add_all([
            Registration(race_id=shown.id, team_id=team_a.id, race_category_id=category.id, payment_confirmed=True),
            Registration(race_id=shown.id, team_id=team_b.id, race_category_id=category.id, payment_confirmed=True),
            Registration(race_id=hidden.id, team_id=team_a.id, race_category_id=category.id, payment_confirmed=True),
        ])

        cps = [
            Checkpoint(title='Alpha', latitude=50.0, longitude=14.0, numOfPoints=1, race_id=shown.id),
            Checkpoint(title='Bravo', latitude=50.1, longitude=14.1, numOfPoints=1, race_id=shown.id),
            Checkpoint(title='Charlie', latitude=50.2, longitude=14.2, numOfPoints=1, race_id=shown.id),
            Checkpoint(title='Hidden CP', latitude=40.0, longitude=10.0, numOfPoints=1, race_id=hidden.id),
        ]
        db.session.add_all(cps)
        db.session.commit()
        return {
            'shown': shown.id,
            'hidden': hidden.id,
            'team_a': team_a.id,
            'cp': {cp.title: cp.id for cp in cps},
        }


def _favourite_url(race_id, checkpoint_id):
    return f'/api/race/{race_id}/checkpoints/{checkpoint_id}/favourite/'


def test_mark_and_unmark_favourite_is_idempotent(test_client, test_app, race_setup):
    headers = _login(test_client, 'anna@test.com')
    url = _favourite_url(race_setup['shown'], race_setup['cp']['Alpha'])

    for _ in range(2):
        response = test_client.put(url, headers=headers)
        assert response.status_code == 200
        assert response.json == {'checkpoint_id': race_setup['cp']['Alpha'], 'is_favourite': True}
    with test_app.app_context():
        assert FavouriteCheckpoint.query.count() == 1

    for _ in range(2):
        response = test_client.delete(url, headers=headers)
        assert response.status_code == 200
        assert response.json['is_favourite'] is False
    with test_app.app_context():
        assert FavouriteCheckpoint.query.count() == 0


def test_favourites_are_shared_by_the_team_and_reported_in_checkpoint_lists(test_client, race_setup):
    anna = _login(test_client, 'anna@test.com')
    bob = _login(test_client, 'bob@test.com')
    cecil = _login(test_client, 'cecil@test.com')
    race_id = race_setup['shown']
    test_client.put(_favourite_url(race_id, race_setup['cp']['Bravo']), headers=anna)

    def favourites(response):
        assert response.status_code == 200
        return {cp['title'] for cp in response.json if cp['is_favourite']}

    status_url = f"/api/race/{race_id}/checkpoints/{race_setup['team_a']}/status/"
    assert favourites(test_client.get(status_url, headers=anna)) == {'Bravo'}
    assert favourites(test_client.get(f'/api/race/{race_id}/checkpoints/', headers=anna)) == {'Bravo'}
    # A teammate sees the team's favourites...
    assert favourites(test_client.get(status_url, headers=bob)) == {'Bravo'}
    assert favourites(test_client.get(f'/api/race/{race_id}/checkpoints/', headers=bob)) == {'Bravo'}
    # ...and another team doesn't.
    assert favourites(test_client.get(f'/api/race/{race_id}/checkpoints/', headers=cecil)) == set()

    # Any member can remove a team favourite.
    assert test_client.delete(_favourite_url(race_id, race_setup['cp']['Bravo']), headers=bob).status_code == 200
    assert favourites(test_client.get(status_url, headers=anna)) == set()


def test_admin_without_team_cannot_mark_favourites(test_client, race_setup, admin_auth_headers):
    response = test_client.put(_favourite_url(race_setup['shown'], race_setup['cp']['Alpha']), headers=admin_auth_headers)
    assert response.status_code == 403

    response = test_client.get(f"/api/race/{race_setup['shown']}/checkpoints/", headers=admin_auth_headers)
    assert response.status_code == 200
    assert not any(cp['is_favourite'] for cp in response.json)


def test_favourite_requires_checkpoints_to_be_shown(test_client, race_setup):
    response = test_client.put(
        _favourite_url(race_setup['hidden'], race_setup['cp']['Hidden CP']),
        headers=_login(test_client, 'anna@test.com'),
    )
    assert response.status_code == 403


def test_favourite_requires_registration(test_client, race_setup):
    response = test_client.put(
        _favourite_url(race_setup['shown'], race_setup['cp']['Alpha']),
        headers=_login(test_client, 'dana@test.com'),
    )
    assert response.status_code == 403


def test_favourite_checkpoint_must_belong_to_race(test_client, race_setup):
    response = test_client.put(
        _favourite_url(race_setup['shown'], race_setup['cp']['Hidden CP']),
        headers=_login(test_client, 'anna@test.com'),
    )
    assert response.status_code == 404


def test_favourite_requires_auth(test_client, race_setup):
    response = test_client.put(_favourite_url(race_setup['shown'], race_setup['cp']['Alpha']))
    assert response.status_code == 401


def test_statistics_rank_most_favourite_checkpoints(test_client, race_setup, admin_auth_headers):
    race_id = race_setup['shown']
    # Anna and Bob share Team A, so Bob's Bravo is the same team favourite.
    marks = {'anna': ['Alpha', 'Bravo'], 'bob': ['Bravo'], 'cecil': ['Bravo', 'Charlie']}
    for user, titles in marks.items():
        headers = _login(test_client, f'{user}@test.com')
        for title in titles:
            assert test_client.put(_favourite_url(race_id, race_setup['cp'][title]), headers=headers).status_code == 200

    response = test_client.get(f'/api/race/{race_id}/statistics/', headers=admin_auth_headers)

    assert response.status_code == 200
    data = response.json
    assert data['favourites_count'] == 4
    assert data['teams_with_favourites_count'] == 2
    assert [(item['title'], item['favourites_count']) for item in data['top_favourite_checkpoints']] == [
        ('Bravo', 2),
        ('Alpha', 1),
        ('Charlie', 1),
    ]


def test_deleting_checkpoint_or_team_removes_favourites(test_client, test_app, race_setup, admin_auth_headers):
    race_id = race_setup['shown']
    test_client.put(_favourite_url(race_id, race_setup['cp']['Alpha']), headers=_login(test_client, 'anna@test.com'))
    test_client.put(_favourite_url(race_id, race_setup['cp']['Bravo']), headers=_login(test_client, 'cecil@test.com'))

    assert test_client.delete(f"/api/checkpoint/{race_setup['cp']['Alpha']}/", headers=admin_auth_headers).status_code == 200
    with test_app.app_context():
        assert FavouriteCheckpoint.query.count() == 1
        db.session.delete(Team.query.filter_by(name='Team B').one())
        db.session.commit()
        assert FavouriteCheckpoint.query.count() == 0
