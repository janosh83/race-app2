from flask import Blueprint, jsonify, request

from app import db
from app.models import Checkpoint, CheckpointLog, User, Race
from app.routes.admin import admin_required
from flask_jwt_extended import jwt_required, get_jwt_identity

# Blueprint pro checkpointy
checkpoints_bp = Blueprint('checkpoints', __name__)

@checkpoints_bp.route('/', methods=['GET'])
# TODO: check if user is admin or member of the team
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
@admin_required()
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
# TODO: check if user is admin or member of the team
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
@jwt_required()
def log_visit(race_id):
    data = request.json

    # check if user is admin or member of the team
    user = User.query.filter_by(id=get_jwt_identity()).first_or_404()
    is_administrator = user.is_administrator

    race = Race.query.filter_by(id=race_id).first_or_404()
    is_signed_to_race =  data['team_id'] in [team.id for team in user.teams] and data['team_id'] in [team.id for team in race.teams]
    
    if is_administrator or is_signed_to_race:
        # log visit
        new_log = CheckpointLog(
            checkpoint_id=data['checkpoint_id'],
            team_id=data['team_id'],
            race_id=race_id)
        db.session.add(new_log)
        db.session.commit()
        return jsonify({"id": new_log.id, "checkpoint_id": new_log.checkpoint_id, "team_id": new_log.team_id, "race_id": race_id}), 201
    else:
        return jsonify({"message": "You are not authorized to log this visit."}), 403
    
@checkpoints_bp.route("/log/", methods=["DELETE"])
@jwt_required()
def unlog_visit(race_id):
    data = request.json

    # check if user is admin or member of the team
    user = User.query.filter_by(id=get_jwt_identity()).first_or_404()
    is_administrator = user.is_administrator

    race = Race.query.filter_by(id=race_id).first_or_404()
    is_signed_to_race =  data['team_id'] in [team.id for team in user.teams] and data['team_id'] in [team.id for team in race.teams]
    
    if is_administrator or is_signed_to_race:
        result = CheckpointLog.query.filter_by(checkpoint_id = data["checkpoint_id"], team_id = data["team_id"], race_id=race_id).delete()
        db.session.commit()
        if result:
            return jsonify({"message": "Log deleted successfully."}), 200
        else:
            return jsonify({"message": "Log not found."}), 404
    else:
        return jsonify({"message": "You are not authorized to delete this visit."}), 403