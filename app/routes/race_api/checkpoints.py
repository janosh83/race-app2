import os
import uuid
import logging
from flask import Blueprint, jsonify, request, current_app

from app import db
from app.models import Checkpoint, CheckpointLog, User, Image, Registration, Race
from app.routes.admin import admin_required
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from datetime import datetime
from app.schemas import CheckpointCreateSchema, CheckpointLogSchema

logger = logging.getLogger(__name__)

# Blueprint pro checkpointy
checkpoints_bp = Blueprint('checkpoints', __name__)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@checkpoints_bp.route('/', methods=['GET'])
@jwt_required()
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

# tested by test_checkpoint.py -> test_delete_checkpoint
@checkpoints_bp.route('/', methods=['POST'])
@admin_required()
def create_checkpoint(race_id):
    """
    Create one or more checkpoints for a specific race (admin only).
    Accepts either a single checkpoint object or an array of checkpoints.
    Supports both JSON and multipart/form-data content types.
    ---
    tags:
      - Checkpoints
    parameters:
      - in: path
        name: race_id
        schema:
          type: integer
        required: true
        description: ID of the race to create checkpoints for
    security:
      - BearerAuth: []
    requestBody:
      required: true
      content:
        application/json:
          schema:
            oneOf:
              - type: object
                properties:
                  title:
                    type: string
                    description: The title of the checkpoint
                    example: "Main Square"
                  latitude:
                    type: number
                    format: float
                    description: The latitude coordinate
                    example: 50.0755
                  longitude:
                    type: number
                    format: float
                    description: The longitude coordinate
                    example: 14.4378
                  description:
                    type: string
                    description: Description of the checkpoint
                    example: "Meet at the fountain"
                  numOfPoints:
                    type: integer
                    description: Points awarded for visiting this checkpoint
                    example: 10
                required:
                  - title
              - type: array
                items:
                  type: object
                  properties:
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
        multipart/form-data:
          schema:
            type: object
            properties:
              title:
                type: string
                description: The title of the checkpoint
              latitude:
                type: number
                description: The latitude coordinate
              longitude:
                type: number
                description: The longitude coordinate
              description:
                type: string
                description: Description of the checkpoint
              numOfPoints:
                type: integer
                description: Points awarded for visiting this checkpoint
            required:
              - title
    responses:
      201:
        description: Checkpoint(s) created successfully
        content:
          application/json:
            schema:
              oneOf:
                - type: object
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
                - type: array
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
      400:
        description: Invalid input or missing required fields
        content:
          application/json:
            schema:
              type: object
              properties:
                message:
                  type: string
                  example: "Missing required field: title or name"
      404:
        description: Race not found
        content:
          application/json:
            schema:
              type: object
              properties:
                message:
                  type: string
                  example: "Race not found"
      403:
        description: Admins only
    """
    race = Race.query.filter_by(id=race_id).first()
    if not race:
      logger.error(f"Attempt to create checkpoint for non-existent race ID: {race_id}")
      return jsonify({"message": "Race not found"}), 404

    schema = CheckpointCreateSchema()

    if request.content_type and request.content_type.startswith('multipart/form-data'):
      raw_items = [request.form.to_dict()]
    else:
      payload = request.get_json(silent=True)
      if payload is None:
        logger.error(f"Invalid or missing JSON body in checkpoint creation for race {race_id}")
        return jsonify({"message": "Invalid or missing JSON body"}), 400
      raw_items = payload if isinstance(payload, list) else [payload]

    try:
      loaded = schema.load(raw_items, many=True)
    except Exception as err:
      logger.warning(f"Checkpoint creation validation failed for race {race_id}: {err}")
      return jsonify({"errors": getattr(err, 'messages', str(err))}), 400

    created = []
    for entry in loaded:
      new_checkpoint = Checkpoint(
        title=entry.get('title'),
        latitude=entry.get('latitude'),
        longitude=entry.get('longitude'),
        description=entry.get('description'),
        numOfPoints=entry.get('numOfPoints'),
        race_id=race_id
      )
      db.session.add(new_checkpoint)
      created.append(new_checkpoint)

    # commit once for all created records
    db.session.commit()
    logger.info(f"Created {len(created)} checkpoint(s) for race {race_id}")

    result = [{"id": cp.id, 
               "title": cp.title, 
               "description": cp.description, 
               "latitude": cp.latitude, "longitude": cp.longitude,
               "numOfPoints": cp.numOfPoints } for cp in created]
    # return single object when one created to remain backwards-compatible
    if len(result) == 1:
        return jsonify(result[0]), 201
    return jsonify(result), 201

