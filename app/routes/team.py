import logging
import secrets
from datetime import datetime, timedelta
from flask import Blueprint, jsonify, request
from marshmallow import ValidationError
from sqlalchemy.orm import joinedload, selectinload
from sqlalchemy.exc import IntegrityError

from app import db
from app.models import Team, Race, User, Registration, RaceCategory, RegistrationEmailLog
from app.routes.admin import admin_required
from app.schemas import (
  RegistrationEmailLogQuerySchema,
  RetryFailedEmailsSchema,
  TeamAddMembersSchema,
  TeamCreateSchema,
  TeamDisqualifySchema,
  TeamSignUpSchema,
)
from app.services.email_service import EmailService, generate_reset_token
from app.services.email_tracking_service import add_registration_email_log, normalize_email_send_result
from app.utils import (
  registration_mode as _registration_mode,
  resolve_race_category_name as _resolve_race_category_name,
  resolve_race_greeting as _resolve_race_greeting,
  resolve_race_name as _resolve_race_name,
)

logger = logging.getLogger(__name__)

team_bp = Blueprint("team", __name__)


def _registration_members_all_sent(registration):
    if not registration or not registration.team or not registration.team.members:
        return False

    for member in registration.team.members:
        has_sent_log = RegistrationEmailLog.query.filter_by(
            registration_id=registration.id,
            user_id=member.id,
            template_type='registration_confirmation',
            status='sent',
        ).first()
        if not has_sent_log:
            return False
    return True


