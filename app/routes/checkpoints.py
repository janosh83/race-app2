from flask import Blueprint, jsonify, request

from app import db
from app.models import Checkpoint, CheckpointLog

# Blueprint pro checkpointy
checkpoints_bp = Blueprint('checkpoints', __name__)

@checkpoints_bp.route('/', methods=['GET'])
def get_checkpoints(race_id):
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
def create_checkpoint(race_id):
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

# get single checkpoint
@checkpoints_bp.route("/<int:checkpoint_id>/", methods=["GET"])
def get_checkpoint(race_id ,checkpoint_id):
    checkpoint = Checkpoint.query.filter_by(race_id=race_id, id = checkpoint_id).first_or_404()
    return jsonify({
        "id": checkpoint.id, 
        "title": checkpoint.title, 
        "latitude": checkpoint.latitude, 
        "longitude": checkpoint.longitude, 
        "description": checkpoint.description, 
        "numOfPoints": checkpoint.numOfPoints}), 200

@checkpoints_bp.route("/log/", methods=["POST"])
def log_visit(race_id):
    # TODO: check if team is signed to race, check if checkpoint is in race
    data = request.json
    new_log = CheckpointLog(
        checkpoint_id=data['checkpoint_id'],
        team_id=data['team_id'],
        race_id=race_id)
    db.session.add(new_log)
    db.session.commit()
    return jsonify({"id": new_log.id, "checkpoint_id": new_log.checkpoint_id, "team_id": new_log.team_id, "race_id": race_id}), 201