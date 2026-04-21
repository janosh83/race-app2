import logging
from datetime import datetime, timedelta

from flask import Blueprint, current_app, jsonify, request
from marshmallow import ValidationError
from sqlalchemy.exc import IntegrityError

from app import db
from app.models import Race, RaceCategory, RaceTranslation, Registration, RegistrationPaymentAttempt, Team
from app.services.email_service import EmailService, generate_reset_token
from app.services.email_tracking_service import add_registration_email_log, apply_brevo_event, normalize_email_send_result
from app.schemas import BrevoWebhookEventSchema
from app.services.stripe_service import construct_stripe_event
from app.services.stripe_service import create_registration_checkout_session
from app.services.stripe_service import get_checkout_receipt_url
from app.utils import (
    registration_mode as _registration_mode,
    resolve_language as _resolve_language,
    resolve_race_category_name as _resolve_race_category_name,
    resolve_race_greeting as _resolve_race_greeting,
    resolve_race_name as _resolve_race_name,
)

logger = logging.getLogger(__name__)

race_registration_bp = Blueprint('race_registration', __name__)
def _payment_summary(registration, race):
    mode = _registration_mode(race)
    attempts = RegistrationPaymentAttempt.query.filter_by(registration_id=registration.id).order_by(
        RegistrationPaymentAttempt.created_at.desc(),
        RegistrationPaymentAttempt.id.desc(),
    ).all()

    driver_paid = any(a.status == 'confirmed' and a.payment_type == 'driver' for a in attempts)
    codriver_paid = any(a.status == 'confirmed' and a.payment_type == 'codriver' for a in attempts)
    team_paid = any(a.status == 'confirmed' and a.payment_type == 'team' for a in attempts)

    if mode == 'team':
        is_paid = team_paid or bool(registration.payment_confirmed)
    else:
        is_paid = driver_paid or bool(registration.payment_confirmed)

    details = {
        'mode': mode,
        'driver_paid': bool(driver_paid),
        'codriver_paid': bool(codriver_paid),
        'team_paid': bool(team_paid),
        'attempts': [
            {
                'id': attempt.id,
                'stripe_session_id': attempt.stripe_session_id,
                'payment_type': attempt.payment_type,
                'status': attempt.status,
                'amount_cents': attempt.amount_cents,
                'currency': attempt.currency,
                'created_at': attempt.created_at.isoformat() if attempt.created_at else None,
                'confirmed_at': attempt.confirmed_at.isoformat() if attempt.confirmed_at else None,
            }
            for attempt in attempts
        ],
    }
    return is_paid, details


def _get_registration_admin_recipients():
    configured = current_app.config.get('REGISTRATION_ADMIN_EMAILS')
    recipients = []

    if isinstance(configured, (list, tuple, set)):
        recipients = [str(item).strip().lower() for item in configured if str(item).strip()]
    elif isinstance(configured, str):
        normalized = configured.replace(';', ',')
        recipients = [item.strip().lower() for item in normalized.split(',') if item.strip()]

    if not recipients:
        fallback = (current_app.config.get('ADMIN_EMAIL') or '').strip().lower()
        if fallback:
            recipients = [fallback]

    deduped = []
    seen = set()
    for email in recipients:
        if email not in seen:
            seen.add(email)
            deduped.append(email)
    return deduped


def _notify_admins_registration_completed(race, team, registration, payment_attempt):
    recipients = _get_registration_admin_recipients()
    if not recipients:
        logger.warning('No admin email configured to receive registration completion notifications')
        return True

    all_sent = True
    for admin_email in recipients:
        try:
            send_result = EmailService.send_admin_registration_completed_email(
                admin_email=admin_email,
                race_name=race.name if race else f'Race #{registration.race_id}',
                team_name=team.name if team else f'Team #{registration.team_id}',
                registration_mode=_registration_mode(race) if race else None,
                registration_id=registration.id,
                race_id=registration.race_id,
                team_id=registration.team_id,
                language=(race.default_language if race else None),
                payment_type=payment_attempt.payment_type,
                payment_amount_cents=payment_attempt.amount_cents,
                payment_currency=payment_attempt.currency,
                payment_reference=payment_attempt.stripe_session_id,
                payment_confirmed_at=payment_attempt.confirmed_at,
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
            registration=registration,
            user_id=None,
            email_address=admin_email,
            template_type='admin_registration_completed',
            send_result=send_result,
        )

        if not normalize_email_send_result(send_result)['success']:
            all_sent = False

    return all_sent


