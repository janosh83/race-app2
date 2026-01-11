from marshmallow import Schema, fields, validate, pre_load


class CheckpointCreateSchema(Schema):
    title = fields.String(required=True, validate=validate.Length(min=1))
    description = fields.String(load_default="")
    latitude = fields.Float(allow_none=True)
    longitude = fields.Float(allow_none=True)
    numOfPoints = fields.Integer(load_default=1, validate=validate.Range(min=0))

    @pre_load
    def normalize(self, data, **kwargs):
        normalized = dict(data)
        if "name" in normalized and "title" not in normalized:
            normalized["title"] = normalized["name"]
        if "lat" in normalized and "latitude" not in normalized:
            normalized["latitude"] = normalized["lat"]
        if "lng" in normalized and "longitude" not in normalized:
            normalized["longitude"] = normalized["lng"]
        if "desc" in normalized and "description" not in normalized:
            normalized["description"] = normalized["desc"]
        if "num_of_points" in normalized and "numOfPoints" not in normalized:
            normalized["numOfPoints"] = normalized["num_of_points"]
        if "numPoints" in normalized and "numOfPoints" not in normalized:
            normalized["numOfPoints"] = normalized["numPoints"]
        # Remove alias keys to avoid unknown field errors
        for alias_key in ("name", "lat", "lng", "desc", "num_of_points", "numPoints"):
            normalized.pop(alias_key, None)
        return normalized


class CheckpointUpdateSchema(Schema):
    title = fields.String(validate=validate.Length(min=1))
    description = fields.String()
    latitude = fields.Float(allow_none=True)
    longitude = fields.Float(allow_none=True)
    numOfPoints = fields.Integer(validate=validate.Range(min=0))

    @pre_load
    def normalize(self, data, **kwargs):
        normalized = dict(data)
        if "name" in normalized and "title" not in normalized:
            normalized["title"] = normalized["name"]
        if "lat" in normalized and "latitude" not in normalized:
            normalized["latitude"] = normalized["lat"]
        if "lng" in normalized and "longitude" not in normalized:
            normalized["longitude"] = normalized["lng"]
        if "num_of_points" in normalized and "numOfPoints" not in normalized:
            normalized["numOfPoints"] = normalized["num_of_points"]
        if "numPoints" in normalized and "numOfPoints" not in normalized:
            normalized["numOfPoints"] = normalized["numPoints"]
        return normalized


class CheckpointLogSchema(Schema):
    checkpoint_id = fields.Integer(required=True)
    team_id = fields.Integer(required=True)
    image_latitude = fields.Float(load_default=None)
    image_longitude = fields.Float(load_default=None)
    image_distance_km = fields.Float(load_default=None)
    user_latitude = fields.Float(load_default=None)
    user_longitude = fields.Float(load_default=None)
    user_distance_km = fields.Float(load_default=None)


class TaskCreateSchema(Schema):
    title = fields.String(required=True, validate=validate.Length(min=1))
    description = fields.String(load_default="")
    numOfPoints = fields.Integer(load_default=1, validate=validate.Range(min=1))

    @pre_load
    def normalize(self, data, **kwargs):
        normalized = dict(data)
        if "name" in normalized and "title" not in normalized:
            normalized["title"] = normalized["name"]
        if "num_of_points" in normalized and "numOfPoints" not in normalized:
            normalized["numOfPoints"] = normalized["num_of_points"]
        if "numPoints" in normalized and "numOfPoints" not in normalized:
            normalized["numOfPoints"] = normalized["numPoints"]
        if "desc" in normalized and "description" not in normalized:
            normalized["description"] = normalized["desc"]
        for alias_key in ("name", "numPoints", "num_of_points", "desc"):
            normalized.pop(alias_key, None)
        return normalized


class TaskUpdateSchema(Schema):
    title = fields.String(validate=validate.Length(min=1))
    description = fields.String()
    numOfPoints = fields.Integer(validate=validate.Range(min=1))

    @pre_load
    def normalize(self, data, **kwargs):
        normalized = dict(data)
        if "name" in normalized and "title" not in normalized:
            normalized["title"] = normalized["name"]
        if "num_of_points" in normalized and "numOfPoints" not in normalized:
            normalized["numOfPoints"] = normalized["num_of_points"]
        if "numPoints" in normalized and "numOfPoints" not in normalized:
            normalized["numOfPoints"] = normalized["numPoints"]
        if "desc" in normalized and "description" not in normalized:
            normalized["description"] = normalized["desc"]
        # Remove alias keys to avoid unknown field errors
        for alias_key in ("name", "numPoints", "num_of_points", "desc"):
            normalized.pop(alias_key, None)
        return normalized


class TaskLogSchema(Schema):
    task_id = fields.Integer(required=True)
    team_id = fields.Integer(required=True)


class RaceCreateSchema(Schema):
    name = fields.String(required=True, validate=validate.Length(min=1))
    description = fields.String(load_default="")
    start_showing_checkpoints_at = fields.String(required=True, validate=validate.Length(min=1))
    end_showing_checkpoints_at = fields.String(required=True, validate=validate.Length(min=1))
    start_logging_at = fields.String(required=True, validate=validate.Length(min=1))
    end_logging_at = fields.String(required=True, validate=validate.Length(min=1))


class RaceUpdateSchema(Schema):
    name = fields.String(validate=validate.Length(min=1))
    description = fields.String()
    start_showing_checkpoints_at = fields.String(validate=validate.Length(min=1))
    end_showing_checkpoints_at = fields.String(validate=validate.Length(min=1))
    start_logging_at = fields.String(validate=validate.Length(min=1))
    end_logging_at = fields.String(validate=validate.Length(min=1))


class UserCreateSchema(Schema):
    name = fields.String(load_default="")
    email = fields.Email(required=True)
    password = fields.String(required=True, validate=validate.Length(min=1))
    is_administrator = fields.Boolean(load_default=False)


class UserUpdateSchema(Schema):
    name = fields.String()
    email = fields.Email()
    password = fields.String(validate=validate.Length(min=6))
    is_administrator = fields.Boolean()


class RaceCategoryAssignSchema(Schema):
    race_category_id = fields.Integer(required=True, strict=True)


class RaceCategoryCreateSchema(Schema):
    name = fields.String(required=True, validate=validate.Length(min=1))
    description = fields.String(load_default="")


class RaceCategoryUpdateSchema(Schema):
    name = fields.String(validate=validate.Length(min=1))
    description = fields.String()


class AuthRegisterSchema(Schema):
    name = fields.String(load_default="")
    email = fields.Email(required=True)
    password = fields.String(required=True, validate=validate.Length(min=1))
    is_administrator = fields.Boolean(load_default=False)


class AuthLoginSchema(Schema):
    email = fields.Email(required=True)
    password = fields.String(required=True, validate=validate.Length(min=1))


class PasswordResetRequestSchema(Schema):
    email = fields.Email(required=True)


class PasswordResetSchema(Schema):
    token = fields.String(required=True, validate=validate.Length(min=1))
    new_password = fields.String(required=True, validate=validate.Length(min=1))


class TeamCreateSchema(Schema):
    name = fields.String(required=True, validate=validate.Length(min=1))


class TeamSignUpSchema(Schema):
    team_id = fields.Integer(required=True, strict=True)
    race_category_id = fields.Integer(required=True, strict=True)


class TeamAddMembersSchema(Schema):
    user_ids = fields.List(fields.Integer(strict=True), required=True, validate=validate.Length(min=1))
