from unittest import result
from flask import Blueprint, jsonify, request

from app import db
from app.models import Race, CheckpointLog, TaskLog, User, RaceCategory, Registration, Team, Checkpoint, Task, Image
from app.routes.race_api.checkpoints import checkpoints_bp
from app.routes.race_api.tasks import tasks_bp
from app.routes.admin import admin_required
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.utils import parse_datetime

race_bp = Blueprint("race", __name__)
race_bp.register_blueprint(checkpoints_bp, url_prefix='/<int:race_id>/checkpoints')
race_bp.register_blueprint(tasks_bp, url_prefix='/<int:race_id>/tasks')

# get all races
# tested by test_races.py -> test_get_all_races
@race_bp.route("/", methods=["GET"])
def get_races():
    """
    Get all races.
    ---
    tags:
      - Races
    responses:
      200:
        description: A list of all races
        content:
          application/json:
            schema:
              type: array
              items:
                $ref: '#/components/schemas/RaceObject'
    """
    races = Race.query.all()
    return jsonify([{"id": race.id, "name": race.name, "description": race.description, "start_showing_checkpoints_at": race.start_showing_checkpoints_at,
                    "end_showing_checkpoints_at": race.end_showing_checkpoints_at, "start_logging_at": race.start_logging_at,
                    "end_logging_at": race.end_logging_at} for race in races])

# get single race
# tested by test_races.py -> test_get_single_race
@race_bp.route("/<int:race_id>/", methods=["GET"])
def get_race(race_id):
    """
    Get a single race.
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
    responses:
      200:
        description: Details of a specific race.
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/RaceObject'
      404:
        description: Race not found
    """
    race = Race.query.filter_by(id=race_id).first_or_404()
    return jsonify({"id": race.id, "name": race.name, "description": race.description, "start_showing_checkpoints_at": race.start_showing_checkpoints_at,
                    "end_showing_checkpoints_at": race.end_showing_checkpoints_at, "start_logging_at": race.start_logging_at,
                    "end_logging_at": race.end_logging_at}), 200

# add race
# tested by test_races.py -> test_create_race
@race_bp.route('/', methods=['POST'])
@admin_required()
def create_race():
    """
    Create race, requires admin privileges.
    ---
    tags:
      - Races
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              name:
                type: string
                description: The name of the race
                example: "City Adventure"
              description:
                type: string
                description: A description of the race
                example: "A fun city-wide race."
    security:
      - BearerAuth: []
    responses:
      201:
        description: Created race
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/RaceObject'
    """
    data = request.json
    start_showing_checkpoints_at = parse_datetime(data['start_showing_checkpoints_at'])
    end_showing_checkpoints_at = parse_datetime(data['end_showing_checkpoints_at'])
    start_logging_at = parse_datetime(data['start_logging_at'])
    end_logging_at = parse_datetime(data['end_logging_at'])
    new_race = Race(name=data['name'],
                    description=data['description'], 
                    start_showing_checkpoints_at=start_showing_checkpoints_at,
                    end_showing_checkpoints_at=end_showing_checkpoints_at, 
                    start_logging_at=start_logging_at,
                    end_logging_at=end_logging_at)
    db.session.add(new_race)
    db.session.commit()
    return jsonify({"id": new_race.id, "name": new_race.name, "description": new_race.description}), 201

# tested by test_races.py -> test_update_race
@race_bp.route('/<int:race_id>/', methods=['PUT'])
@admin_required()
def update_race(race_id):
    """
    Update a race (admin only).
    Accepts partial payload; only provided fields are updated.
    Fields accepted (examples):
      - name: string
      - description: string
      - start_showing_checkpoints_at: ISO datetime string
      - end_showing_checkpoints_at: ISO datetime string
      - start_logging_at: ISO datetime string
      - end_logging_at: ISO datetime string
    """
    data = request.json or {}
    race = Race.query.filter_by(id=race_id).first_or_404()

    # simple scalar fields
    if 'name' in data:
        race.name = data.get('name')
    if 'description' in data:
        race.description = data.get('description')

    # datetime fields (accept several possible keys but prefer explicit *_at keys)
    if 'start_showing_checkpoints_at' in data:
        race.start_showing_checkpoints_at = parse_datetime(data.get('start_showing_checkpoints_at'))
    elif 'start_showing_checkpoints' in data:
        race.start_showing_checkpoints_at = parse_datetime(data.get('start_showing_checkpoints'))

    if 'end_showing_checkpoints_at' in data:
        race.end_showing_checkpoints_at = parse_datetime(data.get('end_showing_checkpoints_at'))
    elif 'end_showing_checkpoints' in data:
        race.end_showing_checkpoints_at = parse_datetime(data.get('end_showing_checkpoints'))

    if 'start_logging_at' in data:
        race.start_logging_at = parse_datetime(data.get('start_logging_at'))
    elif 'start_logging' in data:
        race.start_logging_at = parse_datetime(data.get('start_logging'))

    if 'end_logging_at' in data:
        race.end_logging_at = parse_datetime(data.get('end_logging_at'))
    elif 'end_logging' in data:
        race.end_logging_at = parse_datetime(data.get('end_logging'))

    db.session.add(race)
    db.session.commit()

    return jsonify({
        "id": race.id,
        "name": race.name,
        "description": race.description,
        "start_showing_checkpoints_at": race.start_showing_checkpoints_at,
        "end_showing_checkpoints_at": race.end_showing_checkpoints_at,
        "start_logging_at": race.start_logging_at,
        "end_logging_at": race.end_logging_at
    }), 200

