import os
import logging
from flask import Blueprint, jsonify, current_app, request
from marshmallow import ValidationError

from app import db
from app.models import Task, TaskLog, Image
from app.routes.admin import admin_required
from app.schemas import TaskUpdateSchema

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
    """
    task = Task.query.filter_by(id=task_id).first_or_404()
    return jsonify({
        "id": task.id,
        "title": task.title,
        "description": task.description,
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
                description: The number of points for completing
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
    logger.info(f"Task {task_id} updated - fields: {', '.join(updated_fields)}")  
    return jsonify({
        "id": task.id,
        "title": task.title,
        "description": task.description,
        "numOfPoints": task.numOfPoints
    }), 200

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
                except Exception as e:
                    logger.error(f"Error deleting image file {image.filename} for task {task_id}: {e}")
                db.session.delete(image)
        db.session.delete(log)
    
    logger.info(f"Task {task_id} deleted with {len(logs)} logs and {deleted_images} images")
    db.session.delete(task)
    db.session.commit()
    return jsonify({"message": "Task and associated logs deleted."}), 200