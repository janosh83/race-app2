from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models import Registration, Team, Race, RaceCategory, User, team_members
from app.routes.admin import admin_required
from app import db

user_bp = Blueprint('user', __name__)

@user_bp.route("/", methods=["GET"])
@admin_required()
def get_users():
    """
    Get all users (admin only).
    ---
    tags:
      - Admin Users
    security:
      - bearerAuth: []
    responses:
      200:
        description: A list of all users
        content:
          application/json:
            schema:
              type: array
              items:
                $ref: '#/components/schemas/UserObject'
      401:
        description: Unauthorized
      403:
        description: Forbidden - admin access required
    """
    users = User.query.all()
    return jsonify([{
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "is_administrator": user.is_administrator
    } for user in users])

# duplicate of auth/register which needs to be removed in future
@user_bp.route("/", methods=["POST"])
@admin_required()
def create_user():
    """
    Create a new user (admin only).
    ---
    tags:
      - Admin Users
    security:
      - bearerAuth: []
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              name:
                type: string
                description: The name of the user
              email:
                type: string
                description: The email of the user
              password:
                type: string
                description: The password of the user
              is_administrator:
                type: boolean
                description: Whether the user is an administrator
                default: false
            required:
              - email
              - password
    responses:
      201:
        description: User created successfully
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UserObject'
      400:
        description: Missing required fields or invalid data
      409:
        description: User with this email already exists
      401:
        description: Unauthorized
      403:
        description: Forbidden - admin access required
    """
    data = request.get_json()
    
    if not data or 'email' not in data or 'password' not in data:
        return jsonify({"msg": "Missing email or password"}), 400

    if User.query.filter_by(email=data['email']).first():
        return jsonify({"msg": "User with this email already exists"}), 409

    user = User(
        name=data.get('name', ''),
        email=data['email'],
        is_administrator=data.get('is_administrator', False)
    )
    user.set_password(data['password'])
    
    db.session.add(user)
    db.session.commit()

    return jsonify({
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "is_administrator": user.is_administrator
    }), 201


@user_bp.route("/<int:user_id>/", methods=["PUT"])
@admin_required()
def update_user(user_id):
    """
    Update a user (admin only).
    ---
    tags:
      - Admin Users
    security:
      - bearerAuth: []
    parameters:
      - in: path
        name: user_id
        schema:
          type: integer
        required: true
        description: ID of the user
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              name:
                type: string
                description: The name of the user
              email:
                type: string
                description: The email of the user
              password:
                type: string
                description: The new password (optional)
              is_administrator:
                type: boolean
                description: Whether the user is an administrator
    responses:
      200:
        description: User updated successfully
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UserObject'
      404:
        description: User not found
      409:
        description: Email already taken by another user
      401:
        description: Unauthorized
      403:
        description: Forbidden - admin access required
    """
    user = User.query.filter_by(id=user_id).first_or_404()
    data = request.get_json()

    if 'name' in data:
        user.name = data['name']
    
    if 'email' in data and data['email'] != user.email:
        # Check if email is already taken
        existing = User.query.filter_by(email=data['email']).first()
        if existing:
            return jsonify({"msg": "Email already taken"}), 409
        user.email = data['email']
    
    if 'password' in data and data['password']:
        user.set_password(data['password'])
    
    if 'is_administrator' in data:
        user.is_administrator = data['is_administrator']

    db.session.commit()

    return jsonify({
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "is_administrator": user.is_administrator
    }), 200


@user_bp.route("/<int:user_id>/", methods=["DELETE"])
@admin_required()
def delete_user(user_id):
    """
    Delete a user (admin only).
    ---
    tags:
      - Admin Users
    security:
      - bearerAuth: []
    parameters:
      - in: path
        name: user_id
        schema:
          type: integer
        required: true
        description: ID of the user to delete
    responses:
      200:
        description: User deleted successfully
        content:
          application/json:
            schema:
              type: object
              properties:
                msg:
                  type: string
                  example: User deleted successfully
      404:
        description: User not found
      401:
        description: Unauthorized
      403:
        description: Forbidden - admin access required
    """
    user = User.query.filter_by(id=user_id).first_or_404()
    
    db.session.delete(user)
    db.session.commit()

    return jsonify({"msg": "User deleted successfully"}), 200


@user_bp.route('/signed-races/', methods=['GET'])
@jwt_required()
def get_signed_races():
    """
    Get the list of races the current user is signed to, with timing info.
    ---
    tags:
      - User
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
                    properties:
                      race_id:
                        type: integer
                        description: The ID of the race
                      team_id:
                        type: integer
                        description: The ID of the user's team
                      race_name:
                        type: string
                        description: The name of the race
                      race_category:
                        type: string
                        description: The category the team is signed up for
                      race_description:
                        type: string
                        description: The description of the race
                      start_showing_checkpoints:
                        type: string
                        format: date-time
                        description: When to start showing checkpoints on the map
                      end_showing_checkpoints:
                        type: string
                        format: date-time
                        description: When to stop showing checkpoints on the map
                      start_logging:
                        type: string
                        format: date-time
                        description: When to start accepting checkpoint/task logs
                      end_logging:
                        type: string
                        format: date-time
                        description: When to stop accepting checkpoint/task logs
      401:
        description: Missing or invalid authentication token
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