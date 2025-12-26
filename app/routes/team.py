from flask import Blueprint, jsonify, request

from app import db
from app.models import Team, Race, User, Registration, RaceCategory
from app.routes.admin import admin_required

team_bp = Blueprint("team", __name__)

# get all teams
# tested by test_teams.py -> test_get_teams
# for now it can stay open, but in the future it should be somehow protected
@team_bp.route("/", methods=["GET"])
def get_teams():
    """
    Get all teams.
    ---
    tags:
      - Teams
    responses:
      200:
        description: A list of all teams
        content:
          application/json:
            schema:
              type: array
              items:
                $ref: '#/components/schemas/TeamObject'
    """
    teams = Team.query.all()
    return jsonify([{"id": team.id, "name": team.name} for team in teams])

# get single team
# tested by test_teams.py -> test_get_single_team
# for now it can stay open, but in the future it should be somehow protected
@team_bp.route("/<int:team_id>/", methods=["GET"])
def get_team(team_id):
    """
    Get a single team.
    ---
    tags:
      - Teams
    parameters:
      - in: path
        name: team_id
        schema:
          type: integer
        required: true
        description: ID of the team
    responses:
      200:
        description: Details of a specific team.
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/TeamObject'
      404:
        description: Team not found
    """
    team = Team.query.filter_by(id=team_id).first_or_404()
    return jsonify({"id": team.id, "name": team.name}), 200

# get teams by race
# tested by test_teams.py -> test_team_signup
# for now it can stay open, but in the future it should be somehow protected
@team_bp.route("/race/<int:race_id>/", methods=["GET"])
def get_team_by_race(race_id):
    """
    Get all teams participating in a specific race with their members.
    ---
    tags:
      - Teams
    parameters:
      - in: path
        name: race_id
        schema:
          type: integer
        required: true
        description: ID of the race
    responses:
      200:
        description: A list of teams with members
        content:
          application/json:
            schema:
              type: array
              items:
                type: object
                properties:
                  id:
                    type: integer
                    description: The team ID
                  name:
                    type: string
                    description: The name of the team
                  race_category:
                    type: string
                    description: The race category name
                  members:
                    type: array
                    description: List of team members
                    items:
                      type: object
                      properties:
                        id:
                          type: integer
                          description: The user ID
                        name:
                          type: string
                          description: The user's name
                        email:
                          type: string
                          description: The user's email
      404:
        description: Race not found
    """

    registrations = (
        db.session.query(Team.id, Team.name, RaceCategory.name.label("race_category"))
        .join(Registration, Registration.team_id == Team.id)
        .join(RaceCategory, Registration.race_category_id == RaceCategory.id)
        .filter(Registration.race_id == race_id)
        .all()
    )

    if not registrations:
        return jsonify({"message": "No teams found for this race"}), 404

    return jsonify([
        {"id": team_id, "name": team_name, "race_category": category_name}
        for team_id, team_name, category_name in registrations
    ]), 200

# sign up team for race
# tested by test_teams.py -> test_team_signup
# for now it can stay open, but in the future it should be somehow protected
@team_bp.route("/race/<int:race_id>/", methods=["POST"])
def sign_up(race_id):
    """
    Sign up a team for a specific race.
    ---
    tags:
      - Teams
    parameters:
      - in: path
        name: race_id
        schema:
          type: integer
        required: true
        description: ID of the race
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              team_id:
                type: integer
                description: The ID of the team to sign up
    responses:
      201:
        description: Team signed
        content:
          application/json:
            schema:
              type: object
              properties:
                team_id:
                  type: integer
                  description: The ID of the team
                race_id:
                  type: integer
                  description: The ID of the race
      404:
        description: Team or Race not found
    """
    data = request.json
    
    team = Team.query.filter_by(id=data["team_id"]).first_or_404()
    race = Race.query.filter_by(id=race_id).first_or_404()
    race_category = RaceCategory.query.filter_by(id=data["race_category_id"]).first_or_404()

    if race_category in race.categories:
        
      registration = Registration(race_id=race.id, team_id=team.id, race_category_id=data["race_category_id"])
      db.session.add(registration)
      db.session.commit()
      return jsonify({"team_id": data["team_id"], "race_id": race_id, "race_category": race_category.name}), 201
    
    else:
        return jsonify({"message": "Category not available for the race"}), 400

