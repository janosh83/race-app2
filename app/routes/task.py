import os
import logging
from flask import Blueprint, jsonify, current_app, request

from app import db
from app.models import Task, TaskLog, Image, TaskTranslation
from app.routes.admin import admin_required
from app.schemas import TaskUpdateSchema, TaskTranslationCreateSchema, TaskTranslationUpdateSchema

logger = logging.getLogger(__name__)

task_bp = Blueprint('task', __name__)

# tested by test_task.py -> test_task
# NOTE: this entpoint is admin only as users are getting task though race api
@task_bp.route('/<int:task_id>/', methods=['GET'])
@admin_required()
def get_task(task_id):
    """
    Get a single task (admin only).
    ---
    tags:
      - Tasks
    parameters:
      - in: path
        name: task_id
        schema:
          type: integer
        required: true
        description: ID of the task
      - in: query
        name: lang
        schema:
          type: string
        required: false
        description: Optional language code for translated fields
    security:
      - BearerAuth: []
    responses:
      200:
        description: Details of a specific task
        content:
          application/json:
            schema:
              type: object
              properties:
                id:
                  type: integer
                  description: The task ID
                title:
                  type: string
                  description: The title of the task
                description:
                  type: string
                  description: The description of the task
                numOfPoints:
                  type: integer
                  description: The number of points for completing the task
      404:
        description: Task not found
      403:
        description: Admins only
      400:
        description: Language not supported by race
    """
    task = Task.query.filter_by(id=task_id).first_or_404()
    language = request.args.get("lang")
    title = task.title
    description = task.description
    if language:
        if language not in (task.race.supported_languages or []):
            logger.warning("Task retrieval with unsupported language %s for task %s", language, task_id)
            return jsonify({"errors": {"language": ["Language not supported by race"]}}), 400
        translation = TaskTranslation.query.filter_by(task_id=task_id, language=language).first()
        if translation:
            title = translation.title
            description = translation.description
    return jsonify({
      "id": task.id,
      "title": title,
      "description": description,
      "numOfPoints": task.numOfPoints
    }), 200

# tested by test_task.py -> test_update_task
@task_bp.route('/<int:task_id>/', methods=['PUT'])
@admin_required()
def update_task(task_id):
    """
    Update a task (admin only).
    ---
    tags:
      - Tasks
    parameters:
      - in: path
        name: task_id
        schema:
          type: integer
        required: true
        description: ID of the task to update
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              title:
                type: string
                description: The title of the task
              description:
                type: string
                description: The description of the task
              numOfPoints:
                type: integer
                description: The number of points for completing the task
    security:
      - BearerAuth: []
    responses:
      200:
        description: Task updated successfully
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
      403:
        description: Admins only
    """
    task = Task.query.filter_by(id=task_id).first_or_404()
    data = request.get_json() or {}
    validated = TaskUpdateSchema().load(data)

    updated_fields = []
    if 'title' in validated:
        task.title = validated['title']
        updated_fields.append('title')
    if 'description' in validated:
        task.description = validated['description']
        updated_fields.append('description')
    if 'numOfPoints' in validated:
        task.numOfPoints = validated['numOfPoints']
        updated_fields.append('numOfPoints')

    db.session.commit()
    logger.info("Task %s updated - fields: %s", task_id, ', '.join(updated_fields))
    return jsonify({
        "id": task.id,
        "title": task.title,
        "description": task.description,
        "numOfPoints": task.numOfPoints
    }), 200


@task_bp.route('/<int:task_id>/translations/', methods=['GET'])
@admin_required()
def get_task_translations(task_id):
    """
    Get all translations for a task (admin only).
    ---
    tags:
      - Tasks
    parameters:
      - in: path
        name: task_id
        schema:
          type: integer
        required: true
        description: ID of the task
    security:
      - BearerAuth: []
    responses:
      200:
        description: List of task translations
        content:
          application/json:
            schema:
              type: array
              items:
                type: object
                properties:
                  id:
                    type: integer
                  language:
                    type: string
                  title:
                    type: string
                  description:
                    type: string
    """
    task = Task.query.filter_by(id=task_id).first_or_404()
    logger.info("Retrieved %d task translations for task %d", len(task.translations), task_id)
    return jsonify([
        {
            "id": translation.id,
            "language": translation.language,
            "title": translation.title,
            "description": translation.description,
        }
        for translation in task.translations
    ]), 200


