from datetime import datetime, timedelta

import pytest

from app import db
from app.models import Checkpoint, CheckpointLog, Race, RaceCategory, Registration, Task, TaskLog, Team


@pytest.fixture(scope='function')
def add_test_data(test_app):
    with test_app.app_context():
        now = datetime.utcnow()
        race = Race(
            name='Statistics race',
            description='Race for statistics endpoint tests',
            start_showing_checkpoints_at=now - timedelta(hours=1),
            end_showing_checkpoints_at=now + timedelta(hours=2),
            start_logging_at=now - timedelta(minutes=30),
            end_logging_at=now + timedelta(hours=1),
        )
        db.session.add(race)
        db.session.flush()

        category = RaceCategory(name='Category A', description='Test category')
        db.session.add(category)
        db.session.flush()

        team_1 = Team(name='Team One')
        team_2 = Team(name='Team Two')
        team_3 = Team(name='Team Three')
        db.session.add_all([team_1, team_2, team_3])
        db.session.flush()

        db.session.add_all(
            [
                Registration(race_id=race.id, team_id=team_1.id, race_category_id=category.id),
                Registration(race_id=race.id, team_id=team_2.id, race_category_id=category.id),
                Registration(race_id=race.id, team_id=team_3.id, race_category_id=category.id),
            ]
        )

        checkpoint_1 = Checkpoint(title='CP 1', description='A', latitude=50.0, longitude=14.0, numOfPoints=1, race_id=race.id)
        checkpoint_2 = Checkpoint(title='CP 2', description='B', latitude=50.1, longitude=14.1, numOfPoints=2, race_id=race.id)
        checkpoint_3 = Checkpoint(title='CP 3', description='C', latitude=50.2, longitude=14.2, numOfPoints=3, race_id=race.id)
        checkpoint_4 = Checkpoint(title='CP 4', description='D', latitude=50.3, longitude=14.3, numOfPoints=4, race_id=race.id)
        db.session.add_all([checkpoint_1, checkpoint_2, checkpoint_3, checkpoint_4])

        task_1 = Task(title='Task 1', description='A', numOfPoints=5, race_id=race.id)
        task_2 = Task(title='Task 2', description='B', numOfPoints=10, race_id=race.id)
        task_3 = Task(title='Task 3', description='C', numOfPoints=7, race_id=race.id)
        task_4 = Task(title='Task 4', description='D', numOfPoints=4, race_id=race.id)
        db.session.add_all([task_1, task_2, task_3, task_4])

        db.session.flush()

        db.session.add_all(
            [
                CheckpointLog(checkpoint_id=checkpoint_1.id, team_id=team_1.id, race_id=race.id),
                CheckpointLog(checkpoint_id=checkpoint_1.id, team_id=team_2.id, race_id=race.id),
                CheckpointLog(checkpoint_id=checkpoint_1.id, team_id=team_3.id, race_id=race.id),
                CheckpointLog(checkpoint_id=checkpoint_2.id, team_id=team_1.id, race_id=race.id),
                CheckpointLog(checkpoint_id=checkpoint_2.id, team_id=team_2.id, race_id=race.id),
                CheckpointLog(checkpoint_id=checkpoint_3.id, team_id=team_2.id, race_id=race.id),
            ]
        )

        db.session.add_all(
            [
                TaskLog(task_id=task_1.id, team_id=team_1.id, race_id=race.id),
                TaskLog(task_id=task_1.id, team_id=team_3.id, race_id=race.id),
                TaskLog(task_id=task_2.id, team_id=team_2.id, race_id=race.id),
                TaskLog(task_id=task_3.id, team_id=team_1.id, race_id=race.id),
            ]
        )

        db.session.commit()


def test_get_race_statistics_returns_counts(test_client, add_test_data, admin_auth_headers):
    response = test_client.get('/api/race/1/statistics/', headers=admin_auth_headers)

    assert response.status_code == 200
    assert response.json['race_id'] == 1
    assert response.json['registered_teams_count'] == 3
    assert response.json['checkpoints_count'] == 4
    assert response.json['tasks_count'] == 4
    assert response.json['visits_count'] == 6
    assert response.json['task_completions_count'] == 4
    assert response.json['checkpoints_with_visits_count'] == 3
    assert response.json['tasks_with_completions_count'] == 3

    assert response.json['top_visited_checkpoints'] == [
        {'checkpoint_id': 1, 'title': 'CP 1', 'visits_count': 3},
        {'checkpoint_id': 2, 'title': 'CP 2', 'visits_count': 2},
        {'checkpoint_id': 3, 'title': 'CP 3', 'visits_count': 1},
    ]
    assert response.json['top_completed_tasks'] == [
        {'task_id': 1, 'title': 'Task 1', 'completions_count': 2},
        {'task_id': 2, 'title': 'Task 2', 'completions_count': 1},
        {'task_id': 3, 'title': 'Task 3', 'completions_count': 1},
    ]
    assert response.json['least_visited_checkpoints'] == [
        {'checkpoint_id': 3, 'title': 'CP 3', 'visits_count': 1},
        {'checkpoint_id': 2, 'title': 'CP 2', 'visits_count': 2},
        {'checkpoint_id': 1, 'title': 'CP 1', 'visits_count': 3},
    ]
    assert response.json['least_completed_tasks'] == [
        {'task_id': 2, 'title': 'Task 2', 'completions_count': 1},
        {'task_id': 3, 'title': 'Task 3', 'completions_count': 1},
        {'task_id': 1, 'title': 'Task 1', 'completions_count': 2},
    ]


def test_get_race_statistics_requires_auth(test_client, add_test_data):
    response = test_client.get('/api/race/1/statistics/')
    assert response.status_code == 401


def test_get_race_statistics_admin_only(test_client, add_test_data, regular_user_auth_headers):
    response = test_client.get('/api/race/1/statistics/', headers=regular_user_auth_headers)
    assert response.status_code == 403


def test_get_race_statistics_invalid_race_404(test_client, add_test_data, admin_auth_headers):
    response = test_client.get('/api/race/999/statistics/', headers=admin_auth_headers)
    assert response.status_code == 404
