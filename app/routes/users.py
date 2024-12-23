from flask import Blueprint, jsonify

users_bp = Blueprint("users", __name__)

@users_bp.route("/", methods=["GET"])
def get_users():
    return jsonify({"users": ["User1", "User2", "User3"]})
