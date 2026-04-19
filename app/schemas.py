from marshmallow import INCLUDE, Schema, fields, validate, pre_load, validates_schema, ValidationError
from app.constants import SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE


LATITUDE_VALIDATOR = validate.Range(min=-90, max=90)
LONGITUDE_VALIDATOR = validate.Range(min=-180, max=180)


def _validate_coordinate_pair(data, latitude_key, longitude_key, field_name):
    latitude = data.get(latitude_key)
    longitude = data.get(longitude_key)
    if (latitude is None) != (longitude is None):
        raise ValidationError(
            f"{field_name} latitude and longitude must both be provided or both be omitted",
            field_name=latitude_key,
        )


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
    finish_latitude = fields.Float(load_default=None, allow_none=True, validate=LATITUDE_VALIDATOR)
    finish_longitude = fields.Float(load_default=None, allow_none=True, validate=LONGITUDE_VALIDATOR)
    bivak_1_name = fields.String(load_default=None, allow_none=True)
    bivak_1_latitude = fields.Float(load_default=None, allow_none=True, validate=LATITUDE_VALIDATOR)
    bivak_1_longitude = fields.Float(load_default=None, allow_none=True, validate=LONGITUDE_VALIDATOR)
    bivak_2_name = fields.String(load_default=None, allow_none=True)
    bivak_2_latitude = fields.Float(load_default=None, allow_none=True, validate=LATITUDE_VALIDATOR)
    bivak_2_longitude = fields.Float(load_default=None, allow_none=True, validate=LONGITUDE_VALIDATOR)
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
    race_greeting = fields.String(load_default="", allow_none=True)
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
        load_default="czk",
        validate=validate.Regexp(r"^[A-Za-z]{3}$", error="registration_currency must be a 3-letter ISO code"),
    )
    registration_pricing_strategy = fields.String(
        load_default="team_flat",
        validate=validate.OneOf(["team_flat", "driver_codriver"]),
    )
    registration_team_amount_cents = fields.Integer(load_default=50, validate=validate.Range(min=1))
    registration_individual_amount_cents = fields.Integer(load_default=25, validate=validate.Range(min=1))
    registration_driver_amount_cents = fields.Integer(load_default=25, validate=validate.Range(min=1))
    registration_codriver_amount_cents = fields.Integer(load_default=15, validate=validate.Range(min=1))

    @pre_load
    def normalize_registration_currency(self, data, **kwargs):
        normalized = dict(data)
        currency = normalized.get("registration_currency")
        if isinstance(currency, str):
            normalized["registration_currency"] = currency.strip().lower()

        if "registration_team_amount" in normalized and "registration_team_amount_cents" not in normalized:
            normalized["registration_team_amount_cents"] = normalized.get("registration_team_amount")
        if "registration_individual_amount" in normalized and "registration_individual_amount_cents" not in normalized:
            normalized["registration_individual_amount_cents"] = normalized.get("registration_individual_amount")
        if "registration_driver_amount" in normalized and "registration_driver_amount_cents" not in normalized:
            normalized["registration_driver_amount_cents"] = normalized.get("registration_driver_amount")
        if "registration_codriver_amount" in normalized and "registration_codriver_amount_cents" not in normalized:
            normalized["registration_codriver_amount_cents"] = normalized.get("registration_codriver_amount")
        return normalized

    @validates_schema
    def validate_language_settings(self, data, **kwargs):
        _validate_coordinate_pair(data, "finish_latitude", "finish_longitude", "finish")
        _validate_coordinate_pair(data, "bivak_1_latitude", "bivak_1_longitude", "bivak_1")
        _validate_coordinate_pair(data, "bivak_2_latitude", "bivak_2_longitude", "bivak_2")

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
        if allow_team_registration == allow_individual_registration:
            raise ValidationError(
                "Exactly one registration mode must be enabled",
                field_name="allow_team_registration",
            )

        registration_enabled = data.get("registration_enabled", False)
        registration_slug = data.get("registration_slug")
        if registration_enabled and not registration_slug:
            raise ValidationError("registration_slug is required when registration_enabled is true", field_name="registration_slug")


