import logging
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from marshmallow import ValidationError
from sqlalchemy.exc import IntegrityError
from sqlalchemy import or_
from app.models import RegistrationEmailLog, User
from app.routes.admin import admin_required
from app import db
from app.schemas import PaginationQuerySchema, UserCreateSchema, UserUpdateSchema
from app.services.signed_races import signed_races_for_user
from app.utils import current_user_id, normalize_email

logger = logging.getLogger(__name__)

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
    query = User.query.order_by(db.func.lower(User.name).asc(), User.email.asc(), User.id.asc())
    paginate_requested = 'page' in request.args or 'per_page' in request.args
    search_term = (request.args.get('search') or '').strip()

    if search_term:
        like_term = f"%{search_term}%"
        query = query.filter(or_(User.name.ilike(like_term), User.email.ilike(like_term)))

    if paginate_requested:
        try:
            paging = PaginationQuerySchema().load(request.args.to_dict())
        except ValidationError as err:
            return jsonify({"errors": err.messages}), 400

        page = paging['page']
        per_page = paging['per_page']

        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        data = [{
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "is_administrator": user.is_administrator,
            "preferred_language": user.preferred_language
        } for user in pagination.items]

        return jsonify({
            "data": data,
            "meta": {
                "page": page,
                "per_page": per_page,
                "total": pagination.total,
                "total_pages": pagination.pages,
                "has_next": pagination.has_next,
                "has_prev": pagination.has_prev,
            }
        })

    users = query.all()
    return jsonify([{
      "id": user.id,
      "name": user.name,
      "email": user.email,
      "is_administrator": user.is_administrator,
      "preferred_language": user.preferred_language
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
              preferred_language:
                type: string
                description: User's preferred language (en/cs/de)
                enum: [en, cs, de]
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
    payload = request.get_json(silent=True) or {}
    data = UserCreateSchema().load(payload)
    normalized_email = normalize_email(data['email'])

    if User.query.filter_by(email=normalized_email).first():
        logger.warning("Admin user creation attempt for existing email: %s", normalized_email)
        return jsonify({"msg": "User with this email already exists"}), 409

    user = User(
        name=data.get('name', ''),
        email=normalized_email,
        is_administrator=data.get('is_administrator', False),
        preferred_language=data.get('preferred_language')
    )
    user.set_password(data['password'])

    db.session.add(user)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        logger.warning("Admin user creation hit unique-email conflict: %s", data['email'])
        return jsonify({"msg": "User with this email already exists"}), 409

    logger.info("Admin created user: %s (ID: %s, admin: %s)", user.email, user.id, user.is_administrator)
    return jsonify({
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "is_administrator": user.is_administrator,
        "preferred_language": user.preferred_language
    }), 201


@user_bp.route("/<int:user_id>/", methods=["PUT"])
@jwt_required()
def update_user(user_id):
    """
    Update a user (self or admin).
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
    current_user_id = int(get_jwt_identity())
    current_user = User.query.filter_by(id=current_user_id).first()
    if not current_user:
        return jsonify({"msg": "User not found"}), 404

    is_admin = bool(current_user.is_administrator)
    if not is_admin and user_id != current_user_id:
        return jsonify({"msg": "Forbidden"}), 403

    user = User.query.filter_by(id=user_id).first_or_404()
    payload = request.get_json(silent=True) or {}
    data = UserUpdateSchema().load(payload, partial=True)

    if 'email' in data:
        data['email'] = normalize_email(data['email'])

    updated_fields = []
    if 'name' in data:
        user.name = data['name']
        updated_fields.append('name')

    if 'email' in data and data['email'] != user.email:
        # Check if email is already taken
        existing = User.query.filter_by(email=data['email']).first()
        if existing:
            logger.warning("User %s update failed: email %s already taken", user_id, data['email'])
            return jsonify({"msg": "Email already taken"}), 409
        user.email = data['email']
        updated_fields.append('email')

    if 'password' in data and data['password']:
        user.set_password(data['password'])
        user.revoke_refresh_sessions()
        updated_fields.append('password')

    if 'is_administrator' in data:
        if not is_admin:
            return jsonify({"msg": "Forbidden"}), 403
        user.is_administrator = data['is_administrator']
        updated_fields.append('is_administrator')

    if 'preferred_language' in data:
        user.preferred_language = data['preferred_language']
        updated_fields.append('preferred_language')

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        logger.warning("User %s update hit unique-email conflict", user_id)
        return jsonify({"msg": "Email already taken"}), 409

    logger.info("User %s updated by admin - fields: %s", user_id, ', '.join(updated_fields))
    return jsonify({
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "is_administrator": user.is_administrator,
        "preferred_language": user.preferred_language
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
      400:
        description: An admin can't delete their own account (code cannot_delete_self).
      404:
        description: User not found
      401:
        description: Unauthorized
      403:
        description: Forbidden - admin access required
    """
    user = User.query.filter_by(id=user_id).first_or_404()
    if user.id == current_user_id():
        return jsonify({"msg": "You can't delete your own account here.", "code": "cannot_delete_self"}), 400
    user_email = user.email

    # Registration email logs keep the address they were sent to.
    RegistrationEmailLog.query.filter_by(user_id=user.id).update({"user_id": None})
    db.session.delete(user)
    db.session.commit()

    logger.info("User %s (%s) deleted by admin", user_id, user_email)
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
                      team_name:
                        type: string
                        description: The name of the user's team
                      team_members:
                        type: array
                        description: Members of the team (id and name)
                        items:
                          type: object
                          properties:
                            id:
                              type: integer
                            name:
                              type: string
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
    return jsonify({"signed_races": signed_races_for_user(current_user_id())}), 200
