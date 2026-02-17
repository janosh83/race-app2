import logging
from flask import Blueprint, jsonify, request
from marshmallow import ValidationError

from app import db
from app.models import RaceCategory, RaceCategoryTranslation
from app.routes.admin import admin_required
from app.schemas import (
  RaceCategoryCreateSchema,
  RaceCategoryTranslationCreateSchema,
  RaceCategoryTranslationUpdateSchema,
)
from app.constants import SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE

logger = logging.getLogger(__name__)

race_category_bp = Blueprint('race-category', __name__)

# get all race categories
# tested by test_categories.py -> test_add_race_category
@race_category_bp.route('/', methods=['GET'])
def get_race_categories():
    """
    Get all race categories.
    ---
    tags:
      - Race Categories
    parameters:
      - in: query
        name: lang
        schema:
          type: string
        required: false
        description: Optional language code for translated fields
    responses:
      200:
        description: A list of all race categories
        content:
          application/json:
            schema:
              type: array
              items:
                type: object
                properties:
                  id:
                    type: integer
                    description: The category ID
                  name:
                    type: string
                    description: The name of the category
                  description:
                    type: string
                    description: The description of the category
      400:
        description: Unsupported language
    """
    requested_language = request.args.get("lang")
    if requested_language and requested_language not in SUPPORTED_LANGUAGES:
      logger.warning(f"Unsupported race category language '{requested_language}' requested")
      return jsonify({"errors": {"language": ["Unsupported language"]}}), 400
    categories = RaceCategory.query.all()
    language = requested_language or DEFAULT_LANGUAGE
    response = []
    for category in categories:
      name = category.name
      description = category.description
      translation = RaceCategoryTranslation.query.filter_by(
        race_category_id=category.id,
        language=language,
      ).first()
      if translation:
        name = translation.name
        description = translation.description
      response.append({"id": category.id, "name": name, "description": description})
    return jsonify(response), 200

# create new race category
# NOTE: adding race categories for particular race is done through race endpoint
# tested by test_categories.py -> test_add_race_category
@race_category_bp.route('/', methods=['POST'])
@admin_required()
def create_race_category():
    """
    Create a new race category (admin only).
    ---
    tags:
      - Race Categories
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
                description: The name of the category
                example: "Beginner"
              description:
                type: string
                description: The description of the category
                example: "Suitable for beginners"
            required:
              - name
    responses:
      201:
        description: Category created successfully
        content:
          application/json:
            schema:
              type: object
              properties:
                id:
                  type: integer
                  description: The category ID
                name:
                  type: string
                  description: The name of the category
                description:
                  type: string
                  description: The description of the category
      400:
        description: Missing race category name
      403:
        description: Admins only
    """
    data = request.get_json() or {}
    try:
      validated = RaceCategoryCreateSchema().load(data)
    except ValidationError as err:
      if 'name' in err.messages:
        return jsonify({"msg": "Missing race category name"}), 400
      return jsonify({"errors": err.messages}), 400
    new_category = RaceCategory(name=validated['name'], description=validated.get('description', ''))
    db.session.add(new_category)
    db.session.commit()
    logger.info(f"Race category created: {new_category.name} (ID: {new_category.id})")
    return jsonify({"id": new_category.id, "name": new_category.name, "description": new_category.description}), 201

# delete race category
# tested by test_categories.py -> test_add_race_category
@race_category_bp.route('/<int:category_id>/', methods=['DELETE'])
@admin_required()
def delete_race_category(category_id):
    """
    Delete a race category by ID (admin only).
    ---
    tags:
      - Race Categories
    parameters:
      - in: path
        name: category_id
        schema:
          type: integer
        required: true
        description: ID of the category to delete
    security:
      - BearerAuth: []
    responses:
      200:
        description: Category deleted successfully
        content:
          application/json:
            schema:
              type: object
              properties:
                msg:
                  type: string
                  example: "Category deleted"
      404:
        description: Category not found
      403:
        description: Admins only
    """
    # TODO: check if category is used in any race
    category = RaceCategory.query.filter_by(id=category_id).first_or_404()
    db.session.delete(category)
    db.session.commit()
    return jsonify({"msg": "Category deleted"}), 200


