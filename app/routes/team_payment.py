import logging
import secrets
from datetime import datetime

from flask import Blueprint, current_app, jsonify, request

from app import db
from app.models import Race, Registration, RegistrationPaymentAttempt, Team
from app.routes.admin import admin_required
from app.services.stripe_service import create_registration_checkout_session
from app.services.stripe_service import get_checkout_session_payment_state
from app.utils import registration_mode as _registration_mode

logger = logging.getLogger(__name__)

team_payment_bp = Blueprint("team_payment", __name__)

def _allowed_payment_types(mode):
    if mode == 'team':
        return ['team']
    else:
        return ['driver', 'codriver']


def _resolve_payment_amount_cents(race, payment_type):
    if payment_type == 'team':
        return int(race.registration_team_amount_cents or current_app.config.get('STRIPE_REGISTRATION_TEAM_AMOUNT', 50)) * 100
    if payment_type == 'driver':
        return int(race.registration_driver_amount_cents) * 100
    return int(race.registration_codriver_amount_cents) * 100


def _sync_registration_payment_state(registration, race):
    attempts = registration.payment_attempts or []
    team_confirmed = [attempt for attempt in attempts if attempt.payment_type == 'team' and attempt.status == 'confirmed']
    driver_confirmed = [attempt for attempt in attempts if attempt.payment_type == 'driver' and attempt.status == 'confirmed']

    mode = _registration_mode(race)
    relevant = team_confirmed if mode == 'team' else driver_confirmed

    if relevant:
        latest = max(relevant, key=lambda attempt: ((attempt.confirmed_at or attempt.created_at), attempt.id))
        registration.payment_confirmed = True
        registration.payment_confirmed_at = latest.confirmed_at or latest.created_at
        registration.stripe_session_id = latest.stripe_session_id
    else:
        registration.payment_confirmed = False
        registration.payment_confirmed_at = None
        registration.stripe_session_id = None


@team_payment_bp.route("/race/<int:race_id>/team/<int:team_id>/payments/retry/", methods=["POST"])
@admin_required()
def retry_registration_payment(race_id, team_id):
    """
    Create a new checkout session to retry a registration payment - admin only.
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
      required: false
      content:
        application/json:
          schema:
            type: object
            properties:
              payment_type:
                type: string
                enum: [team, driver, codriver]
                description: |
                  Optional override for payment type. Allowed values depend on race mode:
                  `team` mode allows only `team`; `individual` mode allows `driver` and `codriver`.
              success_url:
                type: string
                format: uri
                description: Optional custom checkout success URL
              cancel_url:
                type: string
                format: uri
                description: Optional custom checkout cancel URL
    responses:
      201:
        description: Checkout session created successfully
        content:
          application/json:
            schema:
              type: object
              properties:
                checkout_url:
                  type: string
                  format: uri
                session_id:
                  type: string
                payment_type:
                  type: string
      400:
        description: Invalid request (missing slug, invalid payment type, or payment already confirmed)
        content:
          application/json:
            schema:
              type: object
              properties:
                message:
                  type: string
      401:
        description: Unauthorized
      403:
        description: Forbidden - admin access required
      404:
        description: Race, team, or registration not found
      502:
        description: Checkout session could not be initialized
        content:
          application/json:
            schema:
              type: object
              properties:
                message:
                  type: string
                  example: Unable to initialize checkout.
      503:
        description: Payment provider is not configured
        content:
          application/json:
            schema:
              type: object
              properties:
                message:
                  type: string
                  example: Payment provider is not configured.
    """
    race = Race.query.filter_by(id=race_id).first_or_404()
    team = Team.query.filter_by(id=team_id).first_or_404()
    registration = Registration.query.filter_by(race_id=race_id, team_id=team_id).first_or_404()

    if not race.registration_slug:
        return jsonify({"message": "Race registration slug is not configured."}), 400

    payload = request.get_json(silent=True) or {}
    mode = _registration_mode(race)
    payment_type = (payload.get('payment_type') or ('team' if mode == 'team' else 'driver')).strip().lower()

    if payment_type not in _allowed_payment_types(mode):
        return jsonify({"message": "Invalid payment_type for race registration mode."}), 400

    already_confirmed = RegistrationPaymentAttempt.query.filter_by(
        registration_id=registration.id,
        payment_type=payment_type,
        status='confirmed',
    ).first()
    if already_confirmed:
        return jsonify({"message": f"Payment already confirmed for '{payment_type}'."}), 400

    frontend_url = (current_app.config.get('FRONTEND_URL') or '').rstrip('/')
    registration_slug = race.registration_slug
    success_url = payload.get('success_url') or f"{frontend_url}/register/{registration_slug}?checkout=success"
    cancel_url = payload.get('cancel_url') or f"{frontend_url}/register/{registration_slug}?checkout=cancel"

    amount_cents = _resolve_payment_amount_cents(race, payment_type)
    currency = (race.registration_currency or current_app.config.get('STRIPE_CURRENCY', 'czk')).lower()
    mode_for_checkout = 'team' if payment_type == 'team' else 'individual'

    try:
        session_data = create_registration_checkout_session(
            secret_key=current_app.config.get('STRIPE_RESTRICTED_KEY'),
            success_url=success_url,
            cancel_url=cancel_url,
            currency=currency,
            amount_cents=amount_cents,
            race_name=race.name,
            registration_slug=registration_slug,
            team_name=team.name,
            mode=mode_for_checkout,
            members_count=max(len(team.members or []), 1),
            race_id=race.id,
            team_id=team.id,
            payment_type=payment_type,
        )
    except ValueError as exc:
        logger.error("Stripe checkout unavailable for admin retry race %s team %s: %s", race.id, team.id, exc)
        return jsonify({"message": "Payment provider is not configured."}), 503
    except (RuntimeError, OSError, TypeError) as exc:
        logger.error("Stripe checkout creation failed for admin retry race %s team %s: %s", race.id, team.id, exc)
        return jsonify({"message": "Unable to initialize checkout."}), 502

    existing_attempt = RegistrationPaymentAttempt.query.filter_by(stripe_session_id=session_data['session_id']).first()
    if not existing_attempt:
        db.session.add(
            RegistrationPaymentAttempt(
                registration_id=registration.id,
                stripe_session_id=session_data['session_id'],
                payment_type=payment_type,
                status='pending',
                amount_cents=amount_cents,
                currency=currency,
            )
        )

    registration.stripe_session_id = session_data['session_id']
    db.session.commit()

    return jsonify({
        "checkout_url": session_data['checkout_url'],
        "session_id": session_data['session_id'],
        "payment_type": payment_type,
    }), 201


