import logging
from datetime import datetime, timedelta
from flask import Blueprint, jsonify, request, current_app
from marshmallow import ValidationError
from flask_jwt_extended import jwt_required, get_jwt_identity

from app import db
from app.models import Race, CheckpointLog, TaskLog, User, RaceCategory
from app.models import Registration, Team, Checkpoint, Task, RaceTranslation, RegistrationPaymentAttempt
from app.routes.race_api.checkpoints import checkpoints_bp
from app.routes.race_api.tasks import tasks_bp
from app.routes.race_api.race_categories import race_categories_bp
from app.routes.admin import admin_required
from app.utils import parse_datetime
from app.schemas import RaceCreateSchema, RaceUpdateSchema
from app.schemas import RaceTranslationCreateSchema, RaceTranslationUpdateSchema
from app.constants import SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE
from app.services.stripe_service import create_registration_checkout_session
from app.services.stripe_service import construct_stripe_event
from app.services.stripe_service import get_checkout_receipt_url
from app.services.email_service import EmailService, generate_reset_token

logger = logging.getLogger(__name__)


def _registration_mode(race):
    return 'team' if race.allow_team_registration else 'individual'


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
            for attempt in attempts
        ],
    }
    return is_paid, details

# TODO: move all below translation routine to some common package
def _resolve_race_greeting(race, language=None):
    greeting = race.race_greeting
    lang = (language or '').strip().lower()
    if not lang or lang not in (race.supported_languages or []):
        return greeting

    translation = RaceTranslation.query.filter_by(race_id=race.id, language=lang).first()
    if translation and translation.race_greeting is not None:
        return translation.race_greeting
    return greeting

def _resolve_race_name(race, language=None):
    name = race.name
    lang = (language or '').strip().lower()
    if not lang or lang not in (race.supported_languages or []):
        return name

    translation = RaceTranslation.query.filter_by(race_id=race.id, language=lang).first()
    if translation and translation.name:
        return translation.name
    return name

def _resolve_race_category_name(race_category, race, language=None):
    if not race_category:
        return "N/A"

    name = race_category.name
    lang = (language or '').strip().lower()
    if not lang or not race or lang not in (race.supported_languages or []):
        return name

    translation = next(
        (item for item in (race_category.translations or []) if item.language == lang),
        None,
    )
    if translation and translation.name:
        return translation.name
    return name


def _get_registration_admin_recipients():
    """Resolve admin recipients from app config.

    Supported configuration:
    - REGISTRATION_ADMIN_EMAILS as list/tuple/set
    - REGISTRATION_ADMIN_EMAILS as comma/semicolon separated string
    - ADMIN_EMAIL as fallback single address
    """
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
    """Send best-effort notification email to configured admins."""
    recipients = _get_registration_admin_recipients()
    if not recipients:
        return True

    all_sent = True
    for admin_email in recipients:
        sent = EmailService.send_admin_registration_completed_email(
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
        )
        if not sent:
            all_sent = False

    return all_sent

race_bp = Blueprint("race", __name__)
race_bp.register_blueprint(checkpoints_bp, url_prefix='/<int:race_id>/checkpoints')
race_bp.register_blueprint(tasks_bp, url_prefix='/<int:race_id>/tasks')
race_bp.register_blueprint(race_categories_bp, url_prefix='/<int:race_id>/categories')

# tested by test_races.py -> test_get_all_races
@race_bp.route("/", methods=["GET"])
def get_all_races():
    """
    Get all races.
    ---
    tags:
      - Races
    parameters:
      - in: query
        name: lang
        schema:
          type: string
        required: false
        description: Optional language code for translated fields
    responses:
      200:
        description: A list of all races
        content:
          application/json:
            schema:
              type: array
              items:
                $ref: '#/components/schemas/RaceObject'
    """
    races = Race.query.all()
    language = request.args.get("lang")

    result = []
    for race in races:
        name = race.name
        description = race.description
        race_greeting = race.race_greeting

        if language:
            if language in (race.supported_languages or []):
                translation = RaceTranslation.query.filter_by(
                    race_id=race.id,
                    language=language,
                ).first()
                if translation:
                    name = translation.name
                    description = translation.description
                    if translation.race_greeting is not None:
                        race_greeting = translation.race_greeting
            else:
                logger.warning("Race %s requested with unsupported language %s, using default", race.id, language)

        result.append({
            "id": race.id,
            "name": name,
            "description": description,
            "race_greeting": race_greeting,
            "start_showing_checkpoints_at": race.start_showing_checkpoints_at,
            "end_showing_checkpoints_at": race.end_showing_checkpoints_at,
            "start_logging_at": race.start_logging_at,
            "end_logging_at": race.end_logging_at,
            "registration_slug": race.registration_slug,
            "registration_enabled": race.registration_enabled,
            "min_team_size": race.min_team_size,
            "max_team_size": race.max_team_size,
            "allow_team_registration": race.allow_team_registration,
            "allow_individual_registration": race.allow_individual_registration,
            "registration_currency": race.registration_currency,
            "registration_pricing_strategy": race.registration_pricing_strategy,
            "registration_team_amount_cents": race.registration_team_amount_cents,
            "registration_individual_amount_cents": race.registration_individual_amount_cents,
            "registration_driver_amount_cents": race.registration_driver_amount_cents,
            "registration_codriver_amount_cents": race.registration_codriver_amount_cents,
            "supported_languages": race.supported_languages,
            "default_language": race.default_language,
        })

    return jsonify(result)

