import logging
from flask import Blueprint, jsonify, request
from marshmallow import ValidationError

from app import db
from app.models import Race, CheckpointLog, TaskLog, RaceTranslation
from app.routes.race_api.checkpoints import checkpoints_bp
from app.routes.race_api.tasks import tasks_bp
from app.routes.race_api.race_categories import race_categories_bp
from app.routes.race_api.visits import race_visits_bp
from app.routes.race_api.results import race_results_bp
from app.routes.race_api.registration import race_registration_bp
from app.routes.admin import admin_required
from app.utils import (
  parse_datetime,
)
from app.schemas import RaceCreateSchema, RaceUpdateSchema
from app.schemas import RaceTranslationCreateSchema, RaceTranslationUpdateSchema
from app.constants import SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE

logger = logging.getLogger(__name__)

race_bp = Blueprint("race", __name__)
race_bp.register_blueprint(checkpoints_bp, url_prefix='/<int:race_id>/checkpoints')
race_bp.register_blueprint(tasks_bp, url_prefix='/<int:race_id>/tasks')
race_bp.register_blueprint(race_categories_bp, url_prefix='/<int:race_id>/categories')
race_bp.register_blueprint(race_visits_bp, url_prefix='/<int:race_id>')
race_bp.register_blueprint(race_results_bp, url_prefix='/<int:race_id>')
race_bp.register_blueprint(race_registration_bp, url_prefix='/registration')

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
    ---
    tags:
      - Races
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
              start_showing_checkpoints_at:
                type: string
                format: date-time
              end_showing_checkpoints_at:
                type: string
                format: date-time
              start_logging_at:
                type: string
                format: date-time
              end_logging_at:
                type: string
                format: date-time
              registration_slug:
                type: string
              registration_enabled:
                type: boolean
              min_team_size:
                type: integer
              max_team_size:
                type: integer
              allow_team_registration:
                type: boolean
              allow_individual_registration:
                type: boolean
              registration_currency:
                type: string
              registration_pricing_strategy:
                type: string
              registration_team_amount_cents:
                type: integer
              registration_individual_amount_cents:
                type: integer
              registration_driver_amount_cents:
                type: integer
              registration_codriver_amount_cents:
                type: integer
              supported_languages:
                type: array
                items:
                  type: string
              default_language:
                type: string
    responses:
      200:
        description: Race updated successfully
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/RaceObject'
      400:
        description: Validation failed
      401:
        description: Unauthorized
      403:
        description: Forbidden - admin access required
      404:
        description: Race not found
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
            language,
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
    return jsonify(
      {
        "id": translation.id,
        "language": translation.language,
        "name": translation.name,
        "description": translation.description,
        "race_greeting": translation.race_greeting,
      }
    ), 200


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



