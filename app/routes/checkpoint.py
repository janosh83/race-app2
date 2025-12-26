import os
from flask import Blueprint, jsonify

from app import db
from app.models import Checkpoint, CheckpointLog, Image
from app.routes.admin import admin_required


# Blueprint pro checkpointy
checkpoint_bp = Blueprint('checkpoint', __name__)

# FIXME: should be in config and aligned with render settings
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static', 'images')

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
    checkpoint = Checkpoint.query.get_or_404(checkpoint_id)
    logs = CheckpointLog.query.filter_by(checkpoint_id=checkpoint_id).all()
    for log in logs:
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
    db.session.delete(checkpoint)
    db.session.commit()
    return jsonify({"message": "Checkpoint and associated logs deleted."}), 200