# tested by test_races.py -> test_get_single_race
@race_bp.route("/<int:race_id>/", methods=["GET"])
def get_single_race(race_id):
    """
    Get a single race.
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
      - in: query
        name: lang
        schema:
          type: string
        required: false
        description: Optional language code for translated fields
    responses:
      200:
        description: Details of a specific race.
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/RaceObject'
      404:
        description: Race not found
    """
    race = Race.query.filter_by(id=race_id).first_or_404()
    language = request.args.get("lang")
    name = race.name
    description = race.description
    race_greeting = race.race_greeting
    if language:
        if language not in (race.supported_languages or []):
            logger.warning("Race %s requested with unsupported language %s, using default", race_id, language)
        else:
            translation = RaceTranslation.query.filter_by(
                race_id=race_id,
                language=language,
            ).first()
            if translation:
                name = translation.name
                description = translation.description
                if translation.race_greeting is not None:
                    race_greeting = translation.race_greeting
    return jsonify({"id": race.id,
                    "name": name,
                    "description": description,
                "race_greeting": race_greeting,
                    "start_showing_checkpoints_at": race.start_showing_checkpoints_at,
                    "end_showing_checkpoints_at": race.end_showing_checkpoints_at,
                    "start_logging_at": race.start_logging_at,
                    "end_logging_at": race.end_logging_at,
                    "registration_slug": race.registration_slug,
                    "registration_enabled": race.registration_enabled,
                    "min_team_size": race.min_team_size,
                    "max_team_size": race.max_team_size,
                    "allow_team_registration": race.allow_team_registration,
                    "allow_individual_registration": race.allow_individual_registration,
                    "registration_currency": race.registration_currency,
                    "registration_pricing_strategy": race.registration_pricing_strategy,
                    "registration_team_amount_cents": race.registration_team_amount_cents,
                    "registration_individual_amount_cents": race.registration_individual_amount_cents,
                    "registration_driver_amount_cents": race.registration_driver_amount_cents,
                    "registration_codriver_amount_cents": race.registration_codriver_amount_cents,
                    "supported_languages": race.supported_languages,
                    "default_language": race.default_language}), 200

# add race
# tested by test_races.py -> test_create_race
@race_bp.route('/', methods=['POST'])
@admin_required()
def create_race():
    """
    Create race, requires admin privileges.
    ---
    tags:
      - Races
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              name:
                type: string
                description: The name of the race
                example: "City Adventure"
              description:
                type: string
                description: A description of the race
                example: "A fun city-wide race."
    security:
      - BearerAuth: []
    responses:
      201:
        description: Created race
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/RaceObject'
    """
    raw_data = request.get_json(silent=True) or {}
    data = RaceCreateSchema().load(raw_data)

    start_showing_checkpoints_at = parse_datetime(data['start_showing_checkpoints_at'])
    end_showing_checkpoints_at = parse_datetime(data['end_showing_checkpoints_at'])
    start_logging_at = parse_datetime(data['start_logging_at'])
    end_logging_at = parse_datetime(data['end_logging_at'])
    new_race = Race(name=data['name'],
                    description=data['description'],
                    race_greeting=data.get('race_greeting'),
                    start_showing_checkpoints_at=start_showing_checkpoints_at,
                    end_showing_checkpoints_at=end_showing_checkpoints_at,
                    start_logging_at=start_logging_at,
                    end_logging_at=end_logging_at,
                    registration_slug=data.get("registration_slug"),
                    registration_enabled=data.get("registration_enabled", False),
                    min_team_size=data.get("min_team_size", 1),
                    max_team_size=data.get("max_team_size", 2),
                    allow_team_registration=data.get("allow_team_registration", True),
                    allow_individual_registration=data.get("allow_individual_registration", False),
                    registration_currency=data.get("registration_currency", "czk"),
                    registration_pricing_strategy=data.get("registration_pricing_strategy", "team_flat"),
                    registration_team_amount_cents=data.get("registration_team_amount_cents", 50),
                    registration_individual_amount_cents=data.get("registration_individual_amount_cents", 25),
                    registration_driver_amount_cents=data.get("registration_driver_amount_cents", 25),
                    registration_codriver_amount_cents=data.get("registration_codriver_amount_cents", 15),
                    supported_languages=data.get("supported_languages", list(SUPPORTED_LANGUAGES)),
                    default_language=data.get("default_language", DEFAULT_LANGUAGE))
    db.session.add(new_race)
    db.session.commit()
    logger.info("New race created: %s (ID: %s)", new_race.name, new_race.id)
    return jsonify({
      "id": new_race.id,
      "name": new_race.name,
      "description": new_race.description,
      "race_greeting": new_race.race_greeting,
      "start_showing_checkpoints_at": new_race.start_showing_checkpoints_at,
      "end_showing_checkpoints_at": new_race.end_showing_checkpoints_at,
      "start_logging_at": new_race.start_logging_at,
      "end_logging_at": new_race.end_logging_at,
      "registration_slug": new_race.registration_slug,
      "registration_enabled": new_race.registration_enabled,
      "min_team_size": new_race.min_team_size,
      "max_team_size": new_race.max_team_size,
      "allow_team_registration": new_race.allow_team_registration,
      "allow_individual_registration": new_race.allow_individual_registration,
      "registration_currency": new_race.registration_currency,
      "registration_pricing_strategy": new_race.registration_pricing_strategy,
      "registration_team_amount_cents": new_race.registration_team_amount_cents,
      "registration_individual_amount_cents": new_race.registration_individual_amount_cents,
      "registration_driver_amount_cents": new_race.registration_driver_amount_cents,
      "registration_codriver_amount_cents": new_race.registration_codriver_amount_cents,
      "supported_languages": new_race.supported_languages,
      "default_language": new_race.default_language,
    }), 201