@race_registration_bp.route('/<string:registration_slug>/', methods=['GET'])
def get_race_by_registration_slug(registration_slug):
    """
    Resolve public registration settings for a race by registration slug.
    ---
    tags:
      - Races
    parameters:
      - in: path
        name: registration_slug
        schema:
          type: string
        required: true
        description: Race registration slug
      - in: query
        name: lang
        schema:
          type: string
        required: false
        description: Optional language code for translated race/category fields
    responses:
      200:
        description: Registration settings resolved successfully
      404:
        description: Race not found or registration disabled
      409:
        description: Race registration mode is misconfigured
    """
    race = Race.query.filter_by(registration_slug=registration_slug).first_or_404()
    if not race.registration_enabled:
        return jsonify({'message': 'Registration is not enabled for this race.'}), 404
    if race.allow_team_registration == race.allow_individual_registration:
        return jsonify({'message': 'Race registration mode is misconfigured.'}), 409

    language = request.args.get('lang')
    name = race.name
    description = race.description
    race_greeting = race.race_greeting
    if language and language in (race.supported_languages or []):
        translation = RaceTranslation.query.filter_by(
            race_id=race.id,
            language=language,
        ).first()
        if translation:
            name = translation.name
            description = translation.description
            if translation.race_greeting is not None:
                race_greeting = translation.race_greeting

    categories = []
    for category in race.categories:
        category_name = category.name
        category_description = category.description

        if language and language in (race.supported_languages or []):
            category_translation = next(
                (translation for translation in (category.translations or []) if translation.language == language),
                None,
            )
            if category_translation:
                category_name = category_translation.name
                category_description = category_translation.description

        categories.append(
            {
                'id': category.id,
                'name': category_name,
                'description': category_description,
            }
        )

    return jsonify(
        {
            'id': race.id,
            'registration_slug': race.registration_slug,
            'registration_enabled': race.registration_enabled,
            'name': name,
            'description': description,
            'race_greeting': race_greeting,
            'min_team_size': race.min_team_size,
            'max_team_size': race.max_team_size,
            'allow_team_registration': race.allow_team_registration,
            'allow_individual_registration': race.allow_individual_registration,
            'registration_currency': race.registration_currency,
            'registration_pricing_strategy': race.registration_pricing_strategy,
            'registration_team_amount_cents': race.registration_team_amount_cents,
            'registration_individual_amount_cents': race.registration_individual_amount_cents,
            'registration_driver_amount_cents': race.registration_driver_amount_cents,
            'registration_codriver_amount_cents': race.registration_codriver_amount_cents,
            'categories': categories,
            'supported_languages': race.supported_languages,
            'default_language': race.default_language,
        }
    ), 200


@race_registration_bp.route('/<string:registration_slug>/payment-status/', methods=['GET'])
def get_registration_payment_status_by_slug(registration_slug):
    """
    Get payment status for a team's registration using race registration slug.
    ---
    tags:
      - Races
    parameters:
      - in: path
        name: registration_slug
        schema:
          type: string
        required: true
        description: Race registration slug
      - in: query
        name: team_id
        schema:
          type: integer
        required: true
        description: Team ID
    responses:
      200:
        description: Payment status resolved
      400:
        description: team_id is missing or invalid
      404:
        description: Race/registration not found or registration disabled
    """
    race = Race.query.filter_by(registration_slug=registration_slug).first_or_404()
    if not race.registration_enabled:
        return jsonify({'message': 'Registration is not enabled for this race.'}), 404

    team_id_raw = request.args.get('team_id')
    if not team_id_raw:
        return jsonify({'message': 'team_id is required.'}), 400

    try:
        team_id = int(team_id_raw)
    except (TypeError, ValueError):
        return jsonify({'message': 'team_id must be an integer.'}), 400

    registration = Registration.query.filter_by(race_id=race.id, team_id=team_id).first()
    if not registration:
        return jsonify({'message': 'Registration not found.'}), 404

    payment_confirmed, payment_details = _payment_summary(registration, race)

    return jsonify(
        {
            'race_id': race.id,
            'team_id': team_id,
            'payment_confirmed': bool(payment_confirmed),
            'payment_confirmed_at': registration.payment_confirmed_at.isoformat() if registration.payment_confirmed_at else None,
            'payment_details': payment_details,
        }
    ), 200


