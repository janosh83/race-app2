from flask import Blueprint, jsonify, request
from app import db
from app.models import User
from app.routes.admin import admin_required

admin_user_bp = Blueprint("admin_user", __name__)


@admin_user_bp.route("/", methods=["GET"])
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
@admin_user_bp.route("/", methods=["POST"])
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


@admin_user_bp.route("/<int:user_id>/", methods=["PUT"])
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


@admin_user_bp.route("/<int:user_id>/", methods=["DELETE"])
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
