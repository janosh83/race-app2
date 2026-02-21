from datetime import datetime, timedelta
import logging
from flask import current_app
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, create_refresh_token, jwt_required, get_jwt_identity
from marshmallow import ValidationError
from app.models import User, Registration, Team, Race, RaceCategory, team_members
from app.routes.admin import admin_required
from app import db
from app.services.email_service import EmailService, generate_reset_token
from app.schemas import (
  AuthLoginSchema,
  AuthRegisterSchema,
  PasswordResetRequestSchema,
  PasswordResetSchema,
)

logger = logging.getLogger(__name__)

auth_bp = Blueprint('auth', __name__)

# tested by test_auth.py -> test_auth_login
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
              preferred_language:
                type: string
                enum: [en, cs, de]
                example: en
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
    data = request.get_json() or {}
    validated = AuthRegisterSchema().load(data)

    if User.query.filter_by(email=validated['email']).first():
        logger.error("Registration attempt for existing user: %s", validated['email'])
        return jsonify({"msg": "User already exists"}), 409

    user = User(
        name=validated.get('name', ''),
        email=validated['email'],
        is_administrator=validated.get('is_administrator', False),
        preferred_language=validated.get('preferred_language'),
    )
    user.set_password(validated['password'])
    db.session.add(user)
    db.session.commit()
    logger.info("New user registered: %s (ID: %s, admin: %s)", user.email, user.id, user.is_administrator)
    return jsonify({"msg": "User created successfully"}), 201

# tested by test_auth.py -> test_auth_login
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
    data = request.get_json() or {}
    validated = AuthLoginSchema().load(data)

    user = User.query.filter_by(email=validated['email']).first()
    if not user or not user.check_password(validated['password']):
        logger.error("Failed login attempt for email: %s", validated.get('email', 'unknown'))
        return jsonify({"msg": "Invalid credentials"}), 401

    if user.is_administrator:
        access_token = create_access_token(identity=str(user.id), additional_claims={"is_administrator": True})
    else:
        access_token = create_access_token(identity=str(user.id), additional_claims={"is_administrator": False})

    # Issue refresh token with longer lifetime for silent re-auth
    refresh_token = create_refresh_token(identity=str(user.id))

    logger.info("User logged in: %s (ID: %s, admin: %s)", user.email, user.id, user.is_administrator)

    # Fetch teams and races associated with the user
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
        .filter(team_members.c.user_id == user.id)
        .all()
    )

    registered_races = [{"race_id": race.race_id,
              "team_id": race.team_id,
              "race_name": race.race_name,
              "race_category": race.race_category,
              "race_description": race.race_description,
              "start_showing_checkpoints": race.start_showing_checkpoints_at,
              "end_showing_checkpoints": race.end_showing_checkpoints_at,
              "start_logging": race.start_logging_at,
              "end_logging": race.end_logging_at} for race in races_by_user]

    return jsonify({
      "access_token": access_token,
      "refresh_token": refresh_token,
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "is_administrator": user.is_administrator,
            "preferred_language": user.preferred_language,
        },
        "signed_races": registered_races
    }), 200


# tested by test_auth.py -> test_auth_protected
@auth_bp.route('/protected/', methods=['GET'])
@jwt_required()
def protected():
    """
    Protected endpoint, requires authentication (DEBUG/TEST only).
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
      404:
        description: Not found (production environment)
    """

    if not (current_app.config.get('DEBUG') or current_app.config.get('TESTING')):
        return jsonify({"error": "Not found"}), 404

    current_user_id = str(get_jwt_identity())
    return jsonify({"msg": f"Hello, user {current_user_id}!"}), 200

# tested by test_auth.py -> test_auth_admin_required
@auth_bp.route('/admin/', methods=['GET'])
@admin_required()
def admin():
    """
    Admin-only endpoint (DEBUG/TEST only).
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
      404:
        description: Not found (production environment)
    """
    if not (current_app.config.get('DEBUG') or current_app.config.get('TESTING')):
        return jsonify({"error": "Not found"}), 404

    current_user_id = str(get_jwt_identity())
    return jsonify({"msg": f"Hello, admin {current_user_id}!"}), 200

