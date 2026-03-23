import os
import logging
from flask import Blueprint, jsonify, current_app, request
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app import db
from app.models import Checkpoint, CheckpointLog, Image, CheckpointTranslation
from app.routes.admin import admin_required
from app.schemas import CheckpointUpdateSchema, CheckpointTranslationCreateSchema, CheckpointTranslationUpdateSchema
from app.utils import find_translation_by_language, is_supported_race_language, resolve_title_description

logger = logging.getLogger(__name__)


# Blueprint pro checkpointy
checkpoint_bp = Blueprint('checkpoint', __name__)

# tested by test_checkpoint.py -> test_checkpoint
# NOTE: this endpoint is admin only as users are getting checkpoint though race api
@checkpoint_bp.route('/<int:checkpoint_id>/', methods=['GET'])
@admin_required()
def get_checkpoint(checkpoint_id):
    """
    Get a single checkpoint (admin only).
    ---
    tags:
      - Checkpoints
    parameters:
      - in: path
        name: checkpoint_id
        schema:
          type: integer
        required: true
        description: ID of the checkpoint
      - in: query
        name: lang
        schema:
          type: string
        required: false
        description: Optional language code for translated fields
    security:
      - BearerAuth: []
    responses:
      200:
        description: Details of a specific checkpoint
        content:
          application/json:
            schema:
              type: object
              properties:
                id:
                  type: integer
                  description: The checkpoint ID
                title:
                  type: string
                  description: The title of the checkpoint
                description:
                  type: string
                  description: The description of the checkpoint
                latitude:
                  type: number
                  format: float
                  description: The latitude coordinate of the checkpoint
                longitude:
                  type: number
                  format: float
                  description: The longitude coordinate of the checkpoint
                numOfPoints:
                  type: integer
                  description: The number of points for visiting this checkpoint
      404:
        description: Checkpoint not found
      403:
        description: Admins only
      400:
        description: Language not supported by race
    """
    checkpoint = Checkpoint.query.filter_by(id=checkpoint_id).first_or_404()
    language = request.args.get("lang")
    if language:
        if not is_supported_race_language(checkpoint.race, language):
            return jsonify({"errors": {"language": ["Language not supported by race"]}}), 400

    translation = find_translation_by_language(checkpoint.translations, language)
    title, description = resolve_title_description(checkpoint.title, checkpoint.description, translation)
    return jsonify({
        "id": checkpoint.id,
        "title": title,
        "description": description,
        "latitude": checkpoint.latitude,
        "longitude": checkpoint.longitude,
        "num_of_points": checkpoint.numOfPoints
    }), 200

@checkpoint_bp.route('/<int:checkpoint_id>/', methods=['PUT'])
@admin_required()
def update_checkpoint(checkpoint_id):
    """
    Update a checkpoint (admin only).
    ---
    tags:
      - Checkpoints
    parameters:
      - in: path
        name: checkpoint_id
        schema:
          type: integer
        required: true
        description: ID of the checkpoint to update
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              title:
                type: string
                description: The title of the checkpoint
              description:
                type: string
                description: The description of the checkpoint
              latitude:
                type: number
                format: float
                description: The latitude coordinate
              longitude:
                type: number
                format: float
                description: The longitude coordinate
              numOfPoints:
                type: integer
                description: The number of points for visiting
    security:
      - BearerAuth: []
    responses:
      200:
        description: Checkpoint updated successfully
        content:
          application/json:
            schema:
              type: object
              properties:
                id:
                  type: integer
                title:
                  type: string
                description:
                  type: string
                latitude:
                  type: number
                longitude:
                  type: number
                numOfPoints:
                  type: integer
      404:
        description: Checkpoint not found
      403:
        description: Admins only
    """
    checkpoint = Checkpoint.query.filter_by(id=checkpoint_id).first_or_404()
    data = request.get_json() or {}
    validated = CheckpointUpdateSchema().load(data)

    updated_fields = []
    if 'title' in validated:
        checkpoint.title = validated['title']
        updated_fields.append('title')
    if 'description' in validated:
        checkpoint.description = validated['description']
        updated_fields.append('description')
    if 'latitude' in validated:
        checkpoint.latitude = validated['latitude']
        updated_fields.append('latitude')
    if 'longitude' in validated:
        checkpoint.longitude = validated['longitude']
        updated_fields.append('longitude')
    if 'numOfPoints' in validated:
        checkpoint.numOfPoints = validated['numOfPoints']
        updated_fields.append('numOfPoints')

    db.session.commit()
    logger.info("Checkpoint %s updated - fields: %s", checkpoint_id, ', '.join(updated_fields))
    return jsonify({
        "id": checkpoint.id,
        "title": checkpoint.title,
        "description": checkpoint.description,
        "latitude": checkpoint.latitude,
        "longitude": checkpoint.longitude,
        "num_of_points": checkpoint.numOfPoints
    }), 200


