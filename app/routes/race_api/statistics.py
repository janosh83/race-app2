from flask import Blueprint, jsonify

from app import db
from app.models import Checkpoint, CheckpointLog, Race, Registration, Task, TaskLog
from app.routes.admin import admin_required

race_statistics_bp = Blueprint('race_statistics', __name__)


@race_statistics_bp.route('/statistics/', methods=['GET'])
@admin_required()
def get_race_statistics(race_id):
    """
    Get high-level race statistics (admin only).
    ---
    tags:
      - Races
    parameters:
      - in: path
        name: race_id
        schema:
          type: integer
        required: true
        description: ID of the race
    security:
      - BearerAuth: []
    responses:
      200:
        description: Race statistics
        content:
          application/json:
            schema:
              type: object
              properties:
                race_id:
                  type: integer
                registered_teams_count:
                  type: integer
                checkpoints_count:
                  type: integer
                tasks_count:
                  type: integer
                visits_count:
                  type: integer
                task_completions_count:
                  type: integer
                checkpoints_with_visits_count:
                  type: integer
                tasks_with_completions_count:
                  type: integer
                top_visited_checkpoints:
                  type: array
                  items:
                    type: object
                    properties:
                      checkpoint_id:
                        type: integer
                      title:
                        type: string
                      visits_count:
                        type: integer
                top_completed_tasks:
                  type: array
                  items:
                    type: object
                    properties:
                      task_id:
                        type: integer
                      title:
                        type: string
                      completions_count:
                        type: integer
                least_visited_checkpoints:
                  type: array
                  items:
                    type: object
                    properties:
                      checkpoint_id:
                        type: integer
                      title:
                        type: string
                      visits_count:
                        type: integer
                least_completed_tasks:
                  type: array
                  items:
                    type: object
                    properties:
                      task_id:
                        type: integer
                      title:
                        type: string
                      completions_count:
                        type: integer
      404:
        description: Race not found
      403:
        description: Admins only
    """
    Race.query.filter_by(id=race_id).first_or_404()

    registered_teams_count = db.session.query(db.func.count(Registration.id)).filter(
        Registration.race_id == race_id,
    ).scalar() or 0

    checkpoints_count = db.session.query(db.func.count(Checkpoint.id)).filter(
        Checkpoint.race_id == race_id,
    ).scalar() or 0

    tasks_count = db.session.query(db.func.count(Task.id)).filter(
        Task.race_id == race_id,
    ).scalar() or 0

    visits_count = db.session.query(db.func.count(CheckpointLog.id)).filter(
      CheckpointLog.race_id == race_id,
    ).scalar() or 0

    checkpoints_with_visits_count = db.session.query(
      db.func.count(db.distinct(CheckpointLog.checkpoint_id))
    ).filter(
      CheckpointLog.race_id == race_id,
    ).scalar() or 0

    task_completions_count = db.session.query(db.func.count(TaskLog.id)).filter(
      TaskLog.race_id == race_id,
    ).scalar() or 0

    tasks_with_completions_count = db.session.query(
      db.func.count(db.distinct(TaskLog.task_id))
    ).filter(
      TaskLog.race_id == race_id,
    ).scalar() or 0

    top_visited_checkpoints_query = (
      db.session.query(
        CheckpointLog.checkpoint_id,
        Checkpoint.title,
        db.func.count(CheckpointLog.id).label('visits_count'),
      )
      .join(Checkpoint, Checkpoint.id == CheckpointLog.checkpoint_id)
      .filter(CheckpointLog.race_id == race_id)
      .group_by(CheckpointLog.checkpoint_id, Checkpoint.title)
      .order_by(db.func.count(CheckpointLog.id).desc(), Checkpoint.title.asc())
      .limit(3)
      .all()
    )

    top_completed_tasks_query = (
      db.session.query(
        TaskLog.task_id,
        Task.title,
        db.func.count(TaskLog.id).label('completions_count'),
      )
      .join(Task, Task.id == TaskLog.task_id)
      .filter(TaskLog.race_id == race_id)
      .group_by(TaskLog.task_id, Task.title)
      .order_by(db.func.count(TaskLog.id).desc(), Task.title.asc())
      .limit(3)
      .all()
    )

    least_visited_checkpoints_query = (
      db.session.query(
        CheckpointLog.checkpoint_id,
        Checkpoint.title,
        db.func.count(CheckpointLog.id).label('visits_count'),
      )
      .join(Checkpoint, Checkpoint.id == CheckpointLog.checkpoint_id)
      .filter(CheckpointLog.race_id == race_id)
      .group_by(CheckpointLog.checkpoint_id, Checkpoint.title)
      .order_by(db.func.count(CheckpointLog.id).asc(), Checkpoint.title.asc())
      .limit(3)
      .all()
    )

    least_completed_tasks_query = (
      db.session.query(
        TaskLog.task_id,
        Task.title,
        db.func.count(TaskLog.id).label('completions_count'),
      )
      .join(Task, Task.id == TaskLog.task_id)
      .filter(TaskLog.race_id == race_id)
      .group_by(TaskLog.task_id, Task.title)
      .order_by(db.func.count(TaskLog.id).asc(), Task.title.asc())
      .limit(3)
      .all()
    )

    return jsonify(
        {
            'race_id': race_id,
            'registered_teams_count': int(registered_teams_count),
            'checkpoints_count': int(checkpoints_count),
            'tasks_count': int(tasks_count),
            'visits_count': int(visits_count),
            'task_completions_count': int(task_completions_count),
            'checkpoints_with_visits_count': int(checkpoints_with_visits_count),
            'tasks_with_completions_count': int(tasks_with_completions_count),
        'top_visited_checkpoints': [
          {
            'checkpoint_id': int(item.checkpoint_id),
            'title': item.title,
            'visits_count': int(item.visits_count),
          }
          for item in top_visited_checkpoints_query
        ],
        'top_completed_tasks': [
          {
            'task_id': int(item.task_id),
            'title': item.title,
            'completions_count': int(item.completions_count),
          }
          for item in top_completed_tasks_query
        ],
        'least_visited_checkpoints': [
          {
            'checkpoint_id': int(item.checkpoint_id),
            'title': item.title,
            'visits_count': int(item.visits_count),
          }
          for item in least_visited_checkpoints_query
        ],
        'least_completed_tasks': [
          {
            'task_id': int(item.task_id),
            'title': item.title,
            'completions_count': int(item.completions_count),
          }
          for item in least_completed_tasks_query
        ],
        }
    )