@race_registration_bp.route('/<string:registration_slug>/checkout/', methods=['POST'])
def create_checkout_by_registration_slug(registration_slug):
    """
    Create Stripe Checkout session for public race registration.
    ---
    tags:
      - Races
    parameters:
      - in: path
        name: registration_slug
        schema:
          type: string
        required: true
        description: Race registration slug
    responses:
      201:
        description: Checkout session created successfully
      400:
        description: Validation error (team/mode/members_count/role/payment state)
      404:
        description: Race/team/registration not found or registration disabled
      409:
        description: Race registration mode is misconfigured
      502:
        description: Unable to initialize checkout
      503:
        description: Payment provider is not configured
    """
    race = Race.query.filter_by(registration_slug=registration_slug).first_or_404()
    if not race.registration_enabled:
        return jsonify({'message': 'Registration is not enabled for this race.'}), 404
    if race.allow_team_registration == race.allow_individual_registration:
        return jsonify({'message': 'Race registration mode is misconfigured.'}), 409

    payload = request.get_json(silent=True) or {}
    team_id = payload.get('team_id')
    team_name = (payload.get('team_name') or '').strip()
    mode = payload.get('mode') or ('team' if race.allow_team_registration else 'individual')
    members_count_raw = payload.get('members_count')
    if members_count_raw in (None, ''):
        members_count = 1
    else:
        try:
            members_count = int(members_count_raw)
        except (TypeError, ValueError):
            return jsonify({'message': 'members_count must be an integer.'}), 400

    if not team_id:
        return jsonify({'message': 'team_id is required.'}), 400

    try:
        team_id = int(team_id)
    except (TypeError, ValueError):
        return jsonify({'message': 'team_id must be an integer.'}), 400

    team = Team.query.filter_by(id=team_id).first_or_404()

    registration = Registration.query.filter_by(race_id=race.id, team_id=team_id).first()
    if not registration:
        return jsonify({'message': 'Registration must be created before checkout.'}), 404

    current_mode = _registration_mode(race)
    registration_paid, _ = _payment_summary(registration, race)
    if registration_paid and current_mode == 'team':
        return jsonify({'message': 'Payment is already confirmed for this registration.'}), 400

    if mode not in ('team', 'individual'):
        return jsonify({'message': 'Invalid registration mode.'}), 400

    if mode == 'team' and not race.allow_team_registration:
        return jsonify({'message': 'Team registration is not enabled for this race.'}), 400
    if mode == 'individual' and not race.allow_individual_registration:
        return jsonify({'message': 'Individual registration is not enabled for this race.'}), 400

    if members_count < 1:
        return jsonify({'message': 'members_count must be at least 1.'}), 400
    if mode == 'team' and members_count > race.max_team_size:
        return jsonify({'message': 'Team is larger than allowed for this race.'}), 400
    if mode == 'team' and members_count < race.min_team_size:
        return jsonify({'message': 'Team is smaller than required for this race.'}), 400
    if mode == 'individual' and members_count != 1:
        return jsonify({'message': 'Individual registration requires exactly one member.'}), 400

    frontend_url = (current_app.config.get('FRONTEND_URL') or '').rstrip('/')
    success_url = payload.get('success_url') or f"{frontend_url}/register/{registration_slug}?checkout=success"
    cancel_url = payload.get('cancel_url') or f"{frontend_url}/register/{registration_slug}?checkout=cancel"

    customer_email = (payload.get('customer_email') or '').strip().lower()
    customer_name = (payload.get('customer_name') or '').strip()
    if (not customer_email) and team.members:
        customer_email = next(
            (
                (member.email or '').strip().lower()
                for member in team.members
                if (member.email or '').strip()
            ),
            '',
        )
    if (not customer_name) and team.members:
        customer_name = next(
            (
                (member.name or '').strip()
                for member in team.members
                if (member.name or '').strip()
            ),
            '',
        )

    if mode == 'individual':
        individual_role = (payload.get('individual_role') or '').strip().lower()
        if individual_role not in ('driver', 'codriver'):
            return jsonify({'message': 'individual_role must be either driver or codriver for individual registration.'}), 400

        existing_confirmed_attempt = RegistrationPaymentAttempt.query.filter_by(
            registration_id=registration.id,
            payment_type=individual_role,
            status='confirmed',
        ).first()
        if existing_confirmed_attempt:
            return jsonify({'message': f"Payment is already confirmed for role '{individual_role}'."}), 400

        amount_cents = (
            race.registration_driver_amount_cents
            if individual_role == 'driver'
            else race.registration_codriver_amount_cents
        )
        payment_type = individual_role
    else:
        amount_cents = race.registration_team_amount_cents or current_app.config.get(
            'STRIPE_REGISTRATION_TEAM_AMOUNT',
            50,
        )
        payment_type = 'team'

    currency = race.registration_currency or current_app.config.get('STRIPE_CURRENCY', 'czk')

    try:
        session_data = create_registration_checkout_session(
            secret_key=current_app.config.get('STRIPE_RESTRICTED_KEY'),
            success_url=success_url,
            cancel_url=cancel_url,
            currency=currency,
            amount_cents=int(amount_cents) * 100,
            race_name=race.name,
            registration_slug=registration_slug,
            team_name=team_name,
            mode=mode,
            members_count=members_count,
            race_id=race.id,
            team_id=team_id,
            payment_type=payment_type,
            customer_email=customer_email or None,
            customer_name=customer_name or None,
        )
    except ValueError as exc:
        logger.error('Stripe checkout unavailable for race %s: %s', race.id, exc)
        return jsonify({'message': 'Payment provider is not configured.'}), 503
    except (RuntimeError, OSError, TypeError) as exc:
        logger.error('Stripe checkout creation failed for race %s: %s', race.id, exc)
        return jsonify({'message': 'Unable to initialize checkout.'}), 502

    logger.info(
        'Stripe checkout session created for race %s slug %s mode %s',
        race.id,
        registration_slug,
        mode,
    )

    existing_attempt = RegistrationPaymentAttempt.query.filter_by(
        stripe_session_id=session_data['session_id']
    ).first()
    if not existing_attempt:
        db.session.add(
            RegistrationPaymentAttempt(
                registration_id=registration.id,
                stripe_session_id=session_data['session_id'],
                payment_type=payment_type,
                status='pending',
                amount_cents=int(amount_cents) * 100,
                currency=(currency or '').lower(),
            )
        )

    registration.stripe_session_id = session_data['session_id']
    db.session.commit()

    return jsonify(
        {
            'checkout_url': session_data['checkout_url'],
            'session_id': session_data['session_id'],
            'publishable_key': current_app.config.get('STRIPE_PUBLISHABLE_KEY', ''),
        }
    ), 201