# tested by test_races.py -> test_update_race
@race_bp.route('/<int:race_id>/', methods=['PUT'])
@admin_required()
def update_race(race_id):
    """
    Update a race (admin only).
    Accepts partial payload; only provided fields are updated.
    Fields accepted (examples):
      - name: string
      - description: string
      - start_showing_checkpoints_at: ISO datetime string
      - end_showing_checkpoints_at: ISO datetime string
      - start_logging_at: ISO datetime string
      - end_logging_at: ISO datetime string
    """
    raw_data = request.get_json(silent=True) or {}
    data = RaceUpdateSchema().load(raw_data, partial=True)
    race = Race.query.filter_by(id=race_id).first_or_404()

    if "supported_languages" in data or "default_language" in data:
        supported = data.get("supported_languages", race.supported_languages or list(SUPPORTED_LANGUAGES))
        default = data.get("default_language", race.default_language or DEFAULT_LANGUAGE)
        if default not in supported:
            raise ValidationError({"default_language": ["default_language must be in supported_languages"]})

    min_team_size = data.get("min_team_size", race.min_team_size)
    max_team_size = data.get("max_team_size", race.max_team_size)
    if min_team_size > max_team_size:
        raise ValidationError({"min_team_size": ["min_team_size must be <= max_team_size"]})

    allow_team_registration = data.get("allow_team_registration", race.allow_team_registration)
    allow_individual_registration = data.get("allow_individual_registration", race.allow_individual_registration)
    if allow_team_registration == allow_individual_registration:
        raise ValidationError({"allow_team_registration": ["Exactly one registration mode must be enabled"]})

    registration_enabled = data.get("registration_enabled", race.registration_enabled)
    registration_slug = data.get("registration_slug", race.registration_slug)
    if registration_enabled and not registration_slug:
        raise ValidationError({"registration_slug": ["registration_slug is required when registration_enabled is true"]})

    # simple scalar fields
    if 'name' in data:
        race.name = data.get('name')
    if 'description' in data:
        race.description = data.get('description')
    if 'race_greeting' in data:
        race.race_greeting = data.get('race_greeting')
    if 'supported_languages' in data:
        race.supported_languages = data.get('supported_languages')
    if 'default_language' in data:
        race.default_language = data.get('default_language')
    if 'registration_slug' in data:
        race.registration_slug = data.get('registration_slug')
    if 'registration_enabled' in data:
        race.registration_enabled = data.get('registration_enabled')
    if 'min_team_size' in data:
        race.min_team_size = data.get('min_team_size')
    if 'max_team_size' in data:
        race.max_team_size = data.get('max_team_size')
    if 'allow_team_registration' in data:
        race.allow_team_registration = data.get('allow_team_registration')
    if 'allow_individual_registration' in data:
        race.allow_individual_registration = data.get('allow_individual_registration')
    if 'registration_currency' in data:
        race.registration_currency = data.get('registration_currency')
    if 'registration_pricing_strategy' in data:
        race.registration_pricing_strategy = data.get('registration_pricing_strategy')
    if 'registration_team_amount_cents' in data:
        race.registration_team_amount_cents = data.get('registration_team_amount_cents')
    if 'registration_individual_amount_cents' in data:
        race.registration_individual_amount_cents = data.get('registration_individual_amount_cents')
    if 'registration_driver_amount_cents' in data:
        race.registration_driver_amount_cents = data.get('registration_driver_amount_cents')
    if 'registration_codriver_amount_cents' in data:
        race.registration_codriver_amount_cents = data.get('registration_codriver_amount_cents')

    # datetime fields (accept several possible keys but prefer explicit *_at keys)
    if 'start_showing_checkpoints_at' in data:
        race.start_showing_checkpoints_at = parse_datetime(data.get('start_showing_checkpoints_at'))
    elif 'start_showing_checkpoints' in data:
        race.start_showing_checkpoints_at = parse_datetime(data.get('start_showing_checkpoints'))

    if 'end_showing_checkpoints_at' in data:
        race.end_showing_checkpoints_at = parse_datetime(data.get('end_showing_checkpoints_at'))
    elif 'end_showing_checkpoints' in data:
        race.end_showing_checkpoints_at = parse_datetime(data.get('end_showing_checkpoints'))

    if 'start_logging_at' in data:
        race.start_logging_at = parse_datetime(data.get('start_logging_at'))
    elif 'start_logging' in data:
        race.start_logging_at = parse_datetime(data.get('start_logging'))

    if 'end_logging_at' in data:
        race.end_logging_at = parse_datetime(data.get('end_logging_at'))
    elif 'end_logging' in data:
        race.end_logging_at = parse_datetime(data.get('end_logging'))

    db.session.add(race)
    db.session.commit()
    logger.info("Race %s updated: %s", race_id, race.name)
    return jsonify({
        "id": race.id,
        "name": race.name,
        "description": race.description,
        "race_greeting": race.race_greeting,
        "start_showing_checkpoints_at": race.start_showing_checkpoints_at,
        "end_showing_checkpoints_at": race.end_showing_checkpoints_at,
        "start_logging_at": race.start_logging_at,
        "end_logging_at": race.end_logging_at,
        "registration_slug": race.registration_slug,
        "registration_enabled": race.registration_enabled,
        "min_team_size": race.min_team_size,
        "max_team_size": race.max_team_size,
        "allow_team_registration": race.allow_team_registration,
        "allow_individual_registration": race.allow_individual_registration,
        "registration_currency": race.registration_currency,
        "registration_pricing_strategy": race.registration_pricing_strategy,
        "registration_team_amount_cents": race.registration_team_amount_cents,
        "registration_individual_amount_cents": race.registration_individual_amount_cents,
        "registration_driver_amount_cents": race.registration_driver_amount_cents,
        "registration_codriver_amount_cents": race.registration_codriver_amount_cents,
        "supported_languages": race.supported_languages,
        "default_language": race.default_language,
    }), 200