# Refresh access token using a valid refresh token
@auth_bp.route('/refresh/', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """
    Refresh the access token using a valid refresh token.
    ---
    tags:
      - Authentication
    security:
      - BearerAuth: []
    responses:
      200:
        description: Returns a new access token
        content:
          application/json:
            schema:
              type: object
              properties:
                access_token:
                  type: string
      401:
        description: Missing or invalid refresh token
    """
    user_id = get_jwt_identity()
    # Look up current admin flag to keep claims in sync

    user = User.query.filter_by(id=int(user_id)).first()
    is_admin = bool(user.is_administrator) if user else False
    new_access = create_access_token(identity=str(user_id), additional_claims={"is_administrator": is_admin})
    return jsonify({"access_token": new_access}), 200

@auth_bp.route('/request-password-reset/', methods=['POST'])
def request_password_reset():
    """
    Request a password reset email.
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
            required:
              - email
    responses:
      200:
        description: Password reset email sent (always returns 200 even if email doesn't exist for security)
        content:
          application/json:
            schema:
              type: object
              properties:
                msg:
                  type: string
                  example: If the email exists, a password reset link has been sent
      400:
        description: Missing email
        content:
          application/json:
            schema:
              type: object
              properties:
                msg:
                  type: string
                  example: Email is required
    """
    data = request.get_json() or {}
    try:
        validated = PasswordResetRequestSchema().load(data)
    except ValidationError:
        logger.error("Password reset request with missing email")
        return jsonify({"msg": "Email is required"}), 400

    email = validated['email']
    user = User.query.filter_by(email=email).first()

    # Always return success message for security (don't reveal if email exists)
    if user:
        # Generate reset token
        reset_token = generate_reset_token()
        expiry = datetime.now() + timedelta(hours=1)

        # Save token to user
        user.set_reset_token(reset_token, expiry)
        db.session.commit()

        # Send email with user's preferred language
        EmailService.send_password_reset_email(user.email, reset_token, language=user.preferred_language)
        logger.info("Password reset email sent to user: %s (ID: %s, language: %s)", user.email, user.id, user.preferred_language)
    else:
        logger.warning("Password reset requested for non-existent email: %s", email)

    return jsonify({"msg": "If the email exists, a password reset link has been sent"}), 200

@auth_bp.route('/reset-password/', methods=['POST'])
def reset_password():
    """
    Reset password using a valid token.
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
              token:
                type: string
                example: abc123def456
              new_password:
                type: string
                example: newSecurePassword123
            required:
              - token
              - new_password
    responses:
      200:
        description: Password reset successfully
        content:
          application/json:
            schema:
              type: object
              properties:
                msg:
                  type: string
                  example: Password reset successfully
      400:
        description: Missing token or password, or invalid/expired token
        content:
          application/json:
            schema:
              type: object
              properties:
                msg:
                  type: string
                  example: Token and new password are required
    """
    data = request.get_json() or {}
    try:
        validated = PasswordResetSchema().load(data)
    except ValidationError:
        logger.warning("Password reset attempt with missing token or password")
        return jsonify({"msg": "Token and new password are required"}), 400

    token = validated['token']
    new_password = validated['new_password']

    # Find user by token
    user = User.query.filter_by(reset_token=token).first()

    if not user or not user.reset_token_expiry:
        logger.warning("Password reset attempt with invalid token: %s...", token[:10])
        return jsonify({"msg": "Invalid or expired token"}), 400

    # Check if token is expired
    if datetime.now() > user.reset_token_expiry:
        user.clear_reset_token()
        db.session.commit()
        logger.warning("Password reset attempt with expired token for user: %s", user.email)
        return jsonify({"msg": "Token has expired"}), 400

    # Reset password
    user.set_password(new_password)
    user.clear_reset_token()
    db.session.commit()

    logger.info("Password successfully reset for user: %s (ID: %s)", user.email, user.id)
    return jsonify({"msg": "Password reset successfully"}), 200
