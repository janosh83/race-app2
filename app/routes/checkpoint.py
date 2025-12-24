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
@checkpoint_bp.route('/<int:checkpoint_id>/', methods=['GET'])
@admin_required()
def get_checkpoint(checkpoint_id):
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
