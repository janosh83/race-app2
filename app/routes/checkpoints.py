import os
import uuid
from flask import Blueprint, jsonify, request

from app import db
from app.models import Checkpoint, CheckpointLog, User, Image, Registration, Race
from app.routes.admin import admin_required
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from datetime import datetime

# Blueprint pro checkpointy
checkpoints_bp = Blueprint('checkpoints', __name__)

# Get the absolute path to the app directory for image uploads
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static', 'images')

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
    Accept either a single checkpoint object or an array of checkpoints.
    For JSON: body may be {...} or [{...}, {...}]
    For multipart/form-data: treat form as single checkpoint.
    """
    # determine input source
    if request.content_type and request.content_type.startswith('multipart/form-data'):
        # single item from form
        data = request.form.to_dict()
        items = [data]
    else:
        payload = request.get_json(silent=True)
        if payload is None:
            return jsonify({"message": "Invalid or missing JSON body"}), 400
        items = payload if isinstance(payload, list) else [payload]

    created = []
    for entry in items:
        # basic normalization of field names
        title = entry.get('title') or entry.get('name')
        latitude = entry.get('latitude') or entry.get('lat')
        longitude = entry.get('longitude') or entry.get('lng')
        description = entry.get('description') or entry.get('desc')
        num_points = entry.get('numOfPoints') or entry.get('num_of_points') or entry.get('numPoints') or 1

        if not title:
            return jsonify({"message": "Missing required field: title or name"}), 400

        new_checkpoint = Checkpoint(
            title=title,
            latitude=latitude,
            longitude=longitude,
            description=description,
            numOfPoints=num_points,
            race_id=race_id
        )
        db.session.add(new_checkpoint)
        created.append(new_checkpoint)

    # commit once for all created records
    db.session.commit()

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
        data = request.form
        file = request.files.get('image')
    else:
        data = request.json
        file = None

    # check if user is admin or member of the team
    user = User.query.filter_by(id=get_jwt_identity()).first_or_404()
    is_administrator = user.is_administrator

    race = Race.query.filter_by(id=race_id).first_or_404()
    now = datetime.now()
    # allow logging only when inside logging period or if admin
    if not(race.start_logging_at < now and now < race.end_logging_at) and not is_administrator:
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
        
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)
        file.save(filepath)
        image = Image(filename=filename)
        db.session.add(image)
        db.session.commit() # not sure if it is needed here
        image_id = image.id

      # log visit
      new_log = CheckpointLog(
          checkpoint_id=data['checkpoint_id'],
          team_id=data['team_id'],
          race_id=race_id,
          image_id=image_id)
      db.session.add(new_log)
      db.session.commit()
      return jsonify({
          "id": new_log.id, 
          "checkpoint_id": new_log.checkpoint_id, 
          "team_id": new_log.team_id, 
          "race_id": race_id, 
          "image_id": image_id}), 201
    else:
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
    data = request.json

    # check if user is admin or member of the team
    user = User.query.filter_by(id=get_jwt_identity()).first_or_404()
    is_administrator = user.is_administrator

    race = Race.query.filter_by(id=race_id).first_or_404()
    now = datetime.now()
    # allow logging only when inside logging period or if admin
    if not(race.start_logging_at < now and now < race.end_logging_at) and not is_administrator:
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
                image = Image.query.get(log.image_id)
                if image:
                    image_path = os.path.join(UPLOAD_FOLDER, image.filename)
                    try:
                        if os.path.exists(image_path):
                            os.remove(image_path)
                    except Exception as e:
                        print(f"Error deleting image file: {e}")
                    db.session.delete(image)
            db.session.delete(log)
            db.session.commit()
            return jsonify({"message": "Log deleted successfully."}), 200
        else:
            return jsonify({"message": "Log not found."}), 404
    else:
        return jsonify({"message": "You are not authorized to delete this visit."}), 403