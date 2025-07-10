from flask import Blueprint, jsonify, request

from app import db
from app.models import Race, CheckpointLog, User
from app.routes.checkpoints import checkpoints_bp
from app.routes.admin import admin_required
from flask_jwt_extended import jwt_required, get_jwt_identity

race_bp = Blueprint("race", __name__)
race_bp.register_blueprint(checkpoints_bp, url_prefix='/<int:race_id>/checkpoints')

#
# Manage races
#

# get all races
@race_bp.route("/", methods=["GET"])
def get_races():
    races = Race.query.all()
    return jsonify([{"id": race.id, "name": race.name, "description": race.description} for race in races])

# get single race
@race_bp.route("/<int:race_id>/", methods=["GET"])
def get_race(race_id):
    race = Race.query.filter_by(id=race_id).first_or_404()
    return jsonify({"id": race.id, "name": race.name, "description": race.description}), 200

# add race
@race_bp.route('/', methods=['POST'])
@admin_required()
def create_race():
    data = request.json
    new_race = Race(name=data['name'], description=data['description'])
    db.session.add(new_race)
    db.session.commit()
    return jsonify({"id": new_race.id, "name": new_race.name, "description": new_race.description}), 201

#
# Get visits
#

@race_bp.route("/<int:race_id>/visits/<int:team_id>/", methods=["GET"])
@jwt_required()
def get_visits_by_race_and_team(race_id, team_id):

    # check if user is admin or member of the team
    user = User.query.filter_by(id=get_jwt_identity()).first_or_404()
    if not user.is_administrator and team_id not in [team.id for team in user.teams]:
        return 403

    visits = CheckpointLog.query.filter_by(race_id=race_id, team_id=team_id).all()
    return jsonify([{"checkpoint_id": visit.checkpoint_id, "team_id": visit.team_id, "created_at": visit.created_at} for visit in visits])

@race_bp.route("/<int:race_id>/visits/", methods=["GET"])
@admin_required()
def get_visits_by_race(race_id):
    visits = CheckpointLog.query.filter_by(race_id=race_id).all()
    return jsonify([{"checkpoint_id": visit.checkpoint_id, "team_id": visit.team_id, "created_at": visit.created_at} for visit in visits])

@race_bp.route("/<int:race_id>/checkpoints/<int:team_id>/status/", methods=["GET"])
@jwt_required()
def get_checkpoints_with_status(race_id, team_id):
    # Check if the user is authorized to view this team's data
    user = User.query.filter_by(id=get_jwt_identity()).first_or_404()
    if not user.is_administrator and team_id not in [team.id for team in user.teams]:
        return jsonify({"msg": "Unauthorized"}), 403

    # Get all checkpoints for the race
    race = Race.query.filter_by(id=race_id).first_or_404()
    checkpoints = race.checkpoints

    # Get all visits for the race and team
    visits = CheckpointLog.query.filter_by(race_id=race_id, team_id=team_id).all()
    visited_checkpoint_ids = {visit.checkpoint_id for visit in visits}

    # Build the response
    response = []
    for checkpoint in checkpoints:
        response.append({
            "id": checkpoint.id,
            "title": checkpoint.title,
            "description": checkpoint.description,
            "latitude": checkpoint.latitude,
            "longitude": checkpoint.longitude,
            "visited": checkpoint.id in visited_checkpoint_ids
        })

    return jsonify(response), 200


# TODO: compute results