@checkpoint_bp.route('/<int:checkpoint_id>/translations/', methods=['GET'])
@admin_required()
def get_checkpoint_translations(checkpoint_id):
    """
    Get all translations for a checkpoint (admin only).
    ---
    tags:
      - Checkpoints
    parameters:
      - in: path
        name: checkpoint_id
        schema:
          type: integer
        required: true
        description: ID of the checkpoint
    security:
      - BearerAuth: []
    responses:
      200:
        description: List of checkpoint translations
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
                  title:
                    type: string
                  description:
                    type: string
    """
    checkpoint = Checkpoint.query.filter_by(id=checkpoint_id).first_or_404()
    logger.info(
        "Retrieved %s checkpoint translations for checkpoint %s",
        len(checkpoint.translations),
        checkpoint_id
    )
    return jsonify([
        {
            "id": translation.id,
            "language": translation.language,
            "title": translation.title,
            "description": translation.description,
        }
        for translation in checkpoint.translations
    ]), 200


@checkpoint_bp.route('/<int:checkpoint_id>/translations/', methods=['POST'])
@admin_required()
def create_checkpoint_translation(checkpoint_id):
    """
    Create a translation for a checkpoint (admin only).
    ---
    tags:
      - Checkpoints
    parameters:
      - in: path
        name: checkpoint_id
        schema:
          type: integer
        required: true
        description: ID of the checkpoint
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
              title:
                type: string
              description:
                type: string
            required:
              - language
              - title
    responses:
      201:
        description: Translation created
      400:
        description: Language not supported by race
      409:
        description: Translation already exists
    """
    checkpoint = Checkpoint.query.filter_by(id=checkpoint_id).first_or_404()
    data = request.get_json(silent=True) or {}
    validated = CheckpointTranslationCreateSchema().load(data)
    if validated["language"] not in (checkpoint.race.supported_languages or []):
        logger.warning(
            "Checkpoint translation create rejected for checkpoint %s: language %s not supported",
            checkpoint_id,
            validated["language"]
        )
        return jsonify({"errors": {"language": ["Language not supported by race"]}}), 400

    existing = CheckpointTranslation.query.filter_by(
        checkpoint_id=checkpoint_id,
        language=validated["language"],
    ).first()
    if existing:
        logger.warning(
            "Checkpoint translation already exists for checkpoint %s language %s",
            checkpoint_id,
            validated["language"]
        )
        return jsonify({"message": "Translation already exists"}), 409

    translation = CheckpointTranslation(
        checkpoint_id=checkpoint_id,
        language=validated["language"],
        title=validated["title"],
        description=validated.get("description"),
    )
    db.session.add(translation)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        logger.warning(
          "Checkpoint translation conflict for checkpoint %s language %s",
          checkpoint_id,
          validated["language"],
        )
        return jsonify({"message": "Translation already exists"}), 409
    logger.info(
        "Checkpoint translation created for checkpoint %s language %s",
        checkpoint_id,
        translation.language
    )
    return jsonify({
        "id": translation.id,
        "language": translation.language,
        "title": translation.title,
        "description": translation.description,
    }), 201


@checkpoint_bp.route('/<int:checkpoint_id>/translations/<string:language>/', methods=['PUT'])
@admin_required()
def update_checkpoint_translation(checkpoint_id, language):
    """
    Update a translation for a checkpoint (admin only).
    ---
    tags:
      - Checkpoints
    parameters:
      - in: path
        name: checkpoint_id
        schema:
          type: integer
        required: true
        description: ID of the checkpoint
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
              title:
                type: string
              description:
                type: string
    responses:
      200:
        description: Translation updated
      400:
        description: Language not supported by race
      404:
        description: Translation not found
    """
    checkpoint = Checkpoint.query.filter_by(id=checkpoint_id).first_or_404()
    if language not in (checkpoint.race.supported_languages or []):
        logger.warning(
            "Checkpoint translation update rejected for checkpoint %s: language %s not supported",
            checkpoint_id,
            language
        )
        return jsonify({"errors": {"language": ["Language not supported by race"]}}), 400

    translation = CheckpointTranslation.query.filter_by(
        checkpoint_id=checkpoint_id,
        language=language,
    ).first()
    if not translation:
        logger.warning("Checkpoint translation not found for checkpoint %s language %s", checkpoint_id, language)
        return jsonify({"message": "Translation not found"}), 404

    data = request.get_json(silent=True) or {}
    validated = CheckpointTranslationUpdateSchema().load(data, partial=True)
    if "title" in validated:
        translation.title = validated["title"]
    if "description" in validated:
        translation.description = validated["description"]

    db.session.commit()
    logger.info("Checkpoint translation updated for checkpoint %s language %s", checkpoint_id, language)
    return jsonify({
        "id": translation.id,
        "language": translation.language,
        "title": translation.title,
        "description": translation.description,
    }), 200


