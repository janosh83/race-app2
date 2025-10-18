from functools import wraps

from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from app.models import User, Registration, Team, Race, RaceCategory, team_members
from app.routes.admin import admin_required
from app import db

auth_bp = Blueprint('auth', __name__)

# tested by test_users.py -> test_auth_login
@auth_bp.route('/register/', methods=['POST'])
def register():
    """
    Register a new user.
    ---
    tags:
      - Authentication
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              email:
                type: string
                example: user@example.com
              password:
                type: string
                example: mypassword
              name:
                type: string
                example: John Doe
              is_administrator:
                type: boolean
                example: false
            required:
              - email
              - password
    responses:
      201:
        description: User created successfully
        content:
          application/json:
            schema:
              type: object
              properties:
                msg:
                  type: string
                  example: User created successfully
      400:
        description: Missing email or password
        content:
          application/json:
            schema:
              type: object
              properties:
                msg:
                  type: string
                  example: Missing email or password
      409:
        description: User already exists
        content:
          application/json:
            schema:
              type: object
              properties:
                msg:
                  type: string
                  example: User already exists
    """
    data = request.get_json()
    if not data or 'email' not in data or 'password' not in data:
        return jsonify({"msg": "Missing email or password"}), 400

    if User.query.filter_by(email=data['email']).first():
        return jsonify({"msg": "User already exists"}), 409

    user = User(name=data.get('name', ''), email=data['email'], is_administrator=data.get('is_administrator', False))
    user.set_password(data['password'])
    db.session.add(user)
    db.session.commit()

    return jsonify({"msg": "User created successfully"}), 201

# tested by test_users.py -> test_auth_login
@auth_bp.route('/login/', methods=['POST'])
def login():
    """
    Log in a user and return an access token.
    ---
    tags:
      - Authentication
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              email:
                type: string
                example: user@example.com
              password:
                type: string
                example: mypassword
            required:
              - email
              - password
    responses:
      200:
        description: Access token returned successfully
        content:
          application/json:
            schema:
              type: object
              properties:
                access_token:
                  type: string
                  example: eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
                user:
                  type: object
                  properties:
                    id:
                      type: integer
                      example: 1
                    name:
                      type: string
                      example: John Doe
                    email:
                      type: string
                      example: user@example.com
                    is_administrator:
                      type: boolean
                      example: false
                signed_races:
                  type: array
                  items:
                    type: object
                    properties:
                      race_id:
                        type: integer
                        example: 1
                      team_id:
                        type: integer
                        example: 2
                      name:
                        type: string
                        example: "Race Name"
                      description:
                        type: string
                        example: "Race description"
      400:
        description: Missing email or password
        content:
          application/json:
            schema:
              type: object
              properties:
                msg:
                  type: string
                  example: Missing email or password
      401:
        description: Invalid credentials
        content:
          application/json:
            schema:
              type: object
              properties:
                msg:
                  type: string
                  example: Invalid credentials
    """
    data = request.get_json()
    if not data or 'email' not in data or 'password' not in data:
        return jsonify({"msg": "Missing email or password"}), 400

    user = User.query.filter_by(email=data['email']).first()
    if not user or not user.check_password(data['password']):
        return jsonify({"msg": "Invalid credentials"}), 401

    if user.is_administrator:
        access_token = create_access_token(identity=str(user.id), additional_claims={"is_administrator": True})
    else:
        access_token = create_access_token(identity=str(user.id), additional_claims={"is_administrator": False})
    
    # Fetch teams and races associated with the user   
    races_by_user = (
        db.session.query(Registration,
            Race.id.label("race_id"), 
            Team.id.label("team_id"), 
            Race.name.label("race_name"), 
            Race.description.label("race_description"),
            RaceCategory.name.label("race_category"))
        .join(Race, Registration.race_id == Race.id)
        .join(Team, Registration.team_id == Team.id)
        .join(RaceCategory, Registration.race_category == RaceCategory.id)
        .join(team_members, team_members.c.team_id == Team.id)
        .filter(team_members.c.user_id == user.id)
        .all()
    )

    registered_races = [{"race_id": race.race_id, 
              "team_id": race.team_id, 
              "race_name": race.race_name, 
              "race_category": race.race_category,
              "race_description": race.race_description} for race in races_by_user]

    return jsonify({
        "access_token": access_token,
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "is_administrator": user.is_administrator,
        },
        "signed_races": registered_races
    }), 200

# tested by test_users.py -> test_auth_protected
@auth_bp.route('/protected/', methods=['GET'])
@jwt_required()
def protected():
    """
    Protected endpoint, requires authentication.
    ---
    tags:
      - Authentication
    security:
      - BearerAuth: []
    responses:
      200:
        description: Returns a hello message for the authenticated user
        content:
          application/json:
            schema:
              type: object
              properties:
                msg:
                  type: string
                  example: Hello, user 1!
    """
    current_user_id = str(get_jwt_identity())
    return jsonify({"msg": f"Hello, user {current_user_id}!"}), 200

# tested by test_users.py -> test_auth_admin_required
@auth_bp.route('/admin/', methods=['GET'])
@admin_required()
def admin():
    """
    Admin-only endpoint.
    ---
    tags:
      - Authentication
    security:
      - BearerAuth: []
    responses:
      200:
        description: Returns a hello message for the admin user
        content:
          application/json:
            schema:
              type: object
              properties:
                msg:
                  type: string
                  example: Hello, admin 1!
    """
    current_user_id = str(get_jwt_identity())
    return jsonify({"msg": f"Hello, admin {current_user_id}!"}), 200