@race_registration_bp.route('/stripe/webhook/', methods=['POST'])
def stripe_registration_webhook():
    """
    Stripe webhook handler for registration checkout events.
    ---
    tags:
      - Races
    responses:
      200:
        description: Event processed, deduplicated, or ignored successfully
      400:
        description: Invalid webhook signature/payload or missing metadata
      404:
        description: Registration referenced in metadata not found
      503:
        description: Webhook/payment provider not configured
    """
    payload = request.get_data(as_text=False)
    signature = request.headers.get('Stripe-Signature', '')

    try:
        event = construct_stripe_event(
            payload=payload,
            signature=signature,
            webhook_secret=current_app.config.get('STRIPE_WEBHOOK_SECRET'),
            secret_key=current_app.config.get('STRIPE_RESTRICTED_KEY'),
        )
    except ValueError as exc:
        if 'not configured' in str(exc).lower():
            logger.warning('Stripe webhook configuration error: %s', exc)
            return jsonify({'message': 'Webhook is not configured.'}), 503

        logger.warning('Stripe webhook payload/signature validation failed: %s', exc)
        return jsonify({'message': 'Invalid webhook signature.'}), 400
    except (RuntimeError, OSError, TypeError) as exc:
        logger.warning('Stripe webhook signature verification failed: %s', exc)
        return jsonify({'message': 'Invalid webhook signature.'}), 400

    if event.get('type') != 'checkout.session.completed':
        logger.debug('Stripe webhook event type ignored: %s', event.get('type'))
        return jsonify({'message': 'Event ignored'}), 200

    session = event.get('data', {}).get('object', {})
    metadata = session.get('metadata') or {}
    session_id = session.get('id')

    try:
        race_id = int(metadata.get('race_id'))
        team_id = int(metadata.get('team_id'))
    except (TypeError, ValueError):
        logger.warning('Stripe webhook invalid race/team metadata: %s', metadata)
        return jsonify({'message': 'Missing metadata.'}), 400

    if not session_id:
        logger.warning('Stripe webhook missing session id')
        return jsonify({'message': 'Missing metadata.'}), 400

    registration = Registration.query.filter_by(race_id=race_id, team_id=team_id).first()
    if not registration:
        logger.warning(
            'Stripe webhook registration not found for race %s team %s',
            race_id,
            team_id,
        )
        return jsonify({'message': 'Registration not found.'}), 404

    payment_type = (metadata.get('payment_type') or '').strip().lower()
    if payment_type not in ('team', 'driver', 'codriver'):
        payment_type = 'team' if metadata.get('mode') == 'team' else 'driver'

    if registration.payment_confirmed and payment_type in ('team', 'driver'):
        if registration.stripe_session_id == session_id:
            logger.info(
                'Stripe webhook duplicate event ignored for race %s team %s session %s',
                race_id,
                team_id,
                session_id,
            )
            return jsonify({'message': 'Payment already confirmed.'}), 200

        logger.warning(
            'Stripe webhook received additional %s payment for already confirmed registration (race %s, team %s, existing %s, incoming %s)',
            payment_type,
            race_id,
            team_id,
            registration.stripe_session_id,
            session_id,
        )
        return jsonify({'message': 'Payment already confirmed.'}), 200

    payment_attempt = RegistrationPaymentAttempt.query.filter_by(stripe_session_id=session_id).first()
    if not payment_attempt:
        payment_attempt = RegistrationPaymentAttempt(
            registration_id=registration.id,
            stripe_session_id=session_id,
            payment_type=payment_type,
            status='pending',
            amount_cents=session.get('amount_total'),
            currency=(session.get('currency') or '').lower() or None,
        )
        db.session.add(payment_attempt)

    if payment_attempt.status == 'confirmed':
        logger.info(
            'Stripe webhook duplicate event ignored for race %s team %s session %s',
            race_id,
            team_id,
            session_id,
        )
        return jsonify({'message': 'Payment already confirmed.'}), 200

    payment_attempt.status = 'confirmed'
    payment_attempt.confirmed_at = datetime.now()

    was_paid_before = bool(registration.payment_confirmed)
    if payment_attempt.payment_type in ('team', 'driver'):
        registration.payment_confirmed = True
        registration.payment_confirmed_at = payment_attempt.confirmed_at
        registration.stripe_session_id = session_id

    race = Race.query.filter_by(id=registration.race_id).first()
    team = Team.query.filter_by(id=registration.team_id).first()
    category = RaceCategory.query.filter_by(id=registration.race_category_id).first()

    email_sent_for_all = True
    admin_notification_sent = True
    if (not was_paid_before) and registration.payment_confirmed and team and race:
        receipt_amount_cents = payment_attempt.amount_cents or session.get('amount_total')
        receipt_currency = payment_attempt.currency or (session.get('currency') or '').lower() or None
        receipt_reference = session_id
        receipt_confirmed_at = payment_attempt.confirmed_at
        receipt_url = get_checkout_receipt_url(
            session_object=session,
            secret_key=current_app.config.get('STRIPE_RESTRICTED_KEY'),
        )

        for member in team.members:
            reset_token = generate_reset_token()
            member.set_reset_token(reset_token, datetime.now() + timedelta(days=7))
            email_language = _resolve_language(race, member)
            try:
                send_result = EmailService.send_registration_confirmation_email(
                    user_email=member.email,
                    user_name=member.name or member.email,
                    race_name=_resolve_race_name(race, email_language),
                    team_name=team.name,
                    race_category=_resolve_race_category_name(category, race, email_language),
                    reset_token=reset_token,
                    language=email_language,
                    payment_amount_cents=receipt_amount_cents,
                    payment_currency=receipt_currency,
                    payment_reference=receipt_reference,
                    payment_confirmed_at=receipt_confirmed_at,
                    payment_receipt_url=receipt_url,
                    race_greeting=_resolve_race_greeting(race, email_language),
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
                registration=registration,
                user_id=member.id,
                email_address=member.email,
                template_type='registration_confirmation',
                send_result=send_result,
            )

            if not normalize_email_send_result(send_result)['success']:
                email_sent_for_all = False

        admin_notification_sent = _notify_admins_registration_completed(
            race=race,
            team=team,
            registration=registration,
            payment_attempt=payment_attempt,
        )
        if not admin_notification_sent:
            logger.warning(
                'Admin registration-completed notification failed for race %s team %s',
                registration.race_id,
                registration.team_id,
            )

    if registration.payment_confirmed:
        registration.email_sent = email_sent_for_all and bool(team and team.members)

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        existing_attempt = RegistrationPaymentAttempt.query.filter_by(stripe_session_id=session_id).first()
        latest_registration = Registration.query.filter_by(race_id=race_id, team_id=team_id).first()

        if existing_attempt or (latest_registration and latest_registration.payment_confirmed):
            logger.info(
                'Stripe webhook commit conflict treated as duplicate for race %s team %s session %s',
                race_id,
                team_id,
                session_id,
            )
            return jsonify({'message': 'Payment already confirmed.'}), 200

        logger.warning(
            'Stripe webhook commit conflict ignored without confirmed state for race %s team %s session %s',
            race_id,
            team_id,
            session_id,
        )
        return jsonify({'message': 'Event ignored'}), 200

    logger.info(
        'Stripe payment confirmed for race %s team %s session %s',
        race_id,
        team_id,
        session_id,
    )
    return jsonify({'message': 'Payment confirmed.'}), 200