@race_bp.route('/registration/<string:registration_slug>/', methods=['GET'])
def get_race_by_registration_slug(registration_slug):
    """Public endpoint for resolving race registration settings by race slug."""
    race = Race.query.filter_by(registration_slug=registration_slug).first_or_404()
    if not race.registration_enabled:
        return jsonify({"message": "Registration is not enabled for this race."}), 404
    if race.allow_team_registration == race.allow_individual_registration:
        return jsonify({"message": "Race registration mode is misconfigured."}), 409

    language = request.args.get("lang")
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
                "id": category.id,
                "name": category_name,
                "description": category_description,
            }
        )

    return jsonify({
        "id": race.id,
        "registration_slug": race.registration_slug,
        "registration_enabled": race.registration_enabled,
        "name": name,
        "description": description,
        "race_greeting": race_greeting,
        "min_team_size": race.min_team_size,
        "max_team_size": race.max_team_size,
        "allow_team_registration": race.allow_team_registration,
        "allow_individual_registration": race.allow_individual_registration,
        "registration_currency": race.registration_currency,
        "registration_pricing_strategy": race.registration_pricing_strategy,
        "registration_team_amount_cents": race.registration_team_amount_cents,
        "registration_individual_amount_cents": race.registration_individual_amount_cents,
        "registration_driver_amount_cents": race.registration_driver_amount_cents,
        "registration_codriver_amount_cents": race.registration_codriver_amount_cents,
        "categories": categories,
        "supported_languages": race.supported_languages,
        "default_language": race.default_language,
    }), 200


@race_bp.route('/registration/<string:registration_slug>/payment-status/', methods=['GET'])
def get_registration_payment_status_by_slug(registration_slug):
    """Public endpoint returning payment confirmation state for a race registration."""
    race = Race.query.filter_by(registration_slug=registration_slug).first_or_404()
    if not race.registration_enabled:
        return jsonify({"message": "Registration is not enabled for this race."}), 404

    team_id_raw = request.args.get("team_id")
    if not team_id_raw:
        return jsonify({"message": "team_id is required."}), 400

    try:
        team_id = int(team_id_raw)
    except (TypeError, ValueError):
        return jsonify({"message": "team_id must be an integer."}), 400

    registration = Registration.query.filter_by(race_id=race.id, team_id=team_id).first()
    if not registration:
        return jsonify({"message": "Registration not found."}), 404

    payment_confirmed, payment_details = _payment_summary(registration, race)

    return jsonify({
        "race_id": race.id,
        "team_id": team_id,
        "payment_confirmed": bool(payment_confirmed),
        "payment_confirmed_at": registration.payment_confirmed_at.isoformat() if registration.payment_confirmed_at else None,
        "payment_details": payment_details,
    }), 200


