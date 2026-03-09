from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app import db
from app.models import Checkpoint, CheckpointLog, Task, TaskLog, User
from app.routes.admin import admin_required

race_visits_bp = Blueprint('race_visits', __name__)


@race_visits_bp.route('/visits/<int:team_id>/', methods=['GET'])
@jwt_required()
def get_visits_by_race_and_team(race_id, team_id):
    """
    Get checkpoint visits for a specific team and race.
    Requires to be an admin or a member of the team.
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
      - in: path
        name: team_id
        schema:
          type: integer
        required: true
        description: ID of the team
    security:
      - BearerAuth: []
    responses:
      200:
        description: A list of checkpoint visits.
        content:
          application/json:
            schema:
              type: array
              items:
                $ref: '#/components/schemas/VisitObject'
      403:
        description: Forbidden, user is not an admin or member of the team.
    """
    user = User.query.filter_by(id=get_jwt_identity()).first_or_404()
    if not user.is_administrator and team_id not in [team.id for team in user.teams]:
        return 403

    visits = (
        db.session.query(
            CheckpointLog.id,
            CheckpointLog.checkpoint_id,
            Checkpoint.title.label('checkpoint_title'),
            Checkpoint.numOfPoints,
            CheckpointLog.team_id,
            CheckpointLog.created_at,
            CheckpointLog.image_distance_km,
            CheckpointLog.image_latitude,
            CheckpointLog.image_longitude,
            CheckpointLog.user_distance_km,
            CheckpointLog.user_latitude,
            CheckpointLog.user_longitude,
        )
        .select_from(CheckpointLog)
        .join(Checkpoint, CheckpointLog.checkpoint_id == Checkpoint.id)
        .filter(CheckpointLog.race_id == race_id)
        .filter(CheckpointLog.team_id == team_id)
        .all()
    )

    return jsonify([
        {
            'id': visit.id,
            'checkpoint_id': visit.checkpoint_id,
            'checkpoint': visit.checkpoint_title,
            'num_of_points': visit.numOfPoints,
            'team_id': visit.team_id,
            'created_at': visit.created_at,
            'image_distance_km': visit.image_distance_km,
            'image_latitude': visit.image_latitude,
            'image_longitude': visit.image_longitude,
            'user_distance_km': visit.user_distance_km,
            'user_latitude': visit.user_latitude,
            'user_longitude': visit.user_longitude,
        }
        for visit in visits
    ])


@race_visits_bp.route('/visits/', methods=['GET'])
@admin_required()
def get_visits_by_race(race_id):
    """
    Get all checkpoint visits for a specific race (admin only).
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
        description: List of checkpoint visits for the race
        content:
          application/json:
            schema:
              type: array
              items:
                type: object
                properties:
                  checkpoint_id:
                    type: integer
                  team_id:
                    type: integer
                  created_at:
                    type: string
                    format: date-time
      403:
        description: Admins only
    """
    visits = CheckpointLog.query.filter_by(race_id=race_id).all()
    return jsonify([
        {
            'checkpoint_id': visit.checkpoint_id,
            'team_id': visit.team_id,
            'created_at': visit.created_at,
            'image_distance_km': visit.image_distance_km,
            'image_latitude': visit.image_latitude,
            'image_longitude': visit.image_longitude,
            'user_distance_km': visit.user_distance_km,
            'user_latitude': visit.user_latitude,
            'user_longitude': visit.user_longitude,
        }
        for visit in visits
    ])


@race_visits_bp.route('/task-completions/<int:team_id>/', methods=['GET'])
@jwt_required()
def get_task_completions_by_race_and_team(race_id, team_id):
    """
    Get task completions for a specific team and race.
    Requires the user to be an admin or a member of the team.
    ---
    tags:
      - Tasks
    parameters:
      - in: path
        name: race_id
        schema:
          type: integer
        required: true
        description: ID of the race
      - in: path
        name: team_id
        schema:
          type: integer
        required: true
        description: ID of the team
    security:
      - BearerAuth: []
    responses:
      200:
        description: A list of task completions for the given team and race.
        content:
          application/json:
            schema:
              type: array
              items:
                type: object
                properties:
                  id:
                    type: integer
                  task_id:
                    type: integer
                  task:
                    type: string
                    description: Task title
                  num_of_points:
                    type: integer
                  team_id:
                    type: integer
                  created_at:
                    type: string
                    format: date-time
      403:
        description: Forbidden, user is not an admin or member of the team.
    """
    user = User.query.filter_by(id=get_jwt_identity()).first_or_404()
    if not user.is_administrator and team_id not in [team.id for team in user.teams]:
        return 403

    completions = (
        db.session.query(
            TaskLog.id,
            TaskLog.task_id,
            Task.title.label('task_title'),
            Task.numOfPoints,
            TaskLog.team_id,
            TaskLog.created_at,
        )
        .select_from(TaskLog)
        .join(Task, TaskLog.task_id == Task.id)
        .filter(TaskLog.race_id == race_id)
        .filter(TaskLog.team_id == team_id)
        .all()
    )

    return jsonify([
        {
            'id': completion.id,
            'task_id': completion.task_id,
            'task': completion.task_title,
            'num_of_points': completion.numOfPoints,
            'team_id': completion.team_id,
            'created_at': completion.created_at,
        }
        for completion in completions
    ])


@race_visits_bp.route('/task-completions/', methods=['GET'])
@admin_required()
def get_task_completions_by_race(race_id):
    """
    Get all task completions for a specific race (admin only).
    ---
    tags:
      - Tasks
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
        description: List of task completions for the race
        content:
          application/json:
            schema:
              type: array
              items:
                type: object
                properties:
                  task_id:
                    type: integer
                  team_id:
                    type: integer
                  created_at:
                    type: string
                    format: date-time
      403:
        description: Admins only
    """
    completions = TaskLog.query.filter_by(race_id=race_id).all()
    return jsonify([
        {
            'task_id': completion.task_id,
            'team_id': completion.team_id,
            'created_at': completion.created_at,
        }
        for completion in completions
    ])
