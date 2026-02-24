from marshmallow import Schema, fields, validate, pre_load, validates_schema, ValidationError
from app.constants import SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE


class CheckpointCreateSchema(Schema):
    title = fields.String(required=True, validate=validate.Length(min=1))
    description = fields.String(load_default="")
    latitude = fields.Float(allow_none=True)
    longitude = fields.Float(allow_none=True)
    numOfPoints = fields.Integer(load_default=1, validate=validate.Range(min=0))

    @pre_load
    def normalize(self, data, **kwargs):
        normalized = dict(data)
        # Map aliases
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
    supported_languages = fields.List(
        fields.String(validate=validate.OneOf(SUPPORTED_LANGUAGES)),
        load_default=lambda: list(SUPPORTED_LANGUAGES),
        validate=validate.Length(min=1),
    )
    default_language = fields.String(
        validate=validate.OneOf(SUPPORTED_LANGUAGES),
        load_default=DEFAULT_LANGUAGE,
    )
    registration_slug = fields.String(
        load_default=None,
        allow_none=True,
        validate=validate.Regexp(r"^[a-z0-9]+(?:-[a-z0-9]+)*$", error="registration_slug must be lowercase kebab-case"),
    )
    registration_enabled = fields.Boolean(load_default=False)
    min_team_size = fields.Integer(load_default=1, validate=validate.Range(min=1))
    max_team_size = fields.Integer(load_default=2, validate=validate.Range(min=1))
    allow_team_registration = fields.Boolean(load_default=True)
    allow_individual_registration = fields.Boolean(load_default=False)
    registration_currency = fields.String(
        load_default="eur",
        validate=validate.Regexp(r"^[A-Za-z]{3}$", error="registration_currency must be a 3-letter ISO code"),
    )
    registration_team_amount_cents = fields.Integer(load_default=5000, validate=validate.Range(min=1))
    registration_individual_amount_cents = fields.Integer(load_default=2500, validate=validate.Range(min=1))

    @pre_load
    def normalize_registration_currency(self, data, **kwargs):
        normalized = dict(data)
        currency = normalized.get("registration_currency")
        if isinstance(currency, str):
            normalized["registration_currency"] = currency.strip().lower()
        return normalized

    @validates_schema
    def validate_language_settings(self, data, **kwargs):
        supported = data.get("supported_languages", list(SUPPORTED_LANGUAGES))
        default = data.get("default_language", DEFAULT_LANGUAGE)
        if default not in supported:
            raise ValidationError("default_language must be in supported_languages", field_name="default_language")

        min_team_size = data.get("min_team_size", 1)
        max_team_size = data.get("max_team_size", 2)
        if min_team_size > max_team_size:
            raise ValidationError("min_team_size must be <= max_team_size", field_name="min_team_size")

        allow_team_registration = data.get("allow_team_registration", True)
        allow_individual_registration = data.get("allow_individual_registration", False)
        if not allow_team_registration and not allow_individual_registration:
            raise ValidationError(
                "At least one registration mode must be enabled",
                field_name="allow_team_registration",
            )

        registration_enabled = data.get("registration_enabled", False)
        registration_slug = data.get("registration_slug")
        if registration_enabled and not registration_slug:
            raise ValidationError("registration_slug is required when registration_enabled is true", field_name="registration_slug")


class RaceUpdateSchema(Schema):
    name = fields.String(validate=validate.Length(min=1))
    description = fields.String()
    start_showing_checkpoints_at = fields.String(validate=validate.Length(min=1))
    end_showing_checkpoints_at = fields.String(validate=validate.Length(min=1))
    start_logging_at = fields.String(validate=validate.Length(min=1))
    end_logging_at = fields.String(validate=validate.Length(min=1))
    supported_languages = fields.List(
        fields.String(validate=validate.OneOf(SUPPORTED_LANGUAGES)),
        validate=validate.Length(min=1),
    )
    default_language = fields.String(validate=validate.OneOf(SUPPORTED_LANGUAGES))
    registration_slug = fields.String(
        allow_none=True,
        validate=validate.Regexp(r"^[a-z0-9]+(?:-[a-z0-9]+)*$", error="registration_slug must be lowercase kebab-case"),
    )
    registration_enabled = fields.Boolean()
    min_team_size = fields.Integer(validate=validate.Range(min=1))
    max_team_size = fields.Integer(validate=validate.Range(min=1))
    allow_team_registration = fields.Boolean()
    allow_individual_registration = fields.Boolean()
    registration_currency = fields.String(
        validate=validate.Regexp(r"^[A-Za-z]{3}$", error="registration_currency must be a 3-letter ISO code"),
    )
    registration_team_amount_cents = fields.Integer(validate=validate.Range(min=1))
    registration_individual_amount_cents = fields.Integer(validate=validate.Range(min=1))

    @pre_load
    def normalize_registration_currency(self, data, **kwargs):
        normalized = dict(data)
        currency = normalized.get("registration_currency")
        if isinstance(currency, str):
            normalized["registration_currency"] = currency.strip().lower()
        return normalized

    @validates_schema
    def validate_registration_settings(self, data, **kwargs):
        min_team_size = data.get("min_team_size")
        max_team_size = data.get("max_team_size")
        if min_team_size is not None and max_team_size is not None and min_team_size > max_team_size:
            raise ValidationError("min_team_size must be <= max_team_size", field_name="min_team_size")

        allow_team_registration = data.get("allow_team_registration")
        allow_individual_registration = data.get("allow_individual_registration")
        if allow_team_registration is False and allow_individual_registration is False:
            raise ValidationError(
                "At least one registration mode must be enabled",
                field_name="allow_team_registration",
            )

        registration_enabled = data.get("registration_enabled")
        registration_slug = data.get("registration_slug")
        if registration_enabled is True and not registration_slug:
            raise ValidationError("registration_slug is required when registration_enabled is true", field_name="registration_slug")