@task_bp.route('/<int:task_id>/translations/', methods=['POST'])
@admin_required()
def create_task_translation(task_id):
    """
    Create a translation for a task (admin only).
    ---
    tags:
      - Tasks
    parameters:
      - in: path
        name: task_id
        schema:
          type: integer
        required: true
        description: ID of the task
    security:
      - BearerAuth: []
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              language:
                type: string
              title:
                type: string
              description:
                type: string
            required:
              - language
              - title
    responses:
      201:
        description: Translation created
      400:
        description: Language not supported by race
      409:
        description: Translation already exists
    """
    task = Task.query.filter_by(id=task_id).first_or_404()
    data = request.get_json(silent=True) or {}
    validated = TaskTranslationCreateSchema().load(data)
    if validated["language"] not in (task.race.supported_languages or []):
        logger.warning("Task translation create rejected for task %s: language %s not supported", task_id, validated['language'])
        return jsonify({"errors": {"language": ["Language not supported by race"]}}), 400

    existing = TaskTranslation.query.filter_by(
        task_id=task_id,
        language=validated["language"],
    ).first()
    if existing:
        logger.warning("Task translation already exists for task %s language %s", task_id, validated['language'])
        return jsonify({"message": "Translation already exists"}), 409

    translation = TaskTranslation(
        task_id=task_id,
        language=validated["language"],
        title=validated["title"],
        description=validated.get("description"),
    )
    db.session.add(translation)
    db.session.commit()
    logger.info("Task translation created for task %s language %s", task_id, translation.language)
    return jsonify({
        "id": translation.id,
        "language": translation.language,
        "title": translation.title,
        "description": translation.description,
    }), 201


@task_bp.route('/<int:task_id>/translations/<string:language>/', methods=['PUT'])
@admin_required()
def update_task_translation(task_id, language):
    """
    Update a translation for a task (admin only).
    ---
    tags:
      - Tasks
    parameters:
      - in: path
        name: task_id
        schema:
          type: integer
        required: true
        description: ID of the task
      - in: path
        name: language
        schema:
          type: string
        required: true
        description: Translation language code
    security:
      - BearerAuth: []
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              title:
                type: string
              description:
                type: string
    responses:
      200:
        description: Translation updated
      400:
        description: Language not supported by race
      404:
        description: Translation not found
    """
    task = Task.query.filter_by(id=task_id).first_or_404()
    if language not in (task.race.supported_languages or []):
        logger.warning("Task translation update rejected for task %s: language %s not supported", task_id, language)
        return jsonify({"errors": {"language": ["Language not supported by race"]}}), 400

    translation = TaskTranslation.query.filter_by(task_id=task_id, language=language).first()
    if not translation:
        logger.warning("Task translation not found for task %s language %s", task_id, language)
        return jsonify({"message": "Translation not found"}), 404

    data = request.get_json(silent=True) or {}
    validated = TaskTranslationUpdateSchema().load(data, partial=True)
    if "title" in validated:
        translation.title = validated["title"]
    if "description" in validated:
        translation.description = validated["description"]

    db.session.commit()
    logger.info("Task translation updated for task %s language %s", task_id, language)
    return jsonify({
        "id": translation.id,
        "language": translation.language,
        "title": translation.title,
        "description": translation.description,
    }), 200


@task_bp.route('/<int:task_id>/translations/<string:language>/', methods=['DELETE'])
@admin_required()
def delete_task_translation(task_id, language):
    """
    Delete a translation for a task (admin only).
    ---
    tags:
      - Tasks
    parameters:
      - in: path
        name: task_id
        schema:
          type: integer
        required: true
        description: ID of the task
      - in: path
        name: language
        schema:
          type: string
        required: true
        description: Translation language code
    security:
      - BearerAuth: []
    responses:
      200:
        description: Translation deleted
      404:
        description: Translation not found
    """
    translation = TaskTranslation.query.filter_by(task_id=task_id, language=language).first_or_404()
    db.session.delete(translation)
    db.session.commit()
    logger.info("Task translation deleted for task %s language %s", task_id, language)
    return jsonify({"message": "Translation deleted."}), 200

# tested by test_task.py -> test_delete_task
@task_bp.route('/<int:task_id>/', methods=['DELETE'])
@admin_required()
def delete_task(task_id):
    """
    Delete a task and all associated logs and images (admin only).
    ---
    tags:
      - Tasks
    parameters:
      - in: path
        name: task_id
        schema:
          type: integer
        required: true
        description: ID of the task to delete
    security:
      - BearerAuth: []
    responses:
      200:
        description: Task and associated logs deleted successfully
        content:
          application/json:
            schema:
              type: object
              properties:
                message:
                  type: string
                  example: "Task and associated logs deleted."
      404:
        description: Task not found
      403:
        description: Admins only
    """
    # delete associated logs and images
    task = Task.query.filter_by(id=task_id).first_or_404()
    logs = TaskLog.query.filter_by(task_id=task_id).all()

    deleted_images = 0
    for log in logs:
        if log.image_id:
            image = Image.query.filter_by(id=log.image_id).first_or_404()
            if image:
                images_folder = current_app.config['IMAGE_UPLOAD_FOLDER']
                image_path = os.path.join(images_folder, image.filename)
                try:
                    if os.path.exists(image_path):
                        os.remove(image_path)
                        deleted_images += 1
                except OSError as e:
                    logger.error("Error deleting image file %s for task %s: %s", image.filename, task_id, e)
                db.session.delete(image)
        db.session.delete(log)

    logger.info("Task %s deleted with %s logs and %s images", task_id, len(logs), deleted_images)
    db.session.delete(task)
    db.session.commit()
    return jsonify({"message": "Task and associated logs deleted."}), 200
