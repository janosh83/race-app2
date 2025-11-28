from flask import Blueprint, jsonify, request

from app import db
from app.models import Race, CheckpointLog, User, RaceCategory, Registration, Team, Checkpoint
from app.routes.checkpoints import checkpoints_bp
from app.routes.admin import admin_required
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.utils import parse_datetime

race_bp = Blueprint("race", __name__)
race_bp.register_blueprint(checkpoints_bp, url_prefix='/<int:race_id>/checkpoints')

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
    result = Race.query.filter_by(id=race_id).first_or_404()
    if result:
        if result.checkpoints:
            return jsonify({"message": "Cannot delete the race, it has checkpoints associated with it."}), 400
        if result.teams:
            return jsonify({"message": "Cannot delete the race, it has teams associated with it."}), 400
        
        logs = CheckpointLog.query.filter_by(race_id=race_id).all()
        if logs:
            return jsonify({"message": "Cannot delete the race, it has visits associated with it."}), 400

        db.session.delete(result)
        db.session.commit()
        return jsonify({"message: Race deleted successfully"}), 200
    
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

# tested by tests\test_categories.py -> test_with_race
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
# Get visits
#

# get all visits for selected team and race
# tested by test_visits.py -> test_get_visits
@race_bp.route("/<int:race_id>/visits/<int:team_id>/", methods=["GET"])
@jwt_required()
def get_visits_by_race_and_team(race_id, team_id):
    """
    Get visits for a specific team and race.
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
        description: A list of all visits.
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

    visits = CheckpointLog.query.filter_by(race_id=race_id, team_id=team_id).all()
    return jsonify([{"checkpoint_id": visit.checkpoint_id, "team_id": visit.team_id, "created_at": visit.created_at} for visit in visits])

# get all visits for selected race
# tested by test_visits.py -> test_get_visits
@race_bp.route("/<int:race_id>/visits/", methods=["GET"])
@admin_required()
def get_visits_by_race(race_id):
    """
    Get all visits for a specific race.
    Requires admin privileges.
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
        description: A list of all visits
        content:
          application/json:
            schema:
              type: array
              items:
                $ref: '#/components/schemas/VisitObject'
    """
    visits = CheckpointLog.query.filter_by(race_id=race_id).all()
    return jsonify([{"checkpoint_id": visit.checkpoint_id, "team_id": visit.team_id, "created_at": visit.created_at} for visit in visits])

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
    visited_checkpoint_ids = {visit.checkpoint_id for visit in visits}

    # Build the response
    response = []
    for checkpoint in checkpoints:
        response.append({
            "id": checkpoint.id,
            "title": checkpoint.title,
            "description": checkpoint.description,
            "latitude": checkpoint.latitude,
            "longitude": checkpoint.longitude,
            "visited": checkpoint.id in visited_checkpoint_ids
        })

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
    
    points = (db.session.query(CheckpointLog.team_id, db.func.sum(Checkpoint.numOfPoints).label("total_points"))
        .select_from(CheckpointLog)
        .join(Checkpoint, CheckpointLog.checkpoint_id == Checkpoint.id)
        .filter(CheckpointLog.race_id == race_id)
        .group_by(CheckpointLog.team_id)
        .order_by(CheckpointLog.team_id)
        .all())
    
    result = []
    i = 0
    for reg in registrations:
        if i < len(points) and reg.team_id == points[i].team_id:
            result.append({
                "team": reg.team_name,
                "category": reg.race_category_name,
                "points_for_checkpoints": points[i].total_points})
            i += 1
        else:
            result.append({
                "team": reg.team_name,
                "category": reg.race_category_name,
                "points_for_checkpoints": 0})
              

    return jsonify(result), 200