# delete race
# tested by test_races.py -> test_create_race
@race_bp.route('/<int:race_id>/', methods=['DELETE'])
@admin_required()
def delete_race(race_id):
    """
    Delete a race by its ID.  
    Only possible if the race has no checkpoints, teams, or visits associated.
    ---
    tags:
      - Races
    parameters:
      - in: path
        name: race_id
        schema:
          type: integer
        required: true
        description: ID of the race to delete
    security:
      - BearerAuth: []
    responses:
      200:
        description: Race deleted successfully
        content:
          application/json:
            schema:
              type: object
              properties:
                message:
                  type: string
                  example: Race deleted successfully
      400:
        description: Cannot delete the race due to existing checkpoints, teams, or visits
        content:
          application/json:
            schema:
              type: object
              properties:
                message:
                  type: string
                  example: Cannot delete the race, it has checkpoints associated with it.
      404:
        description: Race not found
        content:
          application/json:
            schema:
              type: object
              properties:
                message:
                  type: string
                  example: Race not found
    """
    race = Race.query.filter_by(id=race_id).first_or_404()
    if race:
        if race.checkpoints:
            return jsonify({"message": "Cannot delete the race, it has checkpoints associated with it."}), 400
        if race.registrations:
            return jsonify({"message": "Cannot delete the race, it has registrations associated with it."}), 400
        if race.tasks:
            return jsonify({"message": "Cannot delete the race, it has tasks associated with it."}), 400

        checkpoint_logs = CheckpointLog.query.filter_by(race_id=race_id).all()
        if checkpoint_logs:
            return jsonify({"message": "Cannot delete the race, it has visits associated with it."}), 400
        
        task_logs = TaskLog.query.filter_by(race_id=race_id).all()
        if task_logs:
            return jsonify({"message": "Cannot delete the race, it has task completions associated with it."}), 400

        db.session.delete(race)
        db.session.commit()
        return jsonify({"message": "Race deleted successfully"}), 200

#
# Race Categories
#

# tested by tests\test_categories.py -> test_with_race
@race_bp.route("/<int:race_id>/categories/", methods=["POST"])
@admin_required()
def add_race_category(race_id):
    """
    Add a race category to a specific race
    """
    race = Race.query.filter_by(id=race_id).first_or_404()
    if not race:
        return jsonify({"message": "Race not found"}), 404
    
    race_category_id = request.json.get("race_category_id")
    if not race_category_id:
        return jsonify({"message": "Missing race_category_id"}), 400
    
    race_category = RaceCategory.query.filter_by(id=race_category_id).first_or_404()
    if not race_category:
        return jsonify({"message": "Race category not found"}), 404
    
    race.categories.append(race_category)
    db.session.add(race)
    db.session.commit()

    return jsonify({"race_id": race.id, "race_category_id": race_category.id}), 201

# tested by test_race_categories.py -> test_with_race
@race_bp.route("/<int:race_id>/categories/", methods=["GET"])
@admin_required()
def get_race_categories(race_id):
    """
    Get all race categories for a specific race
    """
    race = Race.query.filter_by(id=race_id).first_or_404()
    return jsonify([{"id": category.id, "name": category.name, "description": category.description} for category in race.categories])


  # remove (unassign) a race category from a specific race
  # expects JSON body: { "race_category_id": <id> }
  
# tested by test_race_categories.py -> test_with_race
@race_bp.route("/<int:race_id>/categories/", methods=["DELETE"])
@admin_required()
def remove_race_category(race_id):
  """
  Remove (unassign) a race category from a specific race.
  """
  race = Race.query.filter_by(id=race_id).first_or_404()
  data = request.get_json() or {}
  race_category_id = data.get('race_category_id')
  if not race_category_id:
    return jsonify({"message": "Missing race_category_id"}), 400

  race_category = RaceCategory.query.filter_by(id=race_category_id).first_or_404()

  # if the category is not assigned, return 404
  if race_category not in race.categories:
    return jsonify({"message": "Category not assigned to this race"}), 404

  race.categories.remove(race_category)
  db.session.add(race)
  db.session.commit()

  return jsonify({"race_id": race.id, "race_category_id": race_category.id}), 200

