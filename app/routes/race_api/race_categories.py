import logging
from flask import Blueprint, jsonify, request

from app import db
from app.models import Race, RaceCategory
from app.routes.admin import admin_required
from app.schemas import RaceCategoryAssignSchema

logger = logging.getLogger(__name__)

# Blueprint for race categories
race_categories_bp = Blueprint('race_categories', __name__)

# tested by tests\test_categories.py -> test_with_race
@race_categories_bp.route("/", methods=["POST"])
@admin_required()
def add_race_category(race_id):
    """
    Add a race category to a specific race (admin only).
    ---
    tags:
      - Race Categories
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
              race_category_id:
                type: integer
                description: ID of the race category to add
                example: 3
            required:
              - race_category_id
    responses:
      201:
        description: Category added to race successfully
        content:
          application/json:
            schema:
              type: object
              properties:
                race_id:
                  type: integer
                  description: The race ID
                race_category_id:
                  type: integer
                  description: The category ID added
      400:
        description: Missing race_category_id
      404:
        description: Race or category not found
      403:
        description: Admins only
    """
    data = request.get_json() or {}
    validated_data = RaceCategoryAssignSchema().load(data)

    race = Race.query.filter_by(id=race_id).first_or_404()
    if not race:
        logger.error(f"Attempt to add category to non-existent race {race_id}")
        return jsonify({"message": "Race not found"}), 404

    race_category = RaceCategory.query.filter_by(id=validated_data["race_category_id"]).first_or_404()
    if not race_category:
        logger.error(f"Attempt to add non-existent category {validated_data['race_category_id']} to race {race_id}")
        return jsonify({"message": "Race category not found"}), 404
    
    race.categories.append(race_category)
    db.session.add(race)
    db.session.commit()
    
    logger.info(f"Category {race_category.id} ({race_category.name}) added to race {race_id}")
    return jsonify({"race_id": race.id, "race_category_id": race_category.id}), 201

# tested by test_race_categories.py -> test_with_race
@race_categories_bp.route("/", methods=["GET"])
@admin_required()
def get_race_categories(race_id):
    """
    Get all race categories for a specific race (admin only).
    ---
    tags:
      - Race Categories
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
        description: List of race categories assigned to this race
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
      404:
        description: Race not found
      403:
        description: Admins only
    """
    race = Race.query.filter_by(id=race_id).first_or_404()
    return jsonify([{"id": category.id, "name": category.name, "description": category.description} for category in race.categories])


# tested by test_race_categories.py -> test_with_race
@race_categories_bp.route("/", methods=["DELETE"])
@admin_required()
def remove_race_category(race_id):
    """
    Remove (unassign) a race category from a specific race (admin only).
    ---
    tags:
      - Race Categories
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
              race_category_id:
                type: integer
                description: ID of the race category to remove
                example: 3
            required:
              - race_category_id
    responses:
      200:
        description: Category removed from race successfully
        content:
          application/json:
            schema:
              type: object
              properties:
                race_id:
                  type: integer
                  description: The race ID
                race_category_id:
                  type: integer
                  description: The category ID removed
      400:
        description: Missing race_category_id
      404:
        description: Race, category not found, or category not assigned to race
      403:
        description: Admins only
    """
    race = Race.query.filter_by(id=race_id).first_or_404()
    data = request.get_json() or {}
    validated_data = RaceCategoryAssignSchema().load(data)
    race_category_id = validated_data["race_category_id"]

    race_category = RaceCategory.query.filter_by(id=race_category_id).first_or_404()

    # if the category is not assigned, return 404
    if race_category not in race.categories:
        logger.error(f"Attempt to remove unassigned category {race_category_id} from race {race_id}")
        return jsonify({"message": "Category not assigned to this race"}), 404

    race.categories.remove(race_category)
    db.session.add(race)
    db.session.commit()
    
    logger.info(f"Category {race_category_id} ({race_category.name}) removed from race {race_id}")
    return jsonify({"race_id": race.id, "race_category_id": race_category.id}), 200