class RaceTranslationCreateSchema(Schema):
    language = fields.String(required=True, validate=validate.OneOf(SUPPORTED_LANGUAGES))
    name = fields.String(required=True, validate=validate.Length(min=1))
    description = fields.String(load_default="")


class RaceTranslationUpdateSchema(Schema):
    name = fields.String(validate=validate.Length(min=1))
    description = fields.String()


class CheckpointTranslationCreateSchema(Schema):
    language = fields.String(required=True, validate=validate.OneOf(SUPPORTED_LANGUAGES))
    title = fields.String(required=True, validate=validate.Length(min=1))
    description = fields.String(load_default="")


class CheckpointTranslationUpdateSchema(Schema):
    title = fields.String(validate=validate.Length(min=1))
    description = fields.String()


class TaskTranslationCreateSchema(Schema):
    language = fields.String(required=True, validate=validate.OneOf(SUPPORTED_LANGUAGES))
    title = fields.String(required=True, validate=validate.Length(min=1))
    description = fields.String(load_default="")


class TaskTranslationUpdateSchema(Schema):
    title = fields.String(validate=validate.Length(min=1))
    description = fields.String()


class UserCreateSchema(Schema):
    name = fields.String(load_default="")
    email = fields.Email(required=True)
    password = fields.String(required=True, validate=validate.Length(min=1))
    is_administrator = fields.Boolean(load_default=False)
    preferred_language = fields.String(validate=validate.OneOf(SUPPORTED_LANGUAGES))


class UserUpdateSchema(Schema):
    name = fields.String()
    email = fields.Email()
    password = fields.String(validate=validate.Length(min=6))
    is_administrator = fields.Boolean()
    preferred_language = fields.String(validate=validate.OneOf(SUPPORTED_LANGUAGES))


class RaceCategoryAssignSchema(Schema):
    race_category_id = fields.Integer(required=True, strict=True)


class RaceCategoryCreateSchema(Schema):
    name = fields.String(required=True, validate=validate.Length(min=1))
    description = fields.String(load_default="")


class RaceCategoryUpdateSchema(Schema):
    name = fields.String(validate=validate.Length(min=1))
    description = fields.String()


class RaceCategoryTranslationCreateSchema(Schema):
    language = fields.String(required=True, validate=validate.OneOf(SUPPORTED_LANGUAGES))
    name = fields.String(required=True, validate=validate.Length(min=1))
    description = fields.String(load_default="")


class RaceCategoryTranslationUpdateSchema(Schema):
    name = fields.String(validate=validate.Length(min=1))
    description = fields.String()


class AuthRegisterSchema(Schema):
    name = fields.String(load_default="")
    email = fields.Email(required=True)
    password = fields.String(required=True, validate=validate.Length(min=1))
    is_administrator = fields.Boolean(load_default=False)
    preferred_language = fields.String(validate=validate.OneOf(SUPPORTED_LANGUAGES))


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
    user_ids = fields.List(fields.Integer(strict=True), required=False, validate=validate.Length(min=1))
    members = fields.List(
        fields.Dict(
            keys=fields.String(validate=validate.OneOf(["name", "email"])),
            values=fields.String(validate=validate.Length(min=1)),
        ),
        required=False,
        validate=validate.Length(min=1),
    )

    @validates_schema
    def validate_payload(self, data, **kwargs):
        has_user_ids = bool(data.get('user_ids'))
        has_members = bool(data.get('members'))

        if not has_user_ids and not has_members:
            raise ValidationError({'user_ids': ['user_ids or members is required.']})

        if has_user_ids and has_members:
            raise ValidationError({'members': ['Provide either user_ids or members, not both.']})

        if has_members:
            errors = {}
            for index, member in enumerate(data['members']):
                member_errors = {}
                name = (member.get('name') or '').strip() if isinstance(member, dict) else ''
                email = (member.get('email') or '').strip() if isinstance(member, dict) else ''

                if not name:
                    member_errors['name'] = ['Missing data for required field.']
                if not email:
                    member_errors['email'] = ['Missing data for required field.']

                if member_errors:
                    errors[str(index)] = member_errors

            if errors:
                raise ValidationError({'members': errors})


class TeamDisqualifySchema(Schema):
    disqualified = fields.Boolean(required=True)
