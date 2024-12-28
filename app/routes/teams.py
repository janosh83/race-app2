from flask import Blueprint, jsonify, request

from app import db
from app.models import Team, Race, User

team_bp = Blueprint("team", __name__)

# get all teams
@team_bp.route("/", methods=["GET"])
def get_teams():
    teams = Team.query.all()
    return jsonify([{"id": team.id, "name": team.name} for team in teams])

# get single team
@team_bp.route("/<int:team_id>/", methods=["GET"])
def get_team(team_id):
    team = Team.query.filter_by(id=team_id).first_or_404()
    return jsonify({"id": team.id, "name": team.name}), 200

# get teams by race
@team_bp.route("/race/<int:race_id>/", methods=["GET"])
def get_team_by_race(race_id):
    race = Race.query.filter_by(id=race_id).first_or_404()
    return jsonify([{"id": team.id, "name": team.name} for team in race.teams])

# sign up team for race
@team_bp.route("/race/<int:race_id>/", methods=["POST"])
def sign_up(race_id):
    data = request.json
    team = Team.query.filter_by(id=data["team_id"]).first_or_404()
    race = Race.query.filter_by(id=race_id).first_or_404()
    team.races.append(race)
    db.session.add(team)
    db.session.commit()
    return jsonify({"team_id": data["team_id"], "race_id": race_id}), 201

# TODO: get race by team

# add team
@team_bp.route('/', methods=['POST'])
def create_team():
    data = request.json
    new_team = Team(name=data['name'])
    db.session.add(new_team)
    db.session.commit()
    return jsonify({"id": new_team.id, "name": new_team.name}), 201

# add members to team
@team_bp.route("/<int:team_id>/members/", methods=["POST"])
def add_members(team_id):
    data = request.json
    team = Team.query.filter_by(id=team_id).first_or_404()
    for user_id in data['user_ids']:
        user = User.query.filter_by(id=user_id).first_or_404()
        team.members.append(user)
    db.session.commit()
    return jsonify({"team_id": team.id, "user_ids": data['user_ids']}), 201

# get members of team
@team_bp.route("/<int:team_id>/members/", methods=["GET"])
def get_members(team_id):
    team = Team.query.filter_by(id=team_id).first_or_404()
    return jsonify([{"id": user.id, "name": user.name} for user in team.members])