@team_payment_bp.route("/race/<int:race_id>/team/<int:team_id>/payments/mark/", methods=["PATCH"])
@admin_required()
def mark_registration_payment(race_id, team_id):
    """
    Mark registration payment status manually - admin only.
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
            required:
              - payment_type
              - confirmed
            properties:
              payment_type:
                type: string
                enum: [team, driver, codriver]
                description: |
                  Payment type to update. Allowed values depend on race mode:
                  `team` mode allows only `team`; `individual` mode allows `driver` and `codriver`.
              confirmed:
                type: boolean
                description: |
                  `true` creates a confirmed manual payment attempt (if none exists);
                  `false` marks confirmed attempts for that payment type as failed.
    responses:
      200:
        description: Payment state updated successfully
        content:
          application/json:
            schema:
              type: object
              properties:
                team_id:
                  type: integer
                race_id:
                  type: integer
                payment_type:
                  type: string
                payment_confirmed:
                  type: boolean
      400:
        description: Invalid request payload
        content:
          application/json:
            schema:
              type: object
              properties:
                message:
                  type: string
                  example: confirmed must be a boolean.
      401:
        description: Unauthorized
      403:
        description: Forbidden - admin access required
      404:
        description: Race or registration not found
    """
    race = Race.query.filter_by(id=race_id).first_or_404()
    registration = Registration.query.filter_by(race_id=race_id, team_id=team_id).first_or_404()

    payload = request.get_json(silent=True) or {}
    mode = _registration_mode(race)
    payment_type = (payload.get('payment_type') or '').strip().lower()
    confirmed = payload.get('confirmed')

    if payment_type not in _allowed_payment_types(mode):
        return jsonify({"message": "Invalid payment_type for race registration mode."}), 400
    if not isinstance(confirmed, bool):
        return jsonify({"message": "confirmed must be a boolean."}), 400

    if confirmed:
        existing_confirmed = RegistrationPaymentAttempt.query.filter_by(
            registration_id=registration.id,
            payment_type=payment_type,
            status='confirmed',
        ).first()
        if not existing_confirmed:
            manual_session_id = f"manual_{race_id}_{team_id}_{payment_type}_{int(datetime.now().timestamp())}_{secrets.token_hex(4)}"
            db.session.add(
                RegistrationPaymentAttempt(
                    registration_id=registration.id,
                    stripe_session_id=manual_session_id,
                    payment_type=payment_type,
                    status='confirmed',
                    amount_cents=_resolve_payment_amount_cents(race, payment_type),
                    currency=(race.registration_currency or current_app.config.get('STRIPE_CURRENCY', 'czk')).lower(),
                    confirmed_at=datetime.now(),
                )
            )
    else:
        for attempt in RegistrationPaymentAttempt.query.filter_by(
            registration_id=registration.id,
            payment_type=payment_type,
            status='confirmed',
        ).all():
            attempt.status = 'failed'
            attempt.confirmed_at = None

    _sync_registration_payment_state(registration, race)
    db.session.commit()

    return jsonify({
        "team_id": team_id,
        "race_id": race_id,
        "payment_type": payment_type,
        "payment_confirmed": bool(registration.payment_confirmed),
    }), 200