@race_category_bp.route('/<int:category_id>/translations/', methods=['GET'])
@admin_required()
def get_race_category_translations(category_id):
    """
    Get all translations for a race category (admin only).
    ---
    tags:
      - Race Categories
    parameters:
      - in: path
        name: category_id
        schema:
          type: integer
        required: true
        description: ID of the category
    security:
      - BearerAuth: []
    responses:
      200:
        description: List of race category translations
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
    """
    category = RaceCategory.query.filter_by(id=category_id).first_or_404()
    logger.info(
        f"Retrieved {len(category.translations)} race category translations for category {category_id}"
    )
    return jsonify([
        {
            "id": translation.id,
            "language": translation.language,
            "name": translation.name,
            "description": translation.description,
        }
        for translation in category.translations
    ]), 200


@race_category_bp.route('/<int:category_id>/translations/', methods=['POST'])
@admin_required()
def create_race_category_translation(category_id):
    """
    Create a translation for a race category (admin only).
    ---
    tags:
      - Race Categories
    parameters:
      - in: path
        name: category_id
        schema:
          type: integer
        required: true
        description: ID of the category
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
            required:
              - language
              - name
    responses:
      201:
        description: Translation created
      409:
        description: Translation already exists
    """
    data = request.get_json(silent=True) or {}
    validated = RaceCategoryTranslationCreateSchema().load(data)

    existing = RaceCategoryTranslation.query.filter_by(
        race_category_id=category_id,
        language=validated["language"],
    ).first()
    if existing:
        logger.warning(
            f"Race category translation already exists for category {category_id} language {validated['language']}"
        )
        return jsonify({"message": "Translation already exists"}), 409

    translation = RaceCategoryTranslation(
        race_category_id=category_id,
        language=validated["language"],
        name=validated["name"],
        description=validated.get("description"),
    )
    db.session.add(translation)
    db.session.commit()
    logger.info(
        f"Race category translation created for category {category_id} language {translation.language}"
    )
    return jsonify({
        "id": translation.id,
        "language": translation.language,
        "name": translation.name,
        "description": translation.description,
    }), 201


@race_category_bp.route('/<int:category_id>/translations/<string:language>/', methods=['PUT'])
@admin_required()
def update_race_category_translation(category_id, language):
    """
    Update a translation for a race category (admin only).
    ---
    tags:
      - Race Categories
    parameters:
      - in: path
        name: category_id
        schema:
          type: integer
        required: true
        description: ID of the category
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
    responses:
      200:
        description: Translation updated
      404:
        description: Translation not found
    """
    translation = RaceCategoryTranslation.query.filter_by(
        race_category_id=category_id,
        language=language,
    ).first()
    if not translation:
        logger.warning(
            f"Race category translation not found for category {category_id} language {language}"
        )
        return jsonify({"message": "Translation not found"}), 404

    data = request.get_json(silent=True) or {}
    validated = RaceCategoryTranslationUpdateSchema().load(data, partial=True)
    if "name" in validated:
        translation.name = validated["name"]
    if "description" in validated:
        translation.description = validated["description"]

    db.session.commit()
    logger.info(f"Race category translation updated for category {category_id} language {language}")
    return jsonify({
        "id": translation.id,
        "language": translation.language,
        "name": translation.name,
        "description": translation.description,
    }), 200


@race_category_bp.route('/<int:category_id>/translations/<string:language>/', methods=['DELETE'])
@admin_required()
def delete_race_category_translation(category_id, language):
    """
    Delete a translation for a race category (admin only).
    ---
    tags:
      - Race Categories
    parameters:
      - in: path
        name: category_id
        schema:
          type: integer
        required: true
        description: ID of the category
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
    translation = RaceCategoryTranslation.query.filter_by(
        race_category_id=category_id,
        language=language,
    ).first_or_404()
    db.session.delete(translation)
    db.session.commit()
    logger.info(f"Race category translation deleted for category {category_id} language {language}")
    return jsonify({"message": "Translation deleted."}), 200