def _retry_single_registration_email_log(failed_log, race):
    registration = Registration.query.filter_by(id=failed_log.registration_id).first()
    if not registration or not registration.team:
        return {'status': 'skipped', 'reason': 'missing_registration_or_team'}

    member = next((m for m in registration.team.members if m.id == failed_log.user_id), None)
    if not member:
        return {'status': 'skipped', 'reason': 'missing_member'}

    category = RaceCategory.query.filter_by(id=registration.race_category_id).first()
    try:
        reset_token = generate_reset_token()
        member.set_reset_token(reset_token, datetime.now() + timedelta(days=7))
        send_result = EmailService.send_registration_confirmation_email(
            user_email=member.email,
            user_name=member.name or member.email,
            race_name=_resolve_race_name(race, member.preferred_language),
            team_name=registration.team.name,
            race_category=_resolve_race_category_name(category, race, member.preferred_language),
            reset_token=reset_token,
            language=member.preferred_language,
            race_greeting=_resolve_race_greeting(race, member.preferred_language),
            return_result=True,
        )
    except (OSError, ValueError, TypeError) as exc:
        send_result = {
            'success': False,
            'error': str(exc),
            'provider': 'smtp',
            'provider_message_id': None,
        }

    add_registration_email_log(
        registration,
        member.id if member else None,
        member.email if member else '',
        'registration_confirmation',
        send_result,
    )

    normalized = normalize_email_send_result(send_result)
    registration.email_sent = _registration_members_all_sent(registration)
    return {
        'status': 'sent' if normalized['success'] else 'failed',
        'registration': registration,
    }

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
@admin_required()
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

    race = Race.query.filter_by(id=race_id).first()
    mode = _registration_mode(race)

    registrations = (
        Registration.query
        .options(
            joinedload(Registration.team).selectinload(Team.members),
            selectinload(Registration.payment_attempts),
        )
        .filter(Registration.race_id == race_id)
        .all()
    )

    category_ids = [registration.race_category_id for registration in registrations]
    categories = (
        RaceCategory.query
        .filter(RaceCategory.id.in_(category_ids))
        .all()
        if category_ids
        else []
    )
    category_name_by_id = {category.id: category.name for category in categories}

    results = []
    for registration in registrations:
        team = registration.team
        team_id = team.id if team else registration.team_id
        team_name = team.name if team else ""
        category_name = category_name_by_id.get(registration.race_category_id, "")
        payment_attempts = registration.payment_attempts or []
        driver_paid = any(a.status == 'confirmed' and a.payment_type == 'driver' for a in payment_attempts)
        codriver_paid = any(a.status == 'confirmed' and a.payment_type == 'codriver' for a in payment_attempts)
        team_paid = any(a.status == 'confirmed' and a.payment_type == 'team' for a in payment_attempts)

        aggregate_paid = bool(team_paid or registration.payment_confirmed) if mode == 'team' else bool(driver_paid or registration.payment_confirmed)

        members = []
        if team and team.members:
            members = [
                {"id": user.id, "name": user.name, "email": user.email}
                for user in team.members
            ]
        results.append({
            "id": team_id,
            "name": team_name,
            "race_category": category_name,
            "members": members,
            "email_sent": registration.email_sent,
            "disqualified": bool(registration.disqualified),
            "payment_confirmed": aggregate_paid,
            "payment_confirmed_at": registration.payment_confirmed_at.isoformat() if registration.payment_confirmed_at else None,
            "payment_details": {
                "mode": mode,
                "driver_paid": bool(driver_paid),
                "codriver_paid": bool(codriver_paid),
                "team_paid": bool(team_paid),
                "attempts": [
                {
                  "id": attempt.id,
                  "stripe_session_id": attempt.stripe_session_id,
                  "payment_type": attempt.payment_type,
                  "status": attempt.status,
                  "amount_cents": attempt.amount_cents,
                  "currency": attempt.currency,
                  "created_at": attempt.created_at.isoformat() if attempt.created_at else None,
                  "confirmed_at": attempt.confirmed_at.isoformat() if attempt.confirmed_at else None,
                }
                for attempt in sorted(
                  payment_attempts,
                  key=lambda attempt: (attempt.created_at, attempt.id),
                  reverse=True,
                )
                ],
            },
        })

    return jsonify(results), 200

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
      400:
        description: Selected race category is not available for this race
        content:
          application/json:
            schema:
              type: object
              properties:
                message:
                  type: string
                  example: Category not available for the race
      409:
        description: Team is already registered for this race
        content:
          application/json:
            schema:
              type: object
              properties:
                message:
                  type: string
                  example: Team is already registered for this race
      404:
        description: Team or Race not found
    """
    data = request.get_json() or {}
    validated = TeamSignUpSchema().load(data)

    team = Team.query.filter_by(id=validated['team_id']).first_or_404()
    race = Race.query.filter_by(id=race_id).first_or_404()
    race_category = RaceCategory.query.filter_by(id=validated['race_category_id']).first_or_404()

    existing_registration = Registration.query.filter_by(race_id=race.id, team_id=team.id).first()
    if existing_registration:
        logger.info(
            "Duplicate team registration ignored for race %s team %s",
            race.id,
            team.id,
        )
        return jsonify({"message": "Team is already registered for this race"}), 409

    if race_category in race.categories:
        registration = Registration(race_id=race.id, team_id=team.id, race_category_id=validated['race_category_id'])
        db.session.add(registration)
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            logger.info(
                "Team registration commit conflict treated as duplicate for race %s team %s",
                race.id,
                team.id,
            )
            return jsonify({"message": "Team is already registered for this race"}), 409

        logger.info("Team %s (%s) registered for race %s in category %s", team.id, team.name, race_id, race_category.name)
        return jsonify({"team_id": validated['team_id'], "race_id": race_id, "race_category": race_category.name}), 201
    else:
        logger.error("Team %s attempted to register for unavailable category %s in race %s", team.id, race_category.id, race_id)
        return jsonify({"message": "Category not available for the race"}), 400

# delete registration (unregister team from race)
@team_bp.route("/race/<int:race_id>/team/<int:team_id>/", methods=["DELETE"])
@admin_required()
def delete_registration(race_id, team_id):
    """
    Delete a registration (unregister a team from a race) - admin only.
    ---
    tags:
      - Teams
    security:
      - bearerAuth: []
    parameters:
      - in: path
        name: race_id
        schema:
          type: integer
        required: true
        description: ID of the race
      - in: path
        name: team_id
        schema:
          type: integer
        required: true
        description: ID of the team
    responses:
      200:
        description: Registration deleted successfully
        content:
          application/json:
            schema:
              type: object
              properties:
                message:
                  type: string
                  example: Registration deleted successfully
      404:
        description: Registration not found
      401:
        description: Unauthorized
      403:
        description: Forbidden - admin access required
    """
    registration = Registration.query.filter_by(race_id=race_id, team_id=team_id).first_or_404()
    db.session.delete(registration)
    db.session.commit()
    logger.info("Registration deleted: team %s unregistered from race %s", team_id, race_id)
    return jsonify({"message": "Registration deleted successfully"}), 200

# toggle disqualified status of a team
@team_bp.route("/race/<int:race_id>/team/<int:team_id>/disqualify/", methods=["PATCH"])
@admin_required()
def toggle_disqualification(race_id, team_id):
    """
    Toggle disqualification status of a team in a race - admin only.
    Can disqualify a team or revert them back to competing status.
    ---
    tags:
      - Teams
    security:
      - bearerAuth: []
    parameters:
      - in: path
        name: race_id
        schema:
          type: integer
        required: true
        description: ID of the race
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
              disqualified:
                type: boolean
                description: Set to true to disqualify, false to revert to competing status
    responses:
      200:
        description: Disqualification status updated successfully
        content:
          application/json:
            schema:
              type: object
              properties:
                message:
                  type: string
                  example: Team disqualified successfully
                team_id:
                  type: integer
                race_id:
                  type: integer
                disqualified:
                  type: boolean
      400:
        description: Bad request - missing disqualified field
      404:
        description: Registration not found
      401:
        description: Unauthorized
      403:
        description: Forbidden - admin access required
    """
    registration = Registration.query.filter_by(race_id=race_id, team_id=team_id).first_or_404()

    data = request.get_json() or {}
    try:
        validated = TeamDisqualifySchema().load(data)
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400

    disqualified = validated['disqualified']
    registration.disqualified = disqualified
    db.session.commit()

    action = "disqualified" if disqualified else "reverted to competing status"
    logger.info("Team %s %s in race %s", team_id, action, race_id)

    message = f"Team {'disqualified' if disqualified else 'reverted to competing status'} successfully"
    return jsonify({
        "message": message,
        "team_id": team_id,
        "race_id": race_id,
        "disqualified": disqualified
    }), 200

# send registration confirmation emails to all registered users
@team_bp.route("/race/<int:race_id>/send-registration-emails/", methods=["POST"])
@admin_required()
def send_registration_emails(race_id):
    """
  Send registration confirmation emails to users with confirmed registration payment - admin only.
    ---
    tags:
      - Teams
    security:
      - bearerAuth: []
    parameters:
      - in: path
        name: race_id
        schema:
          type: integer
        required: true
        description: ID of the race
    responses:
      200:
        description: Emails sent successfully
        content:
          application/json:
            schema:
              type: object
              properties:
                message:
                  type: string
                  example: Sent 15 emails successfully
                sent:
                  type: integer
                  description: Number of emails sent successfully
                failed:
                  type: integer
                  description: Number of emails that failed to send
      404:
        description: Race not found
      401:
        description: Unauthorized
      403:
        description: Forbidden - admin access required
    """

    race = Race.query.filter_by(id=race_id).first_or_404()

    # Send only for paid registrations where email wasn't sent yet.
    registrations = (
      Registration.query
      .options(joinedload(Registration.team).selectinload(Team.members))
      .filter(
          Registration.race_id == race_id,
          Registration.email_sent.is_(False),
          Registration.payment_confirmed.is_(True),
      )
      .all()
    )

    category_ids = [registration.race_category_id for registration in registrations]
    categories = (
      RaceCategory.query
      .options(selectinload(RaceCategory.translations))
      .filter(RaceCategory.id.in_(category_ids))
      .all()
      if category_ids
      else []
    )
    category_by_id = {category.id: category for category in categories}

    logger.info("Starting registration email send for race %s - %s registrations pending", race_id, len(registrations))

    sent_count = 0
    failed_count = 0

    # FIXME: this can be optimized by clever database joins

    for registration in registrations:
        team = registration.team
        if not team:
            continue

        race_category = category_by_id.get(registration.race_category_id)
        members = list(team.members or [])

        registration_success = True
        for member in members:
            try:
                # Generate password reset token for user
                reset_token = generate_reset_token()
                member.set_reset_token(reset_token, datetime.now() + timedelta(days=7))

                send_result = EmailService.send_registration_confirmation_email(
                    user_email=member.email,
                    user_name=member.name or member.email,
                    race_name=_resolve_race_name(race, member.preferred_language),
                    team_name=team.name,
                    race_category=_resolve_race_category_name(race_category, race, member.preferred_language),
                    reset_token=reset_token,
                    language=member.preferred_language,
                    race_greeting=_resolve_race_greeting(race, member.preferred_language),
                    return_result=True,
                )
                add_registration_email_log(
                  registration,
                  member.id if member else None,
                  member.email if member else "",
                  "registration_confirmation",
                  send_result,
                )
                if normalize_email_send_result(send_result)["success"]:
                    sent_count += 1
                else:
                    failed_count += 1
                    registration_success = False
                    logger.error("Failed to send registration email to %s for team %s", member.email, team.id)
            except (OSError, ValueError, TypeError) as e:
                failed_count += 1
                registration_success = False
                add_registration_email_log(
                  registration,
                  member.id if member else None,
                  member.email if member else "",
                  "registration_confirmation",
                  {
                    "success": False,
                    "error": str(e),
                    "provider": "smtp",
                    "provider_message_id": None,
                  },
                )
                logger.error("Exception sending registration email to %s: %s", member.email, e)

        # Mark registration as email sent only if all team members received email
        if registration_success and len(members) > 0:
            registration.email_sent = True

        # Persist progress per registration to avoid losing all progress on long batches.
        db.session.commit()

    logger.info("Registration emails completed for race %s - sent: %s, failed: %s", race_id, sent_count, failed_count)

    return jsonify({
        "message": f"Sent {sent_count} emails successfully",
        "sent": sent_count,
        "failed": failed_count
    }), 200


@team_bp.route("/race/<int:race_id>/email-logs/", methods=["GET"])
@admin_required()
def get_registration_email_logs(race_id):
    """
    List registration email logs for a race - admin only.
    ---
    tags:
      - Teams
    security:
      - bearerAuth: []
    parameters:
      - in: path
        name: race_id
        schema:
          type: integer
        required: true
        description: ID of the race
      - in: query
        name: status
        schema:
          type: string
        required: false
        description: Optional status filter (e.g. sent, delivered, failed, bounced, blocked)
      - in: query
        name: template_type
        schema:
          type: string
        required: false
        description: Optional template filter (e.g. registration_confirmation)
      - in: query
        name: page
        schema:
          type: integer
        required: false
        description: 1-based page number (default 1)
      - in: query
        name: page_size
        schema:
          type: integer
        required: false
        description: Number of items per page (default 50, max 200)
      - in: query
        name: team_id
        schema:
          type: integer
        required: false
        description: Optional team ID filter
      - in: query
        name: date_from
        schema:
          type: string
          format: date
        required: false
        description: Optional created-at lower bound (YYYY-MM-DD)
      - in: query
        name: date_to
        schema:
          type: string
          format: date
        required: false
        description: Optional created-at upper bound (YYYY-MM-DD)
    responses:
      200:
        description: Paginated list of email logs
      401:
        description: Unauthorized
      403:
        description: Forbidden - admin access required
      404:
        description: Race not found
    """
    Race.query.filter_by(id=race_id).first_or_404()

    try:
        query_data = RegistrationEmailLogQuerySchema().load(request.args.to_dict())
    except ValidationError as err:
        return jsonify({'errors': err.messages}), 400

    status_filter = (query_data.get('status') or '').strip().lower()
    template_filter = (query_data.get('template_type') or '').strip().lower()
    team_id_filter = query_data.get('team_id')
    date_from = query_data.get('date_from')
    date_to = query_data.get('date_to')
    page = query_data['page']
    page_size = query_data['page_size']

    query = (
        RegistrationEmailLog.query
        .join(Registration, RegistrationEmailLog.registration_id == Registration.id)
        .filter(Registration.race_id == race_id)
        .order_by(RegistrationEmailLog.created_at.desc(), RegistrationEmailLog.id.desc())
    )

    if status_filter:
        query = query.filter(RegistrationEmailLog.status == status_filter)
    if template_filter:
        query = query.filter(RegistrationEmailLog.template_type == template_filter)
    if team_id_filter:
        query = query.filter(Registration.team_id == team_id_filter)
    if date_from:
        query = query.filter(RegistrationEmailLog.created_at >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        query = query.filter(RegistrationEmailLog.created_at <= datetime.combine(date_to, datetime.max.time()))

    total = query.count()
    logs = query.offset((page - 1) * page_size).limit(page_size).all()

    items = [
        {
            'id': log.id,
            'registration_id': log.registration_id,
            'team_id': log.registration.team_id if log.registration else None,
            'team_name': log.registration.team.name if log.registration and log.registration.team else None,
            'user_id': log.user_id,
            'email_address': log.email_address,
            'template_type': log.template_type,
            'provider': log.provider,
            'provider_message_id': log.provider_message_id,
            'status': log.status,
            'error_message': log.error_message,
            'attempt_count': log.attempt_count,
            'last_attempted_at': log.last_attempted_at.isoformat() if log.last_attempted_at else None,
            'delivered_at': log.delivered_at.isoformat() if log.delivered_at else None,
            'created_at': log.created_at.isoformat() if log.created_at else None,
            'updated_at': log.updated_at.isoformat() if log.updated_at else None,
        }
        for log in logs
    ]

    return jsonify(
        {
            'data': items,
            'pagination': {
                'page': page,
                'page_size': page_size,
                'total': total,
            },
        }
    ), 200


@team_bp.route("/race/<int:race_id>/retry-failed-emails/", methods=["POST"])
@admin_required()
def retry_failed_registration_emails(race_id):
    """
    Retry failed registration confirmation emails for a race - admin only.
    ---
    tags:
      - Teams
    security:
      - bearerAuth: []
    parameters:
      - in: path
        name: race_id
        schema:
          type: integer
        required: true
        description: ID of the race
    requestBody:
      required: false
      content:
        application/json:
          schema:
            type: object
            properties:
              limit:
                type: integer
                description: Maximum failed-email rows to retry in one call (default 50, max 500)
    responses:
      200:
        description: Retry run completed
      401:
        description: Unauthorized
      403:
        description: Forbidden - admin access required
      404:
        description: Race not found
    """
    race = Race.query.filter_by(id=race_id).first_or_404()
    try:
        payload = RetryFailedEmailsSchema().load(request.get_json(silent=True) or {})
    except ValidationError as err:
        return jsonify({'errors': err.messages}), 400

    limit = payload['limit']

    failed_logs = (
        RegistrationEmailLog.query
        .join(Registration, RegistrationEmailLog.registration_id == Registration.id)
        .filter(
            Registration.race_id == race_id,
            RegistrationEmailLog.template_type == 'registration_confirmation',
            RegistrationEmailLog.status == 'failed',
        )
        .order_by(RegistrationEmailLog.last_attempted_at.asc(), RegistrationEmailLog.id.asc())
        .limit(limit)
        .all()
    )

    retried = 0
    sent = 0
    failed = 0
    skipped = 0

    for failed_log in failed_logs:
        retried += 1
        retry_result = _retry_single_registration_email_log(failed_log, race)
        if retry_result['status'] == 'sent':
            sent += 1
        elif retry_result['status'] == 'failed':
            failed += 1
        else:
            skipped += 1
        db.session.commit()

    return jsonify(
        {
            'message': 'Retry processed',
            'retried': retried,
            'sent': sent,
            'failed': failed,
            'skipped': skipped,
        }
    ), 200


@team_bp.route('/race/<int:race_id>/email-logs/<int:log_id>/retry/', methods=['POST'])
@admin_required()
def retry_registration_email_log(race_id, log_id):
    """
    Retry a specific failed registration email log row for a race - admin only.
    ---
    tags:
      - Teams
    security:
      - bearerAuth: []
    parameters:
      - in: path
        name: race_id
        schema:
          type: integer
        required: true
        description: ID of the race
      - in: path
        name: log_id
        schema:
          type: integer
        required: true
        description: ID of the email log row to retry
    responses:
      200:
        description: Retry processed
      400:
        description: Unsupported log type/state for retry
      401:
        description: Unauthorized
      403:
        description: Forbidden - admin access required
      404:
        description: Race or log not found
    """
    race = Race.query.filter_by(id=race_id).first_or_404()
    failed_log = (
        RegistrationEmailLog.query
        .join(Registration, RegistrationEmailLog.registration_id == Registration.id)
        .filter(
            Registration.race_id == race_id,
            RegistrationEmailLog.id == log_id,
        )
        .first_or_404()
    )

    retryable_statuses = {'failed', 'bounced', 'blocked'}
    if failed_log.template_type != 'registration_confirmation':
        return jsonify({'message': 'Only registration confirmation emails can be retried.'}), 400
    if (failed_log.status or '').lower() not in retryable_statuses:
        return jsonify({'message': 'Only failed/bounced/blocked email logs can be retried.'}), 400

    retry_result = _retry_single_registration_email_log(failed_log, race)
    db.session.commit()

    if retry_result['status'] == 'sent':
        status_code = 200
        message = 'Email retried successfully.'
    elif retry_result['status'] == 'failed':
        status_code = 200
        message = 'Retry attempted but delivery failed.'
    else:
        status_code = 200
        message = 'Retry skipped because related registration/member no longer exists.'

    return jsonify({'message': message, 'status': retry_result['status']}), status_code

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
    data = request.get_json() or {}
    validated = TeamCreateSchema().load(data)
    new_team = Team(name=validated['name'])
    db.session.add(new_team)
    db.session.commit()
    logger.info("New team created: %s (ID: %s)", new_team.name, new_team.id)
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
    data = request.get_json() or {}
    validated = TeamAddMembersSchema().load(data)
    team = Team.query.filter_by(id=team_id).first_or_404()

    added_user_ids = []

    if validated.get('user_ids'):
        for user_id in validated['user_ids']:
            user = User.query.filter_by(id=user_id).first_or_404()
            if user not in team.members:
                team.members.append(user)
                added_user_ids.append(user.id)

    if validated.get('members'):
        for member in validated['members']:
            member_name = (member.get('name') or '').strip()
            member_email = (member.get('email') or '').strip().lower()
            member_language = (member.get('preferred_language') or '').strip().lower() or None

            user = User.query.filter_by(email=member_email).first()
            if not user:
                user = User(name=member_name, email=member_email, preferred_language=member_language)
                user.set_password(secrets.token_urlsafe(24))
                db.session.add(user)
                db.session.flush()
            elif member_language and not user.preferred_language:
                user.preferred_language = member_language

            if user not in team.members:
                team.members.append(user)
                added_user_ids.append(user.id)

    db.session.commit()
    logger.info("Added %s members to team %s: %s", len(added_user_ids), team_id, added_user_ids)
    return jsonify({"team_id": team.id, "user_ids": added_user_ids}), 201

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
    logger.info("Retrieved members for team %s (ID: %s) - %s members found", team.name, team.id, len(team.members))
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
    logger.info("All members removed from team %s (ID: %s)", team.name, team.id)
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
    logger.info("Team deleted successfully: %s (ID: %s)", team.name, team.id)
    return jsonify({"message": "Team deleted successfully"}), 200