class RaceUpdateSchema(Schema):
    name = fields.String(validate=validate.Length(min=1))
    description = fields.String()
    finish_latitude = fields.Float(allow_none=True, validate=LATITUDE_VALIDATOR)
    finish_longitude = fields.Float(allow_none=True, validate=LONGITUDE_VALIDATOR)
    bivak_1_name = fields.String(allow_none=True)
    bivak_1_latitude = fields.Float(allow_none=True, validate=LATITUDE_VALIDATOR)
    bivak_1_longitude = fields.Float(allow_none=True, validate=LONGITUDE_VALIDATOR)
    bivak_2_name = fields.String(allow_none=True)
    bivak_2_latitude = fields.Float(allow_none=True, validate=LATITUDE_VALIDATOR)
    bivak_2_longitude = fields.Float(allow_none=True, validate=LONGITUDE_VALIDATOR)
    start_showing_checkpoints_at = fields.String(validate=validate.Length(min=1))
    end_showing_checkpoints_at = fields.String(validate=validate.Length(min=1))
    start_logging_at = fields.String(validate=validate.Length(min=1))
    end_logging_at = fields.String(validate=validate.Length(min=1))
    supported_languages = fields.List(
        fields.String(validate=validate.OneOf(SUPPORTED_LANGUAGES)),
        validate=validate.Length(min=1),
    )
    default_language = fields.String(validate=validate.OneOf(SUPPORTED_LANGUAGES))
    race_greeting = fields.String(allow_none=True)
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
    registration_pricing_strategy = fields.String(validate=validate.OneOf(["team_flat", "driver_codriver"]))
    registration_team_amount_cents = fields.Integer(validate=validate.Range(min=1))
    registration_individual_amount_cents = fields.Integer(validate=validate.Range(min=1))
    registration_driver_amount_cents = fields.Integer(validate=validate.Range(min=1))
    registration_codriver_amount_cents = fields.Integer(validate=validate.Range(min=1))

    @pre_load
    def normalize_registration_currency(self, data, **kwargs):
        normalized = dict(data)
        currency = normalized.get("registration_currency")
        if isinstance(currency, str):
            normalized["registration_currency"] = currency.strip().lower()

        if "registration_team_amount" in normalized and "registration_team_amount_cents" not in normalized:
            normalized["registration_team_amount_cents"] = normalized.get("registration_team_amount")
        if "registration_individual_amount" in normalized and "registration_individual_amount_cents" not in normalized:
            normalized["registration_individual_amount_cents"] = normalized.get("registration_individual_amount")
        if "registration_driver_amount" in normalized and "registration_driver_amount_cents" not in normalized:
            normalized["registration_driver_amount_cents"] = normalized.get("registration_driver_amount")
        if "registration_codriver_amount" in normalized and "registration_codriver_amount_cents" not in normalized:
            normalized["registration_codriver_amount_cents"] = normalized.get("registration_codriver_amount")
        return normalized

    @validates_schema
    def validate_registration_settings(self, data, **kwargs):
        if "finish_latitude" in data and "finish_longitude" in data:
            _validate_coordinate_pair(data, "finish_latitude", "finish_longitude", "finish")
        if "bivak_1_latitude" in data and "bivak_1_longitude" in data:
            _validate_coordinate_pair(data, "bivak_1_latitude", "bivak_1_longitude", "bivak_1")
        if "bivak_2_latitude" in data and "bivak_2_longitude" in data:
            _validate_coordinate_pair(data, "bivak_2_latitude", "bivak_2_longitude", "bivak_2")

        min_team_size = data.get("min_team_size")
        max_team_size = data.get("max_team_size")
        if min_team_size is not None and max_team_size is not None and min_team_size > max_team_size:
            raise ValidationError("min_team_size must be <= max_team_size", field_name="min_team_size")

        allow_team_registration = data.get("allow_team_registration")
        allow_individual_registration = data.get("allow_individual_registration")
        if allow_team_registration is not None and allow_individual_registration is not None and allow_team_registration == allow_individual_registration:
            raise ValidationError(
                "Exactly one registration mode must be enabled",
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
    race_greeting = fields.String(load_default=None, allow_none=True)


class RaceTranslationUpdateSchema(Schema):
    name = fields.String(validate=validate.Length(min=1))
    description = fields.String()
    race_greeting = fields.String(allow_none=True)


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
            keys=fields.String(validate=validate.OneOf(["name", "email", "preferred_language"])),
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

                preferred_language = (member.get('preferred_language') or '').strip() if isinstance(member, dict) else ''
                if preferred_language and preferred_language not in SUPPORTED_LANGUAGES:
                    member_errors['preferred_language'] = [f"Must be one of: {', '.join(SUPPORTED_LANGUAGES)}."]

                if member_errors:
                    errors[str(index)] = member_errors

            if errors:
                raise ValidationError({'members': errors})


class TeamDisqualifySchema(Schema):
    disqualified = fields.Boolean(required=True)


class RegistrationEmailLogQuerySchema(Schema):
    status = fields.String(
        load_default=None,
        allow_none=True,
        validate=validate.OneOf(['pending', 'sent', 'delivered', 'opened', 'failed', 'bounced', 'blocked']),
    )
    template_type = fields.String(
        load_default=None,
        allow_none=True,
        validate=validate.OneOf(['registration_confirmation', 'admin_registration_completed']),
    )
    team_id = fields.Integer(load_default=None, allow_none=True, validate=validate.Range(min=1))
    date_from = fields.Date(load_default=None, allow_none=True)
    date_to = fields.Date(load_default=None, allow_none=True)
    page = fields.Integer(load_default=1, validate=validate.Range(min=1))
    page_size = fields.Integer(load_default=50, validate=validate.Range(min=1, max=200))

    @validates_schema
    def validate_date_window(self, data, **kwargs):
        date_from = data.get('date_from')
        date_to = data.get('date_to')
        if date_from and date_to and date_from > date_to:
            raise ValidationError('date_from cannot be after date_to.', field_name='date_from')


class RetryFailedEmailsSchema(Schema):
    limit = fields.Integer(load_default=50, validate=validate.Range(min=1, max=500))


class BrevoWebhookEventSchema(Schema):
    class Meta:
        unknown = INCLUDE

    event = fields.String(required=True, validate=validate.Length(min=1))
    email = fields.Email(load_default=None, allow_none=True)
    recipient = fields.Email(load_default=None, allow_none=True)
    message_id = fields.String(load_default=None, allow_none=True, data_key='message_id')
    message_id_dash = fields.String(load_default=None, allow_none=True, data_key='message-id')
    message_id_camel = fields.String(load_default=None, allow_none=True, data_key='messageId')
    smtp_id = fields.String(load_default=None, allow_none=True, data_key='smtp_id')
    smtp_id_dash = fields.String(load_default=None, allow_none=True, data_key='smtp-id')
    date = fields.Raw(load_default=None, allow_none=True)
    ts = fields.Raw(load_default=None, allow_none=True)

    @validates_schema
    def validate_identity(self, data, **kwargs):
        message_ref = data.get('message_id') or data.get('message_id_dash') or data.get('message_id_camel') or data.get('smtp_id') or data.get('smtp_id_dash')
        recipient = data.get('email') or data.get('recipient')
        if not message_ref and not recipient:
            raise ValidationError(
                'At least one message identifier or recipient email is required.',
                field_name='message_id',
            )
