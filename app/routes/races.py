from flask import Blueprint, jsonify, request

from app import db
from app.models import Race, CheckpointLog, User
from app.routes.checkpoints import checkpoints_bp
from app.routes.admin import admin_required
from flask_jwt_extended import jwt_required, get_jwt_identity

race_bp = Blueprint("race", __name__)
race_bp.register_blueprint(checkpoints_bp, url_prefix='/<int:race_id>/checkpoints')


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
    return jsonify([{"id": race.id, "name": race.name, "description": race.description} for race in races])

# get single race
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
    return jsonify({"id": race.id, "name": race.name, "description": race.description}), 200

# add race
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
    responses:
      201:
        description: Created race
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/RaceObject'
    """
    data = request.json
    new_race = Race(name=data['name'], description=data['description'])
    db.session.add(new_race)
    db.session.commit()
    return jsonify({"id": new_race.id, "name": new_race.name, "description": new_race.description}), 201

#
# Get visits
#

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

@race_bp.route("/<int:race_id>/checkpoints/<int:team_id>/status/", methods=["GET"])
@jwt_required()
def get_checkpoints_with_status(race_id, team_id):
    """
    Get all checkpoints for a race with visit status for a team.
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


# TODO: compute results
