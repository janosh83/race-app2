from functools import wraps

from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from app.models import User
from app.routes.admin import admin_required
from app import db

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register/', methods=['POST'])
def register():
    """
    Register a new user.
    ---
    responses:
      201:
        description: User created successfully
      400:
        description: Missing email or password
      409:
        description: User already exists
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

@auth_bp.route('/login/', methods=['POST'])
def login():
    """
    Log in a user and return an access token.
    ---
    responses:
      200:
        description: Access token returned successfully
      400:
        description: Missing email or password
      401:
        description: Invalid credentials
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
    return jsonify({"access_token": access_token}), 200


@auth_bp.route('/protected/', methods=['GET'])
@jwt_required()
def protected():
    current_user_id = str(get_jwt_identity())
    return jsonify({"msg": f"Hello, user {current_user_id}!"}), 200

@auth_bp.route('/admin/', methods=['GET'])
@admin_required()
def admin():
    current_user_id = str(get_jwt_identity())
    return jsonify({"msg": f"Hello, admin {current_user_id}!"}), 200