@race_bp.route('/registration/<string:registration_slug>/checkout/', methods=['POST'])
def create_checkout_by_registration_slug(registration_slug):
    """Create Stripe Checkout session for public race registration page."""
    race = Race.query.filter_by(registration_slug=registration_slug).first_or_404()
    if not race.registration_enabled:
        return jsonify({"message": "Registration is not enabled for this race."}), 404
    if race.allow_team_registration == race.allow_individual_registration:
        return jsonify({"message": "Race registration mode is misconfigured."}), 409

    payload = request.get_json(silent=True) or {}
    team_id = payload.get('team_id')
    team_name = (payload.get('team_name') or '').strip()
    mode = payload.get('mode') or ('team' if race.allow_team_registration else 'individual')
    members_count = int(payload.get('members_count') or 1)

    if not team_id:
        return jsonify({"message": "team_id is required."}), 400

    try:
        team_id = int(team_id)
    except (TypeError, ValueError):
        return jsonify({"message": "team_id must be an integer."}), 400

    team = Team.query.filter_by(id=team_id).first_or_404()

    registration = Registration.query.filter_by(race_id=race.id, team_id=team_id).first()
    if not registration:
        return jsonify({"message": "Registration must be created before checkout."}), 404

    current_mode = _registration_mode(race)
    registration_paid, _ = _payment_summary(registration, race)
    if registration_paid and current_mode == 'team':
        return jsonify({"message": "Payment is already confirmed for this registration."}), 400

    if mode not in ('team', 'individual'):
        return jsonify({"message": "Invalid registration mode."}), 400

    if mode == 'team' and not race.allow_team_registration:
        return jsonify({"message": "Team registration is not enabled for this race."}), 400
    if mode == 'individual' and not race.allow_individual_registration:
        return jsonify({"message": "Individual registration is not enabled for this race."}), 400

    if members_count < 1:
        return jsonify({"message": "members_count must be at least 1."}), 400
    if mode == 'team' and members_count > race.max_team_size:
        return jsonify({"message": "Team is larger than allowed for this race."}), 400
    if mode == 'team' and members_count < race.min_team_size:
        return jsonify({"message": "Team is smaller than required for this race."}), 400
    if mode == 'individual' and members_count != 1:
        return jsonify({"message": "Individual registration requires exactly one member."}), 400

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
            return jsonify({"message": "individual_role must be either driver or codriver for individual registration."}), 400

        existing_confirmed_attempt = RegistrationPaymentAttempt.query.filter_by(
            registration_id=registration.id,
            payment_type=individual_role,
            status='confirmed',
        ).first()
        if existing_confirmed_attempt:
            return jsonify({"message": f"Payment is already confirmed for role '{individual_role}'."}), 400

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
            secret_key=current_app.config.get('STRIPE_API_KEY'),
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
        logger.error("Stripe checkout unavailable for race %s: %s", race.id, exc)
        return jsonify({"message": "Payment provider is not configured."}), 503
    except (RuntimeError, OSError, TypeError) as exc:
        logger.error("Stripe checkout creation failed for race %s: %s", race.id, exc)
        return jsonify({"message": "Unable to initialize checkout."}), 502

    logger.info(
        "Stripe checkout session created for race %s slug %s mode %s",
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

    return jsonify({
        "checkout_url": session_data['checkout_url'],
        "session_id": session_data['session_id'],
        "publishable_key": current_app.config.get('STRIPE_PUBLISHABLE_KEY', ''),
    }), 201

@race_bp.route('/registration/stripe/webhook/', methods=['POST'])
def stripe_registration_webhook():
    """Stripe webhook handler for registration checkout events."""
    payload = request.get_data(as_text=False)
    signature = request.headers.get('Stripe-Signature', '')

    try:
        event = construct_stripe_event(
            payload=payload,
            signature=signature,
            webhook_secret=current_app.config.get('STRIPE_WEBHOOK_SECRET'),
            secret_key=current_app.config.get('STRIPE_API_KEY'),
        )
    except ValueError as exc:
        if "not configured" in str(exc).lower():
            logger.error("Stripe webhook configuration error: %s", exc)
            return jsonify({"message": "Webhook is not configured."}), 503

        logger.error("Stripe webhook payload/signature validation failed: %s", exc)
        return jsonify({"message": "Invalid webhook signature."}), 400
    except (RuntimeError, OSError, TypeError) as exc:
        logger.error("Stripe webhook signature verification failed: %s", exc)
        return jsonify({"message": "Invalid webhook signature."}), 400

    if event.get('type') != 'checkout.session.completed':
        return jsonify({"message": "Event ignored"}), 200

    session = event.get('data', {}).get('object', {})
    metadata = session.get('metadata') or {}
    session_id = session.get('id')

    try:
        race_id = int(metadata.get('race_id'))
        team_id = int(metadata.get('team_id'))
    except (TypeError, ValueError):
        logger.error("Stripe webhook invalid race/team metadata: %s", metadata)
        return jsonify({"message": "Missing metadata."}), 400

    if not session_id:
        logger.error("Stripe webhook missing session id")
        return jsonify({"message": "Missing metadata."}), 400

    registration = Registration.query.filter_by(race_id=race_id, team_id=team_id).first()
    if not registration:
        logger.error(
            "Stripe webhook registration not found for race %s team %s",
            race_id,
            team_id,
        )
        return jsonify({"message": "Registration not found."}), 404

    payment_type = (metadata.get('payment_type') or '').strip().lower()
    if payment_type not in ('team', 'driver', 'codriver'):
        payment_type = 'team' if metadata.get('mode') == 'team' else 'driver'

    if registration.payment_confirmed and payment_type in ('team', 'driver'):
        if registration.stripe_session_id == session_id:
            logger.info(
                "Stripe webhook duplicate event ignored for race %s team %s session %s",
                race_id,
                team_id,
                session_id,
            )
            return jsonify({"message": "Payment already confirmed."}), 200

        logger.warning(
            "Stripe webhook received additional %s payment for already confirmed registration (race %s, team %s, existing %s, incoming %s)",
            payment_type,
            race_id,
            team_id,
            registration.stripe_session_id,
            session_id,
        )
        return jsonify({"message": "Payment already confirmed."}), 200

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
            "Stripe webhook duplicate event ignored for race %s team %s session %s",
            race_id,
            team_id,
            session_id,
        )
        return jsonify({"message": "Payment already confirmed."}), 200

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
            secret_key=current_app.config.get('STRIPE_API_KEY'),
        )

        for member in team.members:
            reset_token = generate_reset_token()
            member.set_reset_token(reset_token, datetime.now() + timedelta(days=7))
            sent = EmailService.send_registration_confirmation_email(
                user_email=member.email,
                user_name=member.name or member.email,
                race_name=_resolve_race_name(race, member.preferred_language),
                team_name=team.name,
                race_category=_resolve_race_category_name(category, race, member.preferred_language),
                reset_token=reset_token,
                language=member.preferred_language,
                payment_amount_cents=receipt_amount_cents,
                payment_currency=receipt_currency,
                payment_reference=receipt_reference,
                payment_confirmed_at=receipt_confirmed_at,
                payment_receipt_url=receipt_url,
                race_greeting=_resolve_race_greeting(race, member.preferred_language),
            )
            if not sent:
                email_sent_for_all = False

        admin_notification_sent = _notify_admins_registration_completed(
            race=race,
            team=team,
            registration=registration,
            payment_attempt=payment_attempt,
        )
        if not admin_notification_sent:
            logger.warning(
                "Admin registration-completed notification failed for race %s team %s",
                registration.race_id,
                registration.team_id,
            )

    if registration.payment_confirmed:
        registration.email_sent = email_sent_for_all and bool(team and team.members)
    db.session.commit()

    logger.info(
        "Stripe payment confirmed for race %s team %s session %s",
        race_id,
        team_id,
        session_id,
    )
    return jsonify({"message": "Payment confirmed."}), 200

