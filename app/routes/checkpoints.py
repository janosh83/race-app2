from flask import Blueprint, jsonify, request

from app import db
from app.models import Checkpoint, CheckpointLog, User, Race
from app.routes.admin import admin_required
from flask_jwt_extended import jwt_required, get_jwt_identity

# Blueprint pro checkpointy
checkpoints_bp = Blueprint('checkpoints', __name__)

@checkpoints_bp.route('/', methods=['GET'])
def get_checkpoints(race_id):
    """
    Get all checkpoints for a specific race.
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
    responses:
      200:
        description: A list of checkpoints
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
                  latitude:
                    type: number
                  longitude:
                    type: number
                  description:
                    type: string
                  numOfPoints:
                    type: integer
    """
    checkpoints = Checkpoint.query.filter_by(race_id=race_id).all()
    return jsonify([
        {
            "id": checkpoint.id, 
            "title": checkpoint.title, 
            "latitude": checkpoint.latitude, 
            "longitude": checkpoint.longitude,
            "description": checkpoint.description,
            "numOfPoints": checkpoint.numOfPoints
        }
        for checkpoint in checkpoints
    ])

@checkpoints_bp.route('/', methods=['POST'])
@admin_required()
def create_checkpoint(race_id):
    """
    Create a new checkpoint for a specific race.
    Requires admin privileges.
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
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              title:
                type: string
                example: "Start"
              latitude:
                type: number
                example: 49.8729317
              longitude:
                type: number
                example: 14.8981184
              description:
                type: string
                example: "Starting point"
              numOfPoints:
                type: integer
                example: 1
    responses:
      201:
        description: Checkpoint created successfully
        content:
          application/json:
            schema:
              type: object
              properties:
                id:
                  type: integer
                title:
                  type: string
    """
    data = request.json
    new_checkpoint = Checkpoint(
        title=data['title'],
        latitude=data['latitude'],
        longitude=data['longitude'],
        description=data['description'],
        numOfPoints=data['numOfPoints'], # TODO: if not exist, set to 1
        race_id=race_id
    )
    db.session.add(new_checkpoint)
    db.session.commit()
    return jsonify({"id": new_checkpoint.id, "title": new_checkpoint.title}), 201

@checkpoints_bp.route("/<int:checkpoint_id>/", methods=["GET"])
def get_checkpoint(race_id, checkpoint_id):
    """
    Get a single checkpoint by its ID for a specific race.
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
        name: checkpoint_id
        schema:
          type: integer
        required: true
        description: ID of the checkpoint
    responses:
      200:
        description: Checkpoint details
        content:
          application/json:
            schema:
              type: object
              properties:
                id:
                  type: integer
                title:
                  type: string
                latitude:
                  type: number
                longitude:
                  type: number
                description:
                  type: string
                numOfPoints:
                  type: integer
      404:
        description: Checkpoint not found
    """
    checkpoint = Checkpoint.query.filter_by(race_id=race_id, id = checkpoint_id).first_or_404()
    return jsonify({
        "id": checkpoint.id, 
        "title": checkpoint.title, 
        "latitude": checkpoint.latitude, 
        "longitude": checkpoint.longitude, 
        "description": checkpoint.description, 
        "numOfPoints": checkpoint.numOfPoints}), 200

@checkpoints_bp.route("/log/", methods=["POST"])
@jwt_required()
def log_visit(race_id):
    """
    Log a visit to a checkpoint by a team.
    Requires user to be an administrator or a member of the team.
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
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              checkpoint_id:
                type: integer
                example: 5
              team_id:
                type: integer
                example: 2
    responses:
      201:
        description: Visit logged successfully
        content:
          application/json:
            schema:
              type: object
              properties:
                id:
                  type: integer
                checkpoint_id:
                  type: integer
                team_id:
                  type: integer
                race_id:
                  type: integer
      403:
        description: Unauthorized access
        content:
          application/json:
            schema:
              type: object
              properties:
                message:
                  type: string
                  example: You are not authorized to log this visit.
      404:
        description: Race or team not found
    """
    data = request.json

    # check if user is admin or member of the team
    user = User.query.filter_by(id=get_jwt_identity()).first_or_404()
    is_administrator = user.is_administrator

    race = Race.query.filter_by(id=race_id).first_or_404()
    is_signed_to_race =  data['team_id'] in [team.id for team in user.teams] and data['team_id'] in [team.id for team in race.teams]
    
    if is_administrator or is_signed_to_race:
        # log visit
        new_log = CheckpointLog(
            checkpoint_id=data['checkpoint_id'],
            team_id=data['team_id'],
            race_id=race_id)
        db.session.add(new_log)
        db.session.commit()
        return jsonify({"id": new_log.id, "checkpoint_id": new_log.checkpoint_id, "team_id": new_log.team_id, "race_id": race_id}), 201
    else:
        return jsonify({"message": "You are not authorized to log this visit."}), 403
    
@checkpoints_bp.route("/log/", methods=["DELETE"])
@jwt_required()
def unlog_visit(race_id):
    """
    Delete a log of a visit to a checkpoint by a team.
    Requires user to be an administrator or a member of the team.
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
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              checkpoint_id:
                type: integer
                example: 5
              team_id:
                type: integer
                example: 2
    responses:
      200:
        description: Log deleted successfully
        content:
          application/json:
            schema:
              type: object
              properties:
                message:
                  type: string
                  example: Log deleted successfully.
      404:
        description: Log not found
        content:
          application/json:
            schema:
              type: object
              properties:
                message:
                  type: string
                  example: Log not found.
      403:
        description: Unauthorized access
        content:
          application/json:
            schema:
              type: object
              properties:
                message:
                  type: string
                  example: You are not authorized to delete this visit.
    """
    data = request.json

    # check if user is admin or member of the team
    user = User.query.filter_by(id=get_jwt_identity()).first_or_404()
    is_administrator = user.is_administrator

    race = Race.query.filter_by(id=race_id).first_or_404()
    is_signed_to_race =  data['team_id'] in [team.id for team in user.teams] and data['team_id'] in [team.id for team in race.teams]
    
    if is_administrator or is_signed_to_race:
        result = CheckpointLog.query.filter_by(checkpoint_id = data["checkpoint_id"], team_id = data["team_id"], race_id=race_id).delete()
        db.session.commit()
        if result:
            return jsonify({"message": "Log deleted successfully."}), 200
        else:
            return jsonify({"message": "Log not found."}), 404
    else:
        return jsonify({"message": "You are not authorized to delete this visit."}), 403