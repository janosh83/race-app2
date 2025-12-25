from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models import Registration, Team, Race, RaceCategory, team_members
from app import db

user_bp = Blueprint('user', __name__)

@user_bp.route('/signed-races/', methods=['GET'])
@jwt_required()
def get_signed_races():
    """
    Get the list of races the current user is signed to, with timing info.
    ---
    tags:
      - Authentication
    security:
      - BearerAuth: []
    responses:
      200:
        description: Returns the current user's signed races
        content:
          application/json:
            schema:
              type: object
              properties:
                signed_races:
                  type: array
                  items:
                    type: object
    """
    current_user_id = str(get_jwt_identity())

    races_by_user = (
        db.session.query(Registration,
            Race.id.label("race_id"), 
            Team.id.label("team_id"), 
            Race.name.label("race_name"), 
            Race.description.label("race_description"),
            RaceCategory.name.label("race_category"),
            Race.start_showing_checkpoints_at,
            Race.end_showing_checkpoints_at,
            Race.start_logging_at,
            Race.end_logging_at)
        .join(Race, Registration.race_id == Race.id)
        .join(Team, Registration.team_id == Team.id)
        .join(RaceCategory, Registration.race_category_id == RaceCategory.id)
        .join(team_members, team_members.c.team_id == Team.id)
        .filter(team_members.c.user_id == int(current_user_id))
        .all()
    )

    registered_races = [{
        "race_id": race.race_id,
        "team_id": race.team_id,
        "race_name": race.race_name,
        "race_category": race.race_category,
        "race_description": race.race_description,
        "start_showing_checkpoints": race.start_showing_checkpoints_at,
        "end_showing_checkpoints": race.end_showing_checkpoints_at,
        "start_logging": race.start_logging_at,
        "end_logging": race.end_logging_at
    } for race in races_by_user]

    return jsonify({"signed_races": registered_races}), 200