# delete race
# tested by test_races.py -> test_create_race
@race_bp.route('/<int:race_id>/', methods=['DELETE'])
@admin_required()
def delete_race(race_id):
    """
    Delete a race by its ID.
    Only possible if the race has no checkpoints, teams, or visits associated.
    ---
    tags:
      - Races
    parameters:
      - in: path
        name: race_id
        schema:
          type: integer
        required: true
        description: ID of the race to delete
    security:
      - BearerAuth: []
    responses:
      200:
        description: Race deleted successfully
        content:
          application/json:
            schema:
              type: object
              properties:
                message:
                  type: string
                  example: Race deleted successfully
      400:
        description: Cannot delete the race due to existing checkpoints, teams, or visits
        content:
          application/json:
            schema:
              type: object
              properties:
                message:
                  type: string
                  example: Cannot delete the race, it has checkpoints associated with it.
      404:
        description: Race not found
        content:
          application/json:
            schema:
              type: object
              properties:
                message:
                  type: string
                  example: Race not found
    """
    race = Race.query.filter_by(id=race_id).first_or_404()
    if race:
        if race.checkpoints:
            logger.error("Cannot delete race %s: has %s checkpoints", race_id, len(race.checkpoints))
            return jsonify({"message": "Cannot delete the race, it has checkpoints associated with it."}), 400
        if race.registrations:
            logger.error("Cannot delete race %s: has %s registrations", race_id, len(race.registrations))
            return jsonify({"message": "Cannot delete the race, it has registrations associated with it."}), 400
        if race.tasks:
            logger.error("Cannot delete race %s: has %s tasks", race_id, len(race.tasks))
            return jsonify({"message": "Cannot delete the race, it has tasks associated with it."}), 400

        checkpoint_logs = CheckpointLog.query.filter_by(race_id=race_id).all()
        if checkpoint_logs:
            logger.error("Cannot delete race %s: has %s checkpoint visits", race_id, len(checkpoint_logs))
            return jsonify({"message": "Cannot delete the race, it has visits associated with it."}), 400

        task_logs = TaskLog.query.filter_by(race_id=race_id).all()
        if task_logs:
            logger.error("Cannot delete race %s: has %s task completions", race_id, len(task_logs))
            return jsonify({"message": "Cannot delete the race, it has task completions associated with it."}), 400

        db.session.delete(race)
        db.session.commit()
        logger.info("Race %s (%s) deleted successfully", race_id, race.name)
        return jsonify({"message": "Race deleted successfully"}), 200


#
# Race Translations
#

@race_bp.route('/<int:race_id>/translations/', methods=['GET'])
@admin_required()
def get_race_translations(race_id):
    """
    Get all translations for a race (admin only).
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
    responses:
      200:
        description: List of race translations
        content:
          application/json:
            schema:
              type: array
              items:
                type: object
                properties:
                  id:
                    type: integer
                  language:
                    type: string
                  name:
                    type: string
                  description:
                    type: string
                  race_greeting:
                    type: string
    """
    race = Race.query.filter_by(id=race_id).first_or_404()
    logger.info("Retrieved %s race translations for race %s", len(race.translations), race_id)
    return jsonify([
        {
            "id": translation.id,
            "language": translation.language,
            "name": translation.name,
            "description": translation.description,
            "race_greeting": translation.race_greeting,
        }
        for translation in race.translations
    ]), 200


@race_bp.route('/<int:race_id>/translations/', methods=['POST'])
@admin_required()
def create_race_translation(race_id):
    """
    Create a translation for a race (admin only).
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
            properties:
              language:
                type: string
              name:
                type: string
              description:
                type: string
              race_greeting:
                type: string
            required:
              - language
              - name
    responses:
      201:
        description: Translation created
      400:
        description: Language not supported by race
      409:
        description: Translation already exists
    """
    race = Race.query.filter_by(id=race_id).first_or_404()
    data = request.get_json(silent=True) or {}
    validated = RaceTranslationCreateSchema().load(data)
    if validated["language"] not in (race.supported_languages or []):
        logger.warning(
            "Race translation create rejected for race %s: language %s not supported",
            race_id,
            validated["language"]
        )
        return jsonify({"errors": {"language": ["Language not supported by race"]}}), 400

    existing = RaceTranslation.query.filter_by(
        race_id=race_id,
        language=validated["language"],
    ).first()
    if existing:
        logger.warning("Race translation already exists for race %s language %s", race_id, validated["language"])
        return jsonify({"message": "Translation already exists"}), 409

    translation = RaceTranslation(
        race_id=race_id,
        language=validated["language"],
        name=validated["name"],
        description=validated.get("description"),
        race_greeting=validated.get("race_greeting"),
    )
    db.session.add(translation)
    db.session.commit()
    logger.info("Race translation created for race %s language %s", race_id, translation.language)
    return jsonify({
        "id": translation.id,
        "language": translation.language,
        "name": translation.name,
        "description": translation.description,
        "race_greeting": translation.race_greeting,
    }), 201