# tested by test_races.py -> test_get_race_checkpoints
# TODO: return path to image
@checkpoints_bp.route("/<int:checkpoint_id>/", methods=["GET"])
@jwt_required()
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

# tested by test_visits.py -> test_log_visit
@checkpoints_bp.route("/log/", methods=["POST"])
@jwt_required()
def log_visit(race_id):
    """
    Log a visit to a checkpoint by a team, optionally with an image.
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
        multipart/form-data:
          schema:
            type: object
            properties:
              checkpoint_id:
                type: integer
                example: 5
              team_id:
                type: integer
                example: 2
              image:
                type: string
                format: binary
                description: Optional image file to upload
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
                image_id:
                  type: integer
                  nullable: true
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
    # Accept both JSON and multipart/form-data
    if request.content_type.startswith('multipart/form-data'):
      raw_data = request.form.to_dict()
      file = request.files.get('image')
    else:
      raw_data = request.get_json(silent=True) or {}
      file = None

    try:
      data = CheckpointLogSchema().load(raw_data)
    except Exception as err:
      logger.error(f"Checkpoint log validation failed for race {race_id}: {err}")
      return jsonify({"errors": getattr(err, 'messages', str(err))}), 400

    # check if user is admin or member of the team
    user = User.query.filter_by(id=get_jwt_identity()).first_or_404()
    is_administrator = user.is_administrator

    race = Race.query.filter_by(id=race_id).first_or_404()
    now = datetime.now()
    # allow logging only when inside logging period or if admin
    if not(race.start_logging_at < now and now < race.end_logging_at) and not is_administrator:
        logger.error(f"Attempt to log visit outside logging period for race {race_id} by user {user.id}")
        return jsonify({"message": "Logging for this race is not allowed at this time."}), 403

    registration = Registration.query.filter_by(race_id=race_id, team_id=data['team_id']).first_or_404()
    user_is_in_team = int(data['team_id']) in [team.id for team in user.teams]
    is_signed_to_race =  user_is_in_team and registration
    
    image_id = None
    if is_administrator or is_signed_to_race:
      if file and allowed_file(file.filename):
        # Generate unique filename: timestamp_uuid_original.ext
        original_filename = secure_filename(file.filename)
        file_ext = original_filename.rsplit('.', 1)[1].lower() if '.' in original_filename else 'jpg'
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        unique_id = uuid.uuid4().hex[:8]
        filename = f"{timestamp}_{unique_id}.{file_ext}"
        
        images_folder = current_app.config['IMAGE_UPLOAD_FOLDER']
        os.makedirs(images_folder, exist_ok=True)
        filepath = os.path.join(images_folder, filename)
        try:
            file.save(filepath)
            image = Image(filename=filename)
            db.session.add(image)
            db.session.commit() # not sure if it is needed here
            image_id = image.id
            logger.info(f"Image {filename} saved for checkpoint visit (race {race_id}, team {data['team_id']})")
        except Exception as e:
            logger.error(f"Failed to save image for checkpoint visit: {e}")
            # Continue without image
            image_id = None

      # log visit
      new_log = CheckpointLog(
          checkpoint_id=data['checkpoint_id'],
          team_id=data['team_id'],
          race_id=race_id,
          image_id=image_id)
      db.session.add(new_log)
      db.session.commit()
      logger.info(f"Checkpoint visit logged: race {race_id}, checkpoint {data['checkpoint_id']}, team {data['team_id']}, user {user.id}")
      return jsonify({
          "id": new_log.id, 
          "checkpoint_id": new_log.checkpoint_id, 
          "team_id": new_log.team_id, 
          "race_id": race_id, 
          "image_id": image_id}), 201
    else:
        logger.warning(f"Unauthorized checkpoint visit log attempt by user {user.id} for team {data['team_id']} in race {race_id}")
        return jsonify({"message": "You are not authorized to log this visit."}), 403

# tested by test_visits.py -> test_unlog_visits
@checkpoints_bp.route("/log/", methods=["DELETE"])
@jwt_required()
def unlog_visit(race_id):
    """
    Delete a log of a visit to a checkpoint by a team.
    Also deletes the associated image file and record if present.
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
    raw_data = request.get_json(silent=True) or {}
    try:
      data = CheckpointLogSchema().load(raw_data)
    except Exception as err:
      logger.error(f"Checkpoint unlog validation failed for race {race_id}: {err}")
      return jsonify({"errors": getattr(err, 'messages', str(err))}), 400

    # check if user is admin or member of the team
    user = User.query.filter_by(id=get_jwt_identity()).first_or_404()
    is_administrator = user.is_administrator

    race = Race.query.filter_by(id=race_id).first_or_404()
    now = datetime.now()
    # allow logging only when inside logging period or if admin
    if not(race.start_logging_at < now and now < race.end_logging_at) and not is_administrator:
        logger.error(f"Unlog attempt outside logging period for race {race_id} by user {user.id}")
        return jsonify({"message": "Logging for this race is not allowed at this time."}), 403

    user_is_in_team = int(data['team_id']) in [team.id for team in user.teams]
    registration = Registration.query.filter_by(race_id=race_id, team_id=data['team_id']).first_or_404()
    is_signed_to_race = user_is_in_team and registration
    
    if is_administrator or is_signed_to_race:
        log = CheckpointLog.query.filter_by(
            checkpoint_id=data["checkpoint_id"],
            team_id=data["team_id"],
            race_id=race_id
        ).first()
        if log:
            # Delete associated image file and record if present
            if log.image_id:
                image = Image.query.filter_by(id=log.image_id).first_or_404()
                if image:
                    images_folder = current_app.config['IMAGE_UPLOAD_FOLDER']
                    image_path = os.path.join(images_folder, image.filename)
                    try:
                        if os.path.exists(image_path):
                            os.remove(image_path)
                            logger.info(f"Deleted image file {image.filename} for checkpoint log {log.id}")
                    except Exception as e:
                        logger.error(f"Error deleting image file {image.filename}: {e}")
                    db.session.delete(image)
            db.session.delete(log)
            db.session.commit()
            logger.info(f"Checkpoint visit unlogged - race: {race_id}, team: {data['team_id']}, checkpoint: {data['checkpoint_id']}, user: {user.id}")
            return jsonify({"message": "Log deleted successfully."}), 200
        else:
            logger.error(f"Unlog attempt for non-existent log - race: {race_id}, team: {data['team_id']}, checkpoint: {data['checkpoint_id']}")
            return jsonify({"message": "Log not found."}), 404
    else:
        logger.error(f"Unauthorized unlog attempt by user {user.id} for team {data['team_id']}")
        return jsonify({"message": "You are not authorized to delete this visit."}), 403
    
# get all visits for selected team and race with status
# tested by test_visits.py -> test_get_checkpoints_with_status
@checkpoints_bp.route("/<int:team_id>/status/", methods=["GET"])
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
        logger.error(f"Unauthorized access attempt to team {team_id} checkpoints by user {user.id}")
        return jsonify({"msg": "Unauthorized"}), 403

    # Get all checkpoints for the race
    race = Race.query.filter_by(id=race_id).first_or_404()
    checkpoints = race.checkpoints

    # Get all visits for the race and team
    visits = CheckpointLog.query.filter_by(race_id=race_id, team_id=team_id).all()
    visits_by_checkpoint = {visit.checkpoint_id: visit for visit in visits}

    logger.info(f"Retrieved {len(checkpoints)} checkpoints with status for race {race_id}, team {team_id}, user {user.id}")

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
            image = Image.query.filter_by(id=visit.image_id).first_or_404()
            if image:
                checkpoint_data["image_filename"] = image.filename
        response.append(checkpoint_data)

    return jsonify(response), 200