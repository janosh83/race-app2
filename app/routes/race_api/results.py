from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required

from app import db
from app.models import Checkpoint, CheckpointLog, Race, RaceCategory, Registration, Task, TaskLog, Team

race_results_bp = Blueprint('race_results', __name__)


@race_results_bp.route('/results/', methods=['GET'])
@jwt_required()
def get_race_results(race_id):
    """
  Get race results for teams with confirmed payments in a race.
    Returns per-team totals for checkpoints and tasks, and overall total.
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
        description: Race results grouped by team (payment-confirmed registrations only)
        content:
          application/json:
            schema:
              type: array
              items:
                type: object
                properties:
                  team_id:
                    type: integer
                  team:
                    type: string
                    description: Team name
                  category:
                    type: string
                    description: Race category name
                  points_for_checkpoints:
                    type: integer
                  points_for_tasks:
                    type: integer
                  total_points:
                    type: integer
      404:
        description: Race not found
    """
    Race.query.filter_by(id=race_id).first_or_404()

    # table of teams with confirmed registration payment, ordered by team_id
    registrations = (
        db.session.query(
            Registration.team_id,
            Registration.disqualified,
            Team.name.label('team_name'),
            RaceCategory.name.label('race_category_name'),
        )
        .select_from(Registration)
        .join(Team, Registration.team_id == Team.id)
        .join(RaceCategory, Registration.race_category_id == RaceCategory.id)
      .filter(
        Registration.race_id == race_id,
        Registration.payment_confirmed.is_(True),
      )
        .order_by(Registration.team_id)
        .all()
    )

    # points for checkpoints for each team which has logged at least one checkpoint, ordered by team_id
    checkpoints_points = (
        db.session.query(CheckpointLog.team_id, db.func.sum(Checkpoint.numOfPoints).label('total_points'))
        .select_from(CheckpointLog)
        .join(Checkpoint, CheckpointLog.checkpoint_id == Checkpoint.id)
        .filter(CheckpointLog.race_id == race_id)
        .group_by(CheckpointLog.team_id)
        .order_by(CheckpointLog.team_id)
        .all()
    )

    # points for tasks for each team which has logged at least one task, ordered by team_id
    tasks_points = (
        db.session.query(TaskLog.team_id, db.func.sum(Task.numOfPoints).label('total_points'))
        .select_from(TaskLog)
        .join(Task, TaskLog.task_id == Task.id)
        .filter(TaskLog.race_id == race_id)
        .group_by(TaskLog.team_id)
        .order_by(TaskLog.team_id)
        .all()
    )

    result = []
    checkpoint_idx = 0
    task_idx = 0
    for reg in registrations:
        points_for_checkpoints = 0
        points_for_tasks = 0

        if checkpoint_idx < len(checkpoints_points) and reg.team_id == checkpoints_points[checkpoint_idx].team_id:
            # fill points for checkpoints if this team has any, otherwise leave 0
            points_for_checkpoints = checkpoints_points[checkpoint_idx].total_points
            checkpoint_idx += 1

        if task_idx < len(tasks_points) and reg.team_id == tasks_points[task_idx].team_id:
            # fill points for tasks if this team has any, otherwise leave 0
            points_for_tasks = tasks_points[task_idx].total_points
            task_idx += 1

        result.append(
            {
                'team_id': reg.team_id,
                'team': reg.team_name,
                'category': reg.race_category_name,
                'disqualified': bool(reg.disqualified),
                'points_for_checkpoints': points_for_checkpoints,
                'points_for_tasks': points_for_tasks,
                'total_points': points_for_checkpoints + points_for_tasks,
            }
        )

    return jsonify(result), 200