@team_payment_bp.route("/race/<int:race_id>/team/<int:team_id>/payments/reconcile/", methods=["POST"])
@admin_required()
def reconcile_registration_payment(race_id, team_id):
    """
    Reconcile registration payment state by querying Stripe Checkout session status - admin only.
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
      - in: path
        name: team_id
        schema:
          type: integer
        required: true
    requestBody:
      required: false
      content:
        application/json:
          schema:
            type: object
            properties:
              payment_type:
                type: string
                enum: [team, driver, codriver]
              stripe_session_id:
                type: string
                description: Optional explicit session id to reconcile.
    responses:
      200:
        description: Reconciliation completed
      400:
        description: Invalid request or no Stripe session available
      404:
        description: Race/registration not found
      502:
        description: Stripe query failed
      503:
        description: Stripe provider not configured
    """
    race = Race.query.filter_by(id=race_id).first_or_404()
    registration = Registration.query.filter_by(race_id=race_id, team_id=team_id).first_or_404()

    payload = request.get_json(silent=True) or {}
    mode = _registration_mode(race)
    requested_payment_type = (payload.get('payment_type') or '').strip().lower()
    explicit_session_id = (payload.get('stripe_session_id') or '').strip()

    if requested_payment_type and requested_payment_type not in _allowed_payment_types(mode):
        return jsonify({"message": "Invalid payment_type for race registration mode."}), 400

    candidate_attempts_query = RegistrationPaymentAttempt.query.filter_by(registration_id=registration.id)
    if requested_payment_type:
        candidate_attempts_query = candidate_attempts_query.filter_by(payment_type=requested_payment_type)

    candidate_attempts = candidate_attempts_query.order_by(
        RegistrationPaymentAttempt.created_at.desc(),
        RegistrationPaymentAttempt.id.desc(),
    ).all()

    selected_attempt = None
    if explicit_session_id:
        selected_attempt = next(
            (attempt for attempt in candidate_attempts if attempt.stripe_session_id == explicit_session_id),
            None,
        )
        if not selected_attempt:
            return jsonify({"message": "Provided stripe_session_id was not found for this registration."}), 400
    else:
        selected_attempt = next(
            (
                attempt for attempt in candidate_attempts
                if attempt.stripe_session_id and not str(attempt.stripe_session_id).startswith('manual_')
            ),
            None,
        )

    if not selected_attempt:
        return jsonify({"message": "No Stripe checkout session found to reconcile."}), 400

    try:
        stripe_state = get_checkout_session_payment_state(
            session_id=selected_attempt.stripe_session_id,
            secret_key=current_app.config.get('STRIPE_RESTRICTED_KEY'),
        )
    except ValueError as exc:
        logger.error("Stripe reconcile unavailable for race %s team %s: %s", race_id, team_id, exc)
        return jsonify({"message": "Payment provider is not configured."}), 503
    except RuntimeError as exc:
        logger.error("Stripe reconcile failed for race %s team %s session %s: %s", race_id, team_id, selected_attempt.stripe_session_id, exc)
        return jsonify({"message": "Unable to query Stripe payment state."}), 502

    payment_status = (stripe_state.get('payment_status') or '').lower()
    checkout_status = (stripe_state.get('status') or '').lower()

    if payment_status == 'paid':
        selected_attempt.status = 'confirmed'
        if selected_attempt.confirmed_at is None:
            selected_attempt.confirmed_at = datetime.now()
    elif checkout_status == 'expired' or (checkout_status == 'complete' and payment_status != 'paid'):
        selected_attempt.status = 'failed'
        selected_attempt.confirmed_at = None

    _sync_registration_payment_state(registration, race)
    db.session.commit()

    return jsonify({
        "team_id": team_id,
        "race_id": race_id,
        "payment_type": selected_attempt.payment_type,
        "stripe_session_id": selected_attempt.stripe_session_id,
        "stripe_status": {
            "payment_status": payment_status,
            "status": checkout_status,
        },
        "payment_confirmed": bool(registration.payment_confirmed),
    }), 200
