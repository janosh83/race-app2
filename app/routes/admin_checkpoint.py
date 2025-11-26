import os
from flask import Blueprint, jsonify

from app import db
from app.models import Checkpoint, CheckpointLog, Image
from app.routes.admin import admin_required


# Blueprint pro checkpointy
admin_checkpoint_bp = Blueprint('checkpoint', __name__)

UPLOAD_FOLDER = 'static/images'

@admin_checkpoint_bp.route('/<int:checkpoint_id>/', methods=['GET'])
@admin_required()
def get_checkpoint(checkpoint_id):
    checkpoint = Checkpoint.query.get_or_404(checkpoint_id)
    return jsonify({
        "id": checkpoint.id,
        "title": checkpoint.title,
        "description": checkpoint.description,
        "latitude": checkpoint.latitude,
        "longitude": checkpoint.longitude,
        "numOfPoints": checkpoint.num_of_points
    }), 200

@admin_checkpoint_bp.route('/<int:checkpoint_id>/', methods=['DELETE'])
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