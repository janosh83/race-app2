import os
import uuid
import logging
from flask import Blueprint, jsonify, request
from sqlalchemy.exc import IntegrityError

from app import db
from app.models import Task, TaskLog, User, Image, Registration, Race
from app.routes.admin import admin_required
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from datetime import datetime
from app.schemas import TaskCreateSchema, TaskLogSchema

logger = logging.getLogger(__name__)

# Blueprint for tasks
tasks_bp = Blueprint('tasks', __name__)

# Get the absolute path to the app directory for image uploads
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static', 'images')

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@tasks_bp.route('/', methods=['GET'])
@jwt_required()
def get_tasks(race_id):
    """
    Get all tasks for a specific race.
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
    responses:
      200:
        description: A list of tasks
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
                  numOfPoints:
                    type: integer
    """
    tasks = Task.query.filter_by(race_id=race_id).all()
    return jsonify([
        {
            "id": task.id, 
            "title": task.title, 
            "description": task.description,
            "numOfPoints": task.numOfPoints
        }
        for task in tasks
    ])

@tasks_bp.route('/', methods=['POST'])
@admin_required()
def create_task(race_id):
    """
    Create one or more tasks for a specific race (admin only).
    Accepts either a single task object or an array of tasks.
    Supports both JSON and multipart/form-data content types.
    ---
    tags:
      - Tasks
    parameters:
      - in: path
        name: race_id
        schema:
          type: integer
        required: true
        description: ID of the race to create tasks for
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
                    description: The title of the task
                    example: "Collect signatures"
                  description:
                    type: string
                    description: Description of the task
                    example: "Get 5 signatures from different locations"
                  numOfPoints:
                    type: integer
                    description: Points awarded for completing this task
                    example: 15
                required:
                  - title
              - type: array
                items:
                  type: object
                  properties:
                    title:
                      type: string
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
                description: The title of the task
              description:
                type: string
                description: Description of the task
              numOfPoints:
                type: integer
                description: Points awarded for completing this task
            required:
              - title
    responses:
      201:
        description: Task(s) created successfully
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
    # ensure race exists
    race = Race.query.filter_by(id=race_id).first()
    if not race:
      logger.error(f"Attempt to create task for non-existent race {race_id}")
      return jsonify({"message": "Race not found"}), 404

    # determine input source
    if request.content_type and request.content_type.startswith('multipart/form-data'):
        # single item from form
        data = request.form.to_dict()
        items = [data]
    else:
        payload = request.get_json(silent=True)
        if payload is None:
            logger.error(f"Create task for race {race_id} with invalid JSON")
            return jsonify({"message": "Invalid or missing JSON body"}), 400
        items = payload if isinstance(payload, list) else [payload]

    # validate and normalize using schema (supports field aliases)
    schema = TaskCreateSchema()
    try:
      loaded = schema.load(items, many=True)
    except Exception as err:
      messages = getattr(err, 'messages', {})
      missing_title = False
      if isinstance(messages, dict):
        for _, detail in messages.items():
          if isinstance(detail, dict) and 'title' in detail:
            missing_title = True
            break
          if _ == 'title':
            missing_title = True
            break
      if missing_title:
        logger.warning(f"Task creation missing title for race {race_id}")
        return jsonify({"message": "Missing required field: title or name"}), 400
      logger.warning(f"Task creation validation failed for race {race_id}: {err}")
      return jsonify({"errors": messages or str(err)}), 400

    created = []
    for entry in loaded:
      new_task = Task(
        title=entry.get('title'),
        description=entry.get('description'),
        numOfPoints=entry.get('numOfPoints'),
        race_id=race_id
      )
      db.session.add(new_task)
      created.append(new_task)

    # commit once for all created records
    db.session.commit()
    logger.info(f"Created {len(created)} task(s) for race {race_id}")

    result = [{"id": t.id, 
               "title": t.title, 
               "description": t.description, 
               "numOfPoints": t.numOfPoints } for t in created]
    # return single object when one created to remain backwards-compatible
    if len(result) == 1:
        return jsonify(result[0]), 201
    return jsonify(result), 201

@tasks_bp.route("/<int:task_id>/", methods=["GET"])
@jwt_required()
def get_task(race_id, task_id):
    """
    Get a single task by its ID for a specific race.
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
        name: task_id
        schema:
          type: integer
        required: true
        description: ID of the task
    responses:
      200:
        description: Task details
        content:
          application/json:
            schema:
              type: object
              properties:
                id:
                  type: integer
                title:
                  type: string
                description:
                  type: string
                numOfPoints:
                  type: integer
      404:
        description: Task not found
    """
    task = Task.query.filter_by(race_id=race_id, id=task_id).first_or_404()
    return jsonify({
        "id": task.id, 
        "title": task.title, 
        "description": task.description, 
        "numOfPoints": task.numOfPoints}), 200

@tasks_bp.route("/log/", methods=["POST"])
@jwt_required()
def log_task_completion(race_id):
    """
    Log completion of a task by a team, optionally with an image.
    Requires user to be an administrator or a member of the team.
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
    requestBody:
      required: true
      content:
        multipart/form-data:
          schema:
            type: object
            properties:
              task_id:
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
              task_id:
                type: integer
                example: 5
              team_id:
                type: integer
                example: 2
    responses:
      201:
        description: Task completion logged successfully
        content:
          application/json:
            schema:
              type: object
              properties:
                id:
                  type: integer
                task_id:
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
                  example: You are not authorized to log this task.
      404:
        description: Race or team not found
    """
    # Accept both JSON and multipart/form-data
    if request.content_type and request.content_type.startswith('multipart/form-data'):
      raw_data = request.form.to_dict()
      file = request.files.get('image')
    else:
      raw_data = request.get_json(silent=True) or {}
      file = None

    try:
      data = TaskLogSchema().load(raw_data)
    except Exception as err:
      logger.warning(f"Task log validation failed for race {race_id}: {err}")
      return jsonify({"errors": getattr(err, 'messages', str(err))}), 400

    # check if user is admin or member of the team
    user = User.query.filter_by(id=get_jwt_identity()).first_or_404()
    is_administrator = user.is_administrator

    race = Race.query.filter_by(id=race_id).first_or_404()
    now = datetime.now()
    # allow logging only when inside logging period or if admin
    if not(race.start_logging_at < now and now < race.end_logging_at) and not is_administrator:
        logger.error(f"Task completion log attempt outside logging period for race {race_id} by user {user.id}")
        return jsonify({"message": "Logging for this race is not allowed at this time."}), 403

    registration = Registration.query.filter_by(race_id=race_id, team_id=data['team_id']).first_or_404()
    user_is_in_team = int(data['team_id']) in [team.id for team in user.teams]
    is_signed_to_race = user_is_in_team and registration
    
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
        try:
          file.save(filepath)
          logger.info(f"Task image saved: {filename} for race {race_id}, team {data['team_id']}")
        except Exception as e:
          logger.error(f"Error saving task image {filename}: {e}")
        image = Image(filename=filename)
        db.session.add(image)
        db.session.commit()
        image_id = image.id

      # log task completion
      new_log = TaskLog(
          task_id=data['task_id'],
          team_id=data['team_id'],
          race_id=race_id,
          image_id=image_id)
      db.session.add(new_log)
      try:
          db.session.commit()
          logger.info(f"Task completion logged - race: {race_id}, team: {data['team_id']}, task: {data['task_id']}, user: {user.id}")
      except IntegrityError:
          db.session.rollback()
          logger.error(f"Duplicate task log attempt - race: {race_id}, team: {data['team_id']}, task: {data['task_id']}")
          return jsonify({"message": "Task already logged for this team."}), 409
      return jsonify({
          "id": new_log.id, 
          "task_id": new_log.task_id, 
          "team_id": new_log.team_id, 
          "race_id": race_id, 
          "image_id": image_id}), 201
    else:
        logger.error(f"Unauthorized task completion log attempt by user {user.id} for team {data['team_id']}")
        return jsonify({"message": "You are not authorized to log this task."}), 403

@tasks_bp.route("/log/", methods=["DELETE"])
@jwt_required()
def unlog_task_completion(race_id):
    """
    Delete a log of a task completion by a team.
    Also deletes the associated image file and record if present.
    Requires user to be an administrator or a member of the team.
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
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              task_id:
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
                  example: You are not authorized to delete this task log.
    """
    raw_data = request.get_json(silent=True) or {}
    try:
      data = TaskLogSchema().load(raw_data)
    except Exception as err:
      logger.warning(f"Task unlog validation failed for race {race_id}: {err}")
      return jsonify({"errors": getattr(err, 'messages', str(err))}), 400

    # check if user is admin or member of the team
    user = User.query.filter_by(id=get_jwt_identity()).first_or_404()
    is_administrator = user.is_administrator

    race = Race.query.filter_by(id=race_id).first_or_404()
    now = datetime.now()
    # allow logging only when inside logging period or if admin
    if not(race.start_logging_at < now and now < race.end_logging_at) and not is_administrator:
        logger.error(f"Task unlog attempt outside logging period for race {race_id} by user {user.id}")
        return jsonify({"message": "Logging for this race is not allowed at this time."}), 403

    user_is_in_team = int(data['team_id']) in [team.id for team in user.teams]
    registration = Registration.query.filter_by(race_id=race_id, team_id=data['team_id']).first_or_404()
    is_signed_to_race = user_is_in_team and registration
    
    if is_administrator or is_signed_to_race:
        log = TaskLog.query.filter_by(
            task_id=data["task_id"],
            team_id=data["team_id"],
            race_id=race_id
        ).first()
        if log:
            # Delete associated image file and record if present
            if log.image_id:
                image = Image.query.filter_by(id=log.image_id).first_or_404()
                if image:
                    image_path = os.path.join(UPLOAD_FOLDER, image.filename)
                    try:
                        if os.path.exists(image_path):
                            os.remove(image_path)
                            logger.info(f"Deleted task image file {image.filename} for log {log.id}")
                    except Exception as e:
                        logger.error(f"Error deleting task image file {image.filename}: {e}")
                    db.session.delete(image)
            db.session.delete(log)
            db.session.commit()
            logger.info(f"Task completion unlogged - race: {race_id}, team: {data['team_id']}, task: {data['task_id']}, user: {user.id}")
            return jsonify({"message": "Log deleted successfully."}), 200
        else:
            logger.error(f"Task unlog attempt for non-existent log - race: {race_id}, team: {data['team_id']}, task: {data['task_id']}")
            return jsonify({"message": "Log not found."}), 404
    else:
        logger.error(f"Unauthorized task unlog attempt by user {user.id} for team {data['team_id']}")
        return jsonify({"message": "You are not authorized to delete this task log."}), 403

@tasks_bp.route("/<int:team_id>/status/", methods=["GET"])
@jwt_required()
def get_tasks_with_status(race_id, team_id):
  """
  Get all tasks for a race with completion status for a team.
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
      description: List of tasks with completion status
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
                numOfPoints:
                  type: integer
                completed:
                  type: boolean
                image_filename:
                  type: string
                  nullable: true
                  description: Present when a completion includes an image
    403:
      description: Unauthorized (user is not an admin or team member)
  """

  user = User.query.filter_by(id=get_jwt_identity()).first_or_404()
  if not user.is_administrator and team_id not in [team.id for team in user.teams]:
    logger.error(f"Unauthorized access attempt to team {team_id} tasks by user {user.id}")
    return jsonify({"msg": "Unauthorized"}), 403

  race = Race.query.filter_by(id=race_id).first_or_404()
  tasks = race.tasks

  completions = TaskLog.query.filter_by(race_id=race_id, team_id=team_id).all()
  completions_by_task = {completion.task_id: completion for completion in completions}
  
  logger.info(f"Retrieved {len(tasks)} tasks with status for race {race_id}, team {team_id}, user {user.id}")

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
      image = Image.query.filter_by(id=completion.image_id).first_or_404()
      if image:
        task_data["image_filename"] = image.filename
    response.append(task_data)

  return jsonify(response), 200