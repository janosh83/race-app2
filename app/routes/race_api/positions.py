import logging
from datetime import timedelta

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from marshmallow import ValidationError

from app import db
from app.models import Race, Registration, TeamPosition, User
from app.schemas import TeamPositionSchema
from app.utils import to_naive_utc, utc_now, current_user_id

logger = logging.getLogger(__name__)

race_positions_bp = Blueprint('race_positions', __name__)

# Reports closer together than this (per user and race) are dropped, so focus
# events firing right after the periodic poll don't flood the table.
MIN_REPORT_INTERVAL = timedelta(seconds=20)
# Fixes older than this are dropped rather than stored with a misleading time.
MAX_FIX_AGE = timedelta(minutes=10)


@race_positions_bp.route('/positions/', methods=['POST'])
@jwt_required()
def report_position(race_id):
    """
    Report the current GPS position of the logged-in user during the race.
    Accepted only while the race logging window is open and only from members
    of a team with a paid registration for the race.
    ---
    tags:
      - Races
    parameters:
      - in: path
        name: race_id
        schema:
          type: integer
        required: true
        description: ID of the race
    security:
      - BearerAuth: []
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required:
              - latitude
              - longitude
            properties:
              latitude:
                type: number
                example: 50.0755
              longitude:
                type: number
                example: 14.4378
              accuracy:
                type: number
                description: Accuracy of the fix in meters
                example: 15
              recorded_at:
                type: string
                format: date-time
                description: When the device took the fix; defaults to now
    responses:
      201:
        description: Position stored
      200:
        description: Position accepted but not stored (too soon after the previous one, or a stale fix)
      400:
        description: Invalid payload
      403:
        description: Logging window closed or user not registered for the race
      404:
        description: Race not found
    """
    try:
        data = TeamPositionSchema().load(request.get_json(silent=True) or {})
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400

    user = User.query.filter_by(id=current_user_id()).first_or_404()
    race = Race.query.filter_by(id=race_id).first_or_404()

    now = utc_now()
    if not (race.start_logging_at <= now <= race.end_logging_at):
        return jsonify({"message": "Positions are only recorded while the race logging window is open."}), 403

    team_ids = [team.id for team in user.teams or []]
    registration = Registration.query.filter(
        Registration.race_id == race_id,
        Registration.team_id.in_(team_ids),
        Registration.payment_confirmed.is_(True),
    ).first() if team_ids else None
    if registration is None:
        logger.warning("User %s reported a position for race %s without a registration", user.id, race_id)
        return jsonify({"message": "You are not registered for this race."}), 403

    recorded_at = to_naive_utc(data['recorded_at']) if data['recorded_at'] else now
    # Device clocks drift; never store a fix in the future.
    recorded_at = min(recorded_at, now)
    if recorded_at < now - MAX_FIX_AGE or recorded_at < race.start_logging_at:
        return jsonify({"stored": False, "reason": "stale"}), 200

    recent = TeamPosition.query.filter(
        TeamPosition.user_id == user.id,
        TeamPosition.race_id == race_id,
        TeamPosition.created_at > now - MIN_REPORT_INTERVAL,
    ).first()
    if recent is not None:
        return jsonify({"stored": False, "reason": "too_soon"}), 200

    db.session.add(TeamPosition(
        race_id=race_id,
        team_id=registration.team_id,
        user_id=user.id,
        latitude=data['latitude'],
        longitude=data['longitude'],
        accuracy_m=data['accuracy'],
        recorded_at=recorded_at,
        created_at=now,
    ))
    db.session.commit()
    return jsonify({"stored": True}), 201
