import os
import logging
from flask import Blueprint, jsonify, current_app, request
from marshmallow import ValidationError

from app import db
from app.models import Checkpoint, CheckpointLog, Image
from app.routes.admin import admin_required
from app.schemas import CheckpointUpdateSchema

logger = logging.getLogger(__name__)


# Blueprint pro checkpointy
checkpoint_bp = Blueprint('checkpoint', __name__)

# tested by test_checkpoint.py -> test_checkpoint
# NOTE: this endpoint is admin only as users are getting checkpoint though race api
@checkpoint_bp.route('/<int:checkpoint_id>/', methods=['GET'])
@admin_required()
def get_checkpoint(checkpoint_id):
    """
    Get a single checkpoint (admin only).
    ---
    tags:
      - Checkpoints
    parameters:
      - in: path
        name: checkpoint_id
        schema:
          type: integer
        required: true
        description: ID of the checkpoint
    security:
      - BearerAuth: []
    responses:
      200:
        description: Details of a specific checkpoint
        content:
          application/json:
            schema:
              type: object
              properties:
                id:
                  type: integer
                  description: The checkpoint ID
                title:
                  type: string
                  description: The title of the checkpoint
                description:
                  type: string
                  description: The description of the checkpoint
                latitude:
                  type: number
                  format: float
                  description: The latitude coordinate of the checkpoint
                longitude:
                  type: number
                  format: float
                  description: The longitude coordinate of the checkpoint
                numOfPoints:
                  type: integer
                  description: The number of points for visiting this checkpoint
      404:
        description: Checkpoint not found
      403:
        description: Admins only
    """
    checkpoint = Checkpoint.query.filter_by(id=checkpoint_id).first_or_404()
    return jsonify({
        "id": checkpoint.id,
        "title": checkpoint.title,
        "description": checkpoint.description,
        "latitude": checkpoint.latitude,
        "longitude": checkpoint.longitude,
        "numOfPoints": checkpoint.numOfPoints
    }), 200

@checkpoint_bp.route('/<int:checkpoint_id>/', methods=['PUT'])
@admin_required()
def update_checkpoint(checkpoint_id):
    """
    Update a checkpoint (admin only).
    ---
    tags:
      - Checkpoints
    parameters:
      - in: path
        name: checkpoint_id
        schema:
          type: integer
        required: true
        description: ID of the checkpoint to update
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              title:
                type: string
                description: The title of the checkpoint
              description:
                type: string
                description: The description of the checkpoint
              latitude:
                type: number
                format: float
                description: The latitude coordinate
              longitude:
                type: number
                format: float
                description: The longitude coordinate
              numOfPoints:
                type: integer
                description: The number of points for visiting
    security:
      - BearerAuth: []
    responses:
      200:
        description: Checkpoint updated successfully
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
                latitude:
                  type: number
                longitude:
                  type: number
                numOfPoints:
                  type: integer
      404:
        description: Checkpoint not found
      403:
        description: Admins only
    """
    checkpoint = Checkpoint.query.filter_by(id=checkpoint_id).first_or_404()
    data = request.get_json() or {}
    validated = CheckpointUpdateSchema().load(data)
    
    updated_fields = []
    if 'title' in validated:
        checkpoint.title = validated['title']
        updated_fields.append('title')
    if 'description' in validated:
        checkpoint.description = validated['description']
        updated_fields.append('description')
    if 'latitude' in validated:
        checkpoint.latitude = validated['latitude']
        updated_fields.append('latitude')
    if 'longitude' in validated:
        checkpoint.longitude = validated['longitude']
        updated_fields.append('longitude')
    if 'numOfPoints' in validated:
        checkpoint.numOfPoints = validated['numOfPoints']
        updated_fields.append('numOfPoints')
    
    db.session.commit()
    logger.info(f"Checkpoint {checkpoint_id} updated - fields: {', '.join(updated_fields)}")
    return jsonify({
        "id": checkpoint.id,
        "title": checkpoint.title,
        "description": checkpoint.description,
        "latitude": checkpoint.latitude,
        "longitude": checkpoint.longitude,
        "numOfPoints": checkpoint.numOfPoints
    }), 200

# tested by test_checkpoint.py -> test_delete_checkpoint
@checkpoint_bp.route('/<int:checkpoint_id>/', methods=['DELETE'])
@admin_required()
def delete_checkpoint(checkpoint_id):
    """
    Delete a checkpoint and all associated logs and images (admin only).
    ---
    tags:
      - Checkpoints
    parameters:
      - in: path
        name: checkpoint_id
        schema:
          type: integer
        required: true
        description: ID of the checkpoint to delete
    security:
      - BearerAuth: []
    responses:
      200:
        description: Checkpoint and associated logs deleted successfully
        content:
          application/json:
            schema:
              type: object
              properties:
                message:
                  type: string
                  example: "Checkpoint and associated logs deleted."
      404:
        description: Checkpoint not found
      403:
        description: Admins only
    """
    # delete associated logs and images
    checkpoint = Checkpoint.query.filter_by(id=checkpoint_id).first_or_404()
    logs = CheckpointLog.query.filter_by(checkpoint_id=checkpoint_id).all()
    
    deleted_images = 0
    for log in logs:
        if log.image_id:
            image = Image.query.filter_by(id=log.image_id).first()
            if image:
                images_folder = current_app.config['IMAGE_UPLOAD_FOLDER']
                image_path = os.path.join(images_folder, image.filename)
                try:
                    if os.path.exists(image_path):
                        os.remove(image_path)
                        deleted_images += 1
                except Exception as e:
                    logger.error(f"Error deleting image file {image.filename} for checkpoint {checkpoint_id}: {e}")
                db.session.delete(image)
        db.session.delete(log)
    
    logger.info(f"Checkpoint {checkpoint_id} deleted with {len(logs)} logs and {deleted_images} images")
    db.session.delete(checkpoint)
    db.session.commit()
    return jsonify({"message": "Checkpoint and associated logs deleted."}), 200
