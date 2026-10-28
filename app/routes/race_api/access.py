import logging

from flask import jsonify

from app.models import Registration
from app.utils import utc_now

logger = logging.getLogger(__name__)


def race_content_denied(race, user):
    """Return a 403 response if `user` may not see the race's checkpoints and
    tasks right now, otherwise None.

    Admins always may. Everyone else must belong to a team with a paid
    registration for the race, and only while checkpoints are being shown —
    the frontend hides them outside that window, and the API must not leak
    them (e.g. checkpoint coordinates before the race starts).
    """
    if user.is_administrator:
        return None

    team_ids = [team.id for team in user.teams or []]
    registered = bool(team_ids) and Registration.query.filter(
        Registration.race_id == race.id,
        Registration.team_id.in_(team_ids),
        Registration.payment_confirmed.is_(True),
    ).first() is not None
    if not registered:
        logger.warning("User %s requested content of race %s without a registration", user.id, race.id)
        return jsonify({"message": "You are not registered for this race."}), 403

    now = utc_now()
    if not (race.start_showing_checkpoints_at <= now <= race.end_showing_checkpoints_at):
        logger.warning("User %s requested content of race %s outside the showing window", user.id, race.id)
        return jsonify({"message": "Checkpoints and tasks for this race are not shown at this time."}), 403

    return None