# TODO: get race by team

# create team
# tested by test_teams.py -> test_add_team
# for now it can stay open, but in the future it should be somehow protected
@team_bp.route('/', methods=['POST'])
def create_team():
    """
    Create a new team.
    ---
    tags:
      - Teams
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              name:
                type: string
                description: The name of the team
    responses:
      201:
        description: Team created successfully
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/TeamObject'
    """
    data = request.json
    new_team = Team(name=data['name'])
    db.session.add(new_team)
    db.session.commit()
    return jsonify({"id": new_team.id, "name": new_team.name}), 201

# add members to team
# tested by test_teams.py -> test_add_members
# for now it can stay open, but in the future it should be somehow protected
@team_bp.route("/<int:team_id>/members/", methods=["POST"])
def add_members(team_id):
    """
    Add members to a team.
    ---
    tags:
      - Teams
    parameters:
      - in: path
        name: team_id
        schema:
          type: integer
        required: true
        description: ID of the team
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              user_ids:
                type: array
                items:
                  type: integer
                description: List of user IDs to add to the team
    responses:
      201:
        description: Members added successfully
        content:
          application/json:
            schema:
              type: object
              properties:
                team_id:
                  type: integer
                  description: The ID of the team
                user_ids:
                  type: array
                  items:
                    type: integer
                  description: List of user IDs added to the team
      404:
        description: Team or User not found
    """
    data = request.json
    team = Team.query.filter_by(id=team_id).first_or_404()
    for user_id in data['user_ids']:
        user = User.query.filter_by(id=user_id).first_or_404()
        team.members.append(user)
    db.session.commit()
    return jsonify({"team_id": team.id, "user_ids": data['user_ids']}), 201

# get members of team
# tested by test_teams.py -> test_add_members
# for now it can stay open, but in the future it should be somehow protected
@team_bp.route("/<int:team_id>/members/", methods=["GET"])
def get_members(team_id):
    """
    Get members of a team.
    ---
    tags:
      - Teams
    parameters:
      - in: path
        name: team_id
        schema:
          type: integer
        required: true
        description: ID of the team
    responses:
      200:
        description: A list of team members
        content:
          application/json:
            schema:
              type: array
              items:
                $ref: '#/components/schemas/UserObject'
      404:
        description: Team not found
    """
    team = Team.query.filter_by(id=team_id).first_or_404()
    return jsonify([{"id": user.id, "name": user.name} for user in team.members])


@team_bp.route("/<int:team_id>/members/", methods=["DELETE"])
@admin_required()
def remove_all_members(team_id):
    """
    Remove all members from a team.
    ---
    tags:
      - Teams
    parameters:
      - in: path
        name: team_id
        schema:
          type: integer
        required: true
        description: ID of the team
    responses:
      200:
        description: All members removed successfully
      404:
        description: Team not found
    """
    team = Team.query.filter_by(id=team_id).first_or_404()
    team.members.clear()
    db.session.commit()
    return jsonify({"message": "All members removed successfully"}), 200


@team_bp.route("/<int:team_id>/", methods=["DELETE"])
@admin_required()
def delete_team(team_id):
    """
    Delete a team.
    ---
    tags:
      - Teams
    parameters:
      - in: path
        name: team_id
        schema:
          type: integer
        required: true
        description: ID of the team
    responses:
      200:
        description: Team deleted successfully
      400:
        description: Cannot delete the team, it has members associated with it.
      404:
        description: Team not found
    """
    team = Team.query.filter_by(id=team_id).first_or_404()
    if team.members:
        return jsonify({"message": "Cannot delete the team, it has members associated with it."}), 400
    db.session.delete(team)
    db.session.commit()
    return jsonify({"message": "Team deleted successfully"}), 200   