@race_bp.route('/<int:race_id>/translations/<string:language>/', methods=['PUT'])
@admin_required()
def update_race_translation(race_id, language):
    """
    Update a translation for a race (admin only).
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
      - in: path
        name: language
        schema:
          type: string
        required: true
        description: Translation language code
    security:
      - BearerAuth: []
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              name:
                type: string
              description:
                type: string
              race_greeting:
                type: string
    responses:
      200:
        description: Translation updated
      400:
        description: Language not supported by race
      404:
        description: Translation not found
    """
    race = Race.query.filter_by(id=race_id).first_or_404()
    if language not in (race.supported_languages or []):
        logger.warning(
            "Race translation update rejected for race %s: language %s not supported",
            race_id,
            language
        )
        return jsonify({"errors": {"language": ["Language not supported by race"]}}), 400

    translation = RaceTranslation.query.filter_by(
        race_id=race_id,
        language=language,
    ).first()
    if not translation:
        logger.warning("Race translation not found for race %s language %s", race_id, language)
        return jsonify({"message": "Translation not found"}), 404

    data = request.get_json(silent=True) or {}
    validated = RaceTranslationUpdateSchema().load(data, partial=True)
    if "name" in validated:
        translation.name = validated["name"]
    if "description" in validated:
        translation.description = validated["description"]
    if "race_greeting" in validated:
      translation.race_greeting = validated["race_greeting"]

    db.session.commit()
    logger.info("Race translation updated for race %s language %s", race_id, language)
    return jsonify({
        "id": translation.id,
        "language": translation.language,
        "name": translation.name,
        "description": translation.description,
        "race_greeting": translation.race_greeting,
    }), 200


@race_bp.route('/<int:race_id>/translations/<string:language>/', methods=['DELETE'])
@admin_required()
def delete_race_translation(race_id, language):
    """
    Delete a translation for a race (admin only).
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
      - in: path
        name: language
        schema:
          type: string
        required: true
        description: Translation language code
    security:
      - BearerAuth: []
    responses:
      200:
        description: Translation deleted
      404:
        description: Translation not found
    """
    translation = RaceTranslation.query.filter_by(
        race_id=race_id,
        language=language,
    ).first_or_404()
    db.session.delete(translation)
    db.session.commit()
    logger.info("Race translation deleted for race %s language %s", race_id, language)
    return jsonify({"message": "Translation deleted."}), 200


#
# Visits and Task completions
#

# get all checkpoint visits for selected team and race
# tested by test_visits.py -> test_get_visits
@race_bp.route("/<int:race_id>/visits/<int:team_id>/", methods=["GET"])
@jwt_required()
def get_visits_by_race_and_team(race_id, team_id):
    """
    Get checkpoint visits for a specific team and race.
    Requires to be an admin or a member of the team.
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
      - in: path
        name: team_id
        schema:
          type: integer
        required: true
        description: ID of the team
    security:
      - BearerAuth: []
    responses:
      200:
        description: A list of checkpoint visits.
        content:
          application/json:
            schema:
              type: array
              items:
                $ref: '#/components/schemas/VisitObject'
      403:
        description: Forbidden, user is not an admin or member of the team.
    """

    # check if user is admin or member of the team
    user = User.query.filter_by(id=get_jwt_identity()).first_or_404()
    if not user.is_administrator and team_id not in [team.id for team in user.teams]:
        return 403

    visits = (
      db.session.query(
        CheckpointLog.id,
        CheckpointLog.checkpoint_id,
        Checkpoint.title.label("checkpoint_title"),
        CheckpointLog.team_id,
        CheckpointLog.created_at,
        CheckpointLog.image_distance_km,
        CheckpointLog.image_latitude,
        CheckpointLog.image_longitude,
        CheckpointLog.user_distance_km,
        CheckpointLog.user_latitude,
        CheckpointLog.user_longitude,
      )
      .select_from(CheckpointLog)
      .join(Checkpoint, CheckpointLog.checkpoint_id == Checkpoint.id)
      .filter(CheckpointLog.race_id == race_id)
      .filter(CheckpointLog.team_id == team_id)
      .all()
    )

    return jsonify([
      {
        "id": visit.id,
        "checkpoint_id": visit.checkpoint_id,
        "checkpoint": visit.checkpoint_title,
        "team_id": visit.team_id,
        "created_at": visit.created_at,
        "image_distance_km": visit.image_distance_km,
        "image_latitude": visit.image_latitude,
        "image_longitude": visit.image_longitude,
        "user_distance_km": visit.user_distance_km,
        "user_latitude": visit.user_latitude,
        "user_longitude": visit.user_longitude,
      }
      for visit in visits
    ])

# get all checkpoint visits for selected race
# tested by test_visits.py -> test_get_visits
@race_bp.route("/<int:race_id>/visits/", methods=["GET"])
@admin_required()
def get_visits_by_race(race_id):
    """
    Get all checkpoint visits for a specific race (admin only).
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
    responses:
      200:
        description: List of checkpoint visits for the race
        content:
          application/json:
            schema:
              type: array
              items:
                type: object
                properties:
                  checkpoint_id:
                    type: integer
                  team_id:
                    type: integer
                  created_at:
                    type: string
                    format: date-time
      403:
        description: Admins only
    """
    visits = CheckpointLog.query.filter_by(race_id=race_id).all()
    return jsonify([
      {
        "checkpoint_id": visit.checkpoint_id,
        "team_id": visit.team_id,
        "created_at": visit.created_at,
        "image_distance_km": visit.image_distance_km,
        "image_latitude": visit.image_latitude,
        "image_longitude": visit.image_longitude,
        "user_distance_km": visit.user_distance_km,
        "user_latitude": visit.user_latitude,
        "user_longitude": visit.user_longitude,
      }
      for visit in visits
    ])

