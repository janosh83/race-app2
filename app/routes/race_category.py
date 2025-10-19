import os
from flask import Blueprint, jsonify, request

from app import db
from app.models import RaceCategory
from app.routes.admin import admin_required

# Blueprint pro checkpointy
race_category_bp = Blueprint('race-category', __name__)

# get all race categories
# tested by test_categories.py -> test_add_race_category
@race_category_bp.route('/', methods=['GET'])
def get_race_categories():
    """
    Get all race categories.
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
    Create a new race category.
    """
    data = request.get_json()
    if not data or 'name' not in data:
        return jsonify({"msg": "Missing race category name"}), 400
    new_category = RaceCategory(name=data['name'], description=data.get('description', ''))
    db.session.add(new_category)
    db.session.commit()
    return jsonify({"id": new_category.id, "name": new_category.name, "description": new_category.description}), 201

# delete race category
# tested by test_categories.py -> test_add_race_category
@race_category_bp.route('/<int:category_id>/', methods=['DELETE'])
@admin_required()
def delete_race_category(category_id):
    """
    Delete race category by ID.
    """
    # TODO: check if category is used in any race
    category = RaceCategory.query.filter_by(id=category_id).first_or_404()
    db.session.delete(category)
    db.session.commit()
    return jsonify({"msg": "Category deleted"}), 200