#
# Visits and Task completions
#

# get all checkpoint visits for selected team and race
# tested by test_visits.py -> test_get_visits
@race_bp.route("/<int:race_id>/visits/<int:team_id>/", methods=["GET"])
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

    # check if user is admin or member of the team
    user = User.query.filter_by(id=get_jwt_identity()).first_or_404()
    if not user.is_administrator and team_id not in [team.id for team in user.teams]:
        return 403
    
    visits = (db.session.query(CheckpointLog.id, CheckpointLog.checkpoint_id, Checkpoint.title.label("checkpoint_title"), CheckpointLog.team_id, CheckpointLog.created_at)
                .select_from(CheckpointLog)
                .join(Checkpoint, CheckpointLog.checkpoint_id == Checkpoint.id)
                .filter(CheckpointLog.race_id==race_id)
                .filter(CheckpointLog.team_id==team_id)
                .all())

    return jsonify([{"id": visit.id, "checkpoint_id": visit.checkpoint_id, "checkpoint": visit.checkpoint_title, "team_id": visit.team_id, "created_at": visit.created_at} for visit in visits])

# get all checkpoint visits for selected race
# tested by test_visits.py -> test_get_visits
@race_bp.route("/<int:race_id>/visits/", methods=["GET"])
@admin_required()
def get_visits_by_race(race_id):
    """
    Get all checkpoint visits for a specific race.
    Requires admin privileges.
    """
    visits = CheckpointLog.query.filter_by(race_id=race_id).all()
    return jsonify([{"checkpoint_id": visit.checkpoint_id, "team_id": visit.team_id, "created_at": visit.created_at} for visit in visits])

# get all task completions for selected team and race
@race_bp.route("/<int:race_id>/task-completions/<int:team_id>/", methods=["GET"])
@jwt_required()
def get_task_completions_by_race_and_team(race_id, team_id):
    """
    Get task completions for a specific team and race.
    Requires to be an admin or a member of the team.
    """
    user = User.query.filter_by(id=get_jwt_identity()).first_or_404()
    if not user.is_administrator and team_id not in [team.id for team in user.teams]:
        return 403

    completions = (
        db.session.query(
            TaskLog.id,
            TaskLog.task_id,
            Task.title.label("task_title"),
            TaskLog.team_id,
            TaskLog.created_at
        )
        .select_from(TaskLog)
        .join(Task, TaskLog.task_id == Task.id)
        .filter(TaskLog.race_id == race_id)
        .filter(TaskLog.team_id == team_id)
        .all()
    )

    return jsonify([
        {
            "id": completion.id,
            "task_id": completion.task_id,
            "task": completion.task_title,
            "team_id": completion.team_id,
            "created_at": completion.created_at,
        }
        for completion in completions
    ])

# get all task completions for selected race
@race_bp.route("/<int:race_id>/task-completions/", methods=["GET"])
@admin_required()
def get_task_completions_by_race(race_id):
    """
    Get all task completions for a specific race.
    Requires admin privileges.
    """
    completions = TaskLog.query.filter_by(race_id=race_id).all()
    return jsonify([
        {
            "task_id": completion.task_id,
            "team_id": completion.team_id,
            "created_at": completion.created_at,
        }
        for completion in completions
    ])