# get all task completions for selected team and race
@race_bp.route("/<int:race_id>/task-completions/<int:team_id>/", methods=["GET"])
@jwt_required()
def get_task_completions_by_race_and_team(race_id, team_id):
    """
    Get task completions for a specific team and race.
    Requires the user to be an admin or a member of the team.
    ---
    tags:
      - Tasks
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
    security:
      - BearerAuth: []
    responses:
      200:
        description: A list of task completions for the given team and race.
        content:
          application/json:
            schema:
              type: array
              items:
                type: object
                properties:
                  id:
                    type: integer
                  task_id:
                    type: integer
                  task:
                    type: string
                    description: Task title
                  team_id:
                    type: integer
                  created_at:
                    type: string
                    format: date-time
      403:
        description: Forbidden, user is not an admin or member of the team.
    """
    user = User.query.filter_by(id=get_jwt_identity()).first_or_404()
    if not user.is_administrator and team_id not in [team.id for team in user.teams]:
        return 403

    completions = (
        db.session.query(
            TaskLog.id,
            TaskLog.task_id,
            Task.title.label("task_title"),
            TaskLog.team_id,
            TaskLog.created_at
        )
        .select_from(TaskLog)
        .join(Task, TaskLog.task_id == Task.id)
        .filter(TaskLog.race_id == race_id)
        .filter(TaskLog.team_id == team_id)
        .all()
    )

    return jsonify([
        {
            "id": completion.id,
            "task_id": completion.task_id,
            "task": completion.task_title,
            "team_id": completion.team_id,
            "created_at": completion.created_at,
        }
        for completion in completions
    ])

# get all task completions for selected race
@race_bp.route("/<int:race_id>/task-completions/", methods=["GET"])
@admin_required()
def get_task_completions_by_race(race_id):
    """
    Get all task completions for a specific race (admin only).
    ---
    tags:
      - Tasks
    parameters:
      - in: path
        name: race_id
        schema:
          type: integer
        required: true
        description: ID of the race
    security:
      - BearerAuth: []
    responses:
      200:
        description: List of task completions for the race
        content:
          application/json:
            schema:
              type: array
              items:
                type: object
                properties:
                  task_id:
                    type: integer
                  team_id:
                    type: integer
                  created_at:
                    type: string
                    format: date-time
      403:
        description: Admins only
    """
    completions = TaskLog.query.filter_by(race_id=race_id).all()
    return jsonify([
        {
            "task_id": completion.task_id,
            "team_id": completion.team_id,
            "created_at": completion.created_at,
        }
        for completion in completions
    ])


@race_bp.route("/<int:race_id>/results/", methods=["GET"])
@jwt_required()
def get_race_results(race_id):
    """
    Get race results for all registered teams in a race.
    Returns per-team totals for checkpoints and tasks, and overall total.
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
    responses:
      200:
        description: Race results grouped by team
        content:
          application/json:
            schema:
              type: array
              items:
                type: object
                properties:
                  team_id:
                    type: integer
                  team:
                    type: string
                    description: Team name
                  category:
                    type: string
                    description: Race category name
                  points_for_checkpoints:
                    type: integer
                  points_for_tasks:
                    type: integer
                  total_points:
                    type: integer
      404:
        description: Race not found
    """
    # ensure race exists
    Race.query.filter_by(id=race_id).first_or_404()

    registrations = (db.session.query(
        Registration.team_id,
        Registration.disqualified,
        Team.name.label("team_name"),
        RaceCategory.name.label("race_category_name"))
        .select_from(Registration)
        .join(Team, Registration.team_id == Team.id)
        .join(RaceCategory, Registration.race_category_id == RaceCategory.id)
        .filter(Registration.race_id == race_id)
        .order_by(Registration.team_id)
        .all())

    checkpoints_points = (db.session.query(CheckpointLog.team_id, db.func.sum(Checkpoint.numOfPoints).label("total_points"))
        .select_from(CheckpointLog)
        .join(Checkpoint, CheckpointLog.checkpoint_id == Checkpoint.id)
        .filter(CheckpointLog.race_id == race_id)
        .group_by(CheckpointLog.team_id)
        .order_by(CheckpointLog.team_id)
        .all())

    tasks_points = (db.session.query(TaskLog.team_id, db.func.sum(Task.numOfPoints).label("total_points"))
        .select_from(TaskLog)
        .join(Task, TaskLog.task_id == Task.id)
        .filter(TaskLog.race_id == race_id)
        .group_by(TaskLog.team_id)
        .order_by(TaskLog.team_id)
        .all())

    result = []
    checkpoint_idx = 0
    task_idx = 0
    for reg in registrations:
        points_for_checkpoints = 0
        points_for_tasks = 0

        if checkpoint_idx < len(checkpoints_points) and reg.team_id == checkpoints_points[checkpoint_idx].team_id:
            points_for_checkpoints = checkpoints_points[checkpoint_idx].total_points
            checkpoint_idx += 1

        if task_idx < len(tasks_points) and reg.team_id == tasks_points[task_idx].team_id:
            points_for_tasks = tasks_points[task_idx].total_points
            task_idx += 1

        result.append({
            "team_id": reg.team_id,
            "team": reg.team_name,
            "category": reg.race_category_name,
            "disqualified": bool(reg.disqualified),
            "points_for_checkpoints": points_for_checkpoints,
            "points_for_tasks": points_for_tasks,
            "total_points": points_for_checkpoints + points_for_tasks})

    return jsonify(result), 200

