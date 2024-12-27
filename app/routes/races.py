from flask import Blueprint, jsonify, request

from app import db
from app.models import Race
from app.routes.checkpoints import checkpoints_bp

race_bp = Blueprint("race", __name__)
race_bp.register_blueprint(checkpoints_bp, url_prefix='/<int:race_id>/checkpoints')

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
def create_race():
    data = request.json
    new_race = Race(name=data['name'], description=data['description'])
    db.session.add(new_race)
    db.session.commit()
    return jsonify({"id": new_race.id, "name": new_race.name, "description": new_race.description}), 201