@checkpoint_bp.route('/<int:checkpoint_id>/translations/<string:language>/', methods=['DELETE'])
@admin_required()
def delete_checkpoint_translation(checkpoint_id, language):
    """
    Delete a translation for a checkpoint (admin only).
    ---
    tags:
      - Checkpoints
    parameters:
      - in: path
        name: checkpoint_id
        schema:
          type: integer
        required: true
        description: ID of the checkpoint
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
    translation = CheckpointTranslation.query.filter_by(
        checkpoint_id=checkpoint_id,
        language=language,
    ).first_or_404()
    db.session.delete(translation)
    db.session.commit()
    logger.info("Checkpoint translation deleted for checkpoint %s language %s", checkpoint_id, language)
    return jsonify({"message": "Translation deleted."}), 200

# tested by test_checkpoint.py -> test_delete_checkpoint
@checkpoint_bp.route('/<int:checkpoint_id>/', methods=['DELETE'])
@admin_required()
def delete_checkpoint(checkpoint_id):
    """
    Delete a checkpoint and all associated logs and images (admin only).
    ---
    tags:
      - Checkpoints
    parameters:
      - in: path
        name: checkpoint_id
        schema:
          type: integer
        required: true
        description: ID of the checkpoint to delete
    security:
      - BearerAuth: []
    responses:
      200:
        description: Checkpoint and associated logs deleted successfully
        content:
          application/json:
            schema:
              type: object
              properties:
                message:
                  type: string
                  example: "Checkpoint and associated logs deleted."
      404:
        description: Checkpoint not found
      403:
        description: Admins only
    """
    # Delete DB records first; remove files only after successful commit
    # to avoid orphaned DB references if commit fails.
    checkpoint = Checkpoint.query.filter_by(id=checkpoint_id).first_or_404()
    logs = CheckpointLog.query.filter_by(checkpoint_id=checkpoint_id).all()

    image_ids = {log.image_id for log in logs if log.image_id}
    images_by_id = {}
    if image_ids:
        images = Image.query.filter(Image.id.in_(image_ids)).all()
        images_by_id = {image.id: image for image in images}

    image_filenames_to_delete = set()
    for log in logs:
        if log.image_id:
            image = images_by_id.get(log.image_id)
            if image:
                image_filenames_to_delete.add(image.filename)
                db.session.delete(image)
            else:
                logger.warning(
                    "Missing image %s referenced by checkpoint log %s during checkpoint delete",
                    log.image_id,
                    log.id,
                )
        db.session.delete(log)

    db.session.delete(checkpoint)
    try:
        db.session.commit()
    except SQLAlchemyError as err:
        db.session.rollback()
        logger.error("Failed to delete checkpoint %s due to DB error: %s", checkpoint_id, err)
        return jsonify({"message": "Failed to delete checkpoint."}), 500

    deleted_images = 0
    images_folder = current_app.config['IMAGE_UPLOAD_FOLDER']
    for filename in image_filenames_to_delete:
        image_path = os.path.join(images_folder, filename)
        try:
            if os.path.exists(image_path):
                os.remove(image_path)
                deleted_images += 1
            else:
                logger.warning("Image file %s missing during checkpoint %s cleanup", filename, checkpoint_id)
        except OSError as e:
            logger.error(
                "Error deleting image file %s for checkpoint %s: %s",
                filename,
                checkpoint_id,
                e
            )

    logger.info("Checkpoint %s deleted with %s logs and %s images", checkpoint_id, len(logs), deleted_images)
    return jsonify({"message": "Checkpoint and associated logs deleted."}), 200