# get all visits for selected team and race with status
# tested by test_visits.py -> test_get_checkpoints_with_status
@race_bp.route("/<int:race_id>/checkpoints/<int:team_id>/status/", methods=["GET"])
@jwt_required()
def get_checkpoints_with_status(race_id, team_id):
    """
    Get all checkpoints for a race with visit status for a team.
    Requires to be an admin or a member of the team.
    ---
    tags:
      - Checkpoints
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
        description: List of checkpoints with visit status
        content:
          application/json:
            schema:
              type: array
              items:
                type: object
                properties:
                  id:
                    type: integer
                  title:
                    type: string
                  description:
                    type: string
                  latitude:
                    type: number
                  longitude:
                    type: number
                  visited:
                    type: boolean
      403:
        description: Unauthorized
        content:
          application/json:
            schema:
              type: object
              properties:
                msg:
                  type: string
                  example: Unauthorized
    """

    # Check if the user is authorized to view this team's data
    user = User.query.filter_by(id=get_jwt_identity()).first_or_404()
    if not user.is_administrator and team_id not in [team.id for team in user.teams]:
        return jsonify({"msg": "Unauthorized"}), 403

    # Get all checkpoints for the race
    race = Race.query.filter_by(id=race_id).first_or_404()
    checkpoints = race.checkpoints

    # Get all visits for the race and team
    visits = CheckpointLog.query.filter_by(race_id=race_id, team_id=team_id).all()
    visits_by_checkpoint = {visit.checkpoint_id: visit for visit in visits}

    # Build the response
    response = []
    for checkpoint in checkpoints:
        visit = visits_by_checkpoint.get(checkpoint.id)
        checkpoint_data = {
            "id": checkpoint.id,
            "title": checkpoint.title,
            "description": checkpoint.description,
            "latitude": checkpoint.latitude,
            "longitude": checkpoint.longitude,
            "visited": checkpoint.id in visits_by_checkpoint
        }
        # Add image info if visit exists and has an image
        if visit and visit.image_id:
            image = Image.query.get(visit.image_id)
            if image:
                checkpoint_data["image_filename"] = image.filename
        response.append(checkpoint_data)

    return jsonify(response), 200


@race_bp.route("/<int:race_id>/tasks/<int:team_id>/status/", methods=["GET"])
@jwt_required()
def get_tasks_with_status(race_id, team_id):
  """
  Get all tasks for a race with completion status for a team.
  Requires to be an admin or a member of the team.
  """

  user = User.query.filter_by(id=get_jwt_identity()).first_or_404()
  if not user.is_administrator and team_id not in [team.id for team in user.teams]:
    return jsonify({"msg": "Unauthorized"}), 403

  race = Race.query.filter_by(id=race_id).first_or_404()
  tasks = race.tasks

  completions = TaskLog.query.filter_by(race_id=race_id, team_id=team_id).all()
  completions_by_task = {completion.task_id: completion for completion in completions}

  response = []
  for task in tasks:
    completion = completions_by_task.get(task.id)
    task_data = {
      "id": task.id,
      "title": task.title,
      "description": task.description,
      "numOfPoints": task.numOfPoints,
      "completed": task.id in completions_by_task,
    }
    if completion and completion.image_id:
      image = Image.query.get(completion.image_id)
      if image:
        task_data["image_filename"] = image.filename
    response.append(task_data)

  return jsonify(response), 200


@race_bp.route("/<int:race_id>/results/", methods=["GET"])
@jwt_required()
def get_race_results(race_id):
    # ensure race exists
    Race.query.filter_by(id=race_id).first_or_404()

    registrations = (db.session.query(Registration.team_id, Team.name.label("team_name"), RaceCategory.name.label("race_category_name"))
        .select_from(Registration)
        .join(Team, Registration.team_id == Team.id)
        .join(RaceCategory, Registration.race_category_id == RaceCategory.id)
        .filter(Registration.race_id == race_id)
        .order_by(Registration.team_id)
        .all())
    
    checkpoints_points = (db.session.query(CheckpointLog.team_id, db.func.sum(Checkpoint.numOfPoints).label("total_points"))
        .select_from(CheckpointLog)
        .join(Checkpoint, CheckpointLog.checkpoint_id == Checkpoint.id)
        .filter(CheckpointLog.race_id == race_id)
        .group_by(CheckpointLog.team_id)
        .order_by(CheckpointLog.team_id)
        .all())
    
    tasks_points = (db.session.query(TaskLog.team_id, db.func.sum(Task.numOfPoints).label("total_points"))
        .select_from(TaskLog)
        .join(Task, TaskLog.task_id == Task.id)
        .filter(TaskLog.race_id == race_id)
        .group_by(TaskLog.team_id)
        .order_by(TaskLog.team_id)
        .all())
    
    result = []
    checkpoint_idx = 0
    task_idx = 0
    for reg in registrations:
        points_for_checkpoints = 0
        points_for_tasks = 0

        if checkpoint_idx < len(checkpoints_points) and reg.team_id == checkpoints_points[checkpoint_idx].team_id:
            points_for_checkpoints = checkpoints_points[checkpoint_idx].total_points
            checkpoint_idx += 1

        if task_idx < len(tasks_points) and reg.team_id == tasks_points[task_idx].team_id:
            points_for_tasks = tasks_points[task_idx].total_points
            task_idx += 1

        result.append({
            "team_id": reg.team_id,
            "team": reg.team_name,
            "category": reg.race_category_name,
            "points_for_checkpoints": points_for_checkpoints,
            "points_for_tasks": points_for_tasks,
            "total_points": points_for_checkpoints + points_for_tasks})
              

    return jsonify(result), 200
