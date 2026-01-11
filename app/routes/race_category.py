import logging
from flask import Blueprint, jsonify, request
from marshmallow import ValidationError

from app import db
from app.models import RaceCategory
from app.routes.admin import admin_required
from app.schemas import RaceCategoryCreateSchema, RaceCategoryUpdateSchema

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
    """
    categories = RaceCategory.query.all()
    return jsonify([{"id": category.id, "name": category.name, "description": category.description} for category in categories]), 200

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
    validated = RaceCategoryCreateSchema().load(data)
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