@race_registration_bp.route('/brevo/webhook/', methods=['POST'])
def brevo_email_webhook():
    """
    Brevo webhook handler for asynchronous email delivery events.
    ---
    tags:
      - Races
    parameters:
      - in: header
        name: X-Brevo-Webhook-Secret
        schema:
          type: string
        required: true
        description: Shared secret header used to authenticate Brevo webhook requests.
    requestBody:
      required: true
      content:
        application/json:
          schema:
            oneOf:
              - type: object
                description: Single Brevo event payload
              - type: array
                items:
                  type: object
                description: Batch of Brevo event payloads
    responses:
      200:
        description: Webhook events processed successfully
      400:
        description: Invalid JSON payload
      401:
        description: Invalid webhook secret header
      503:
        description: Brevo webhook secret is not configured
    """
    secret = (current_app.config.get('BREVO_WEBHOOK_SECRET') or '').strip()
    secret_header = (current_app.config.get('BREVO_WEBHOOK_SECRET_HEADER') or 'X-Brevo-Webhook-Secret').strip()

    if not secret:
        logger.warning('Brevo webhook called but BREVO_WEBHOOK_SECRET is not configured')
        return jsonify({'message': 'Webhook is not configured.'}), 503

    provided = request.headers.get(secret_header, '')
    if provided != secret:
        logger.warning('Brevo webhook authorization failed: missing/invalid secret header %s', secret_header)
        return jsonify({'message': 'Invalid webhook secret.'}), 401

    payload = request.get_json(silent=True)
    if payload is None:
        return jsonify({'message': 'Invalid payload.'}), 400

    events = payload if isinstance(payload, list) else [payload]

    validated_events = []
    schema = BrevoWebhookEventSchema()
    for index, event in enumerate(events):
        if not isinstance(event, dict):
            return jsonify({'message': 'Invalid payload.', 'errors': {str(index): ['Event must be an object.']}}), 400
        try:
            schema.load(event)
        except ValidationError as err:
            return jsonify({'message': 'Invalid payload.', 'errors': {str(index): err.messages}}), 400
        validated_events.append(event)

    updated = 0
    skipped = 0

    for event in validated_events:
        result = apply_brevo_event(event)
        updated += int(result.get('updated', 0))
        skipped += int(result.get('skipped', 0))

    db.session.commit()
    logger.info('Brevo webhook processed %s event(s): updated=%s skipped=%s', len(validated_events), updated, skipped)
    return jsonify({'message': 'Webhook processed.', 'updated': updated, 'skipped': skipped}), 200


