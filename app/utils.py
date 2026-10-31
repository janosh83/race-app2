import logging
from datetime import datetime, timezone
from math import radians, sin, cos, sqrt, atan2
from dateutil import parser
from flask_jwt_extended import get_jwt_identity
from PIL import ExifTags, Image, UnidentifiedImageError
from app.constants import DEFAULT_LANGUAGE

logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif"}
ALLOWED_IMAGE_MIME_TYPES = {"image/png", "image/jpeg", "image/gif"}


def normalize_email(value: str | None) -> str:
    """Normalize email addresses to a canonical lowercase form for login and storage."""
    if value is None:
        return ""
    return str(value).strip().lower()


def allowed_file(filename: str) -> bool:
    """Check whether a filename has an allowed image extension."""
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def validate_uploaded_image(file_storage) -> tuple[bool, str | None]:
    """Validate uploaded image using MIME type and binary signature checks."""
    if file_storage is None:
        return False, "Image file is missing."

    mimetype = (file_storage.mimetype or "").lower().strip()
    if mimetype and mimetype not in ALLOWED_IMAGE_MIME_TYPES:
        return False, "Invalid image MIME type."

    try:
        file_storage.stream.seek(0)
        image = Image.open(file_storage.stream)
        image.verify()
    except (UnidentifiedImageError, OSError, ValueError):
        return False, "Invalid image file."
    finally:
        try:
            file_storage.stream.seek(0)
        except (OSError, ValueError):
            pass

    return True, None

def current_user_id() -> int:
    """The logged-in user's id from the JWT.

    The JWT subject is a string; use this instead of get_jwt_identity() in
    queries, because PostgreSQL rejects comparing an integer column with a
    string (SQLAlchemy 2.1 binds a Python str as VARCHAR).
    """
    return int(get_jwt_identity())


def utc_now() -> datetime:
    """The current time as naive UTC, the form every datetime is stored in.

    Use this instead of datetime.now(), which is the server's local time and
    would shift race windows by the server's UTC offset.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)


def to_naive_utc(dt: datetime) -> datetime:
    """Convert an aware datetime to naive UTC; naive input is taken as UTC."""
    if dt.tzinfo is None:
        return dt
    return dt.astimezone(timezone.utc).replace(tzinfo=None)


def parse_datetime(s: str) -> datetime:
    """Parse common datetime string formats into a naive UTC datetime.

    Strings with an offset (the admin form sends toISOString(), i.e. "Z") are
    converted to UTC; strings without one are taken as UTC.
    """
    if s is None:
        raise ValueError("empty string")

    # handle ISO 8601 with trailing Z
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    try:
        # accepts "YYYY-MM-DDTHH:MM:SS" and with timezone offset
        return to_naive_utc(datetime.fromisoformat(s))
    except ValueError:
        pass

    # try common fixed formats
    formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d",
        "%d.%m.%Y %H:%M:%S",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue

    # fallback: use dateutil if available (more flexible)
    try:
        return to_naive_utc(parser.parse(s))
    except (parser.ParserError, TypeError, OverflowError, ValueError) as exc:
        raise ValueError(f"unrecognized datetime format: {s}") from exc


def extract_image_coordinates(image_path: str) -> tuple:
    """
    Extract GPS coordinates from image EXIF metadata.

    Args:
        image_path: Path to the image file

    Returns:
        Tuple of (latitude, longitude) or (None, None) if not available
    """
    try:
        with Image.open(image_path) as image:
            # The GPSInfo tag in the main EXIF directory only holds the offset of
            # the GPS directory; get_ifd() reads the directory itself.
            gps_data = image.getexif().get_ifd(ExifTags.IFD.GPSInfo)
    except (OSError, SyntaxError, ValueError) as err:
        logger.warning("Failed to read EXIF from image %s: %s", image_path, err)
        return None, None

    if not gps_data:
        logger.debug("No GPS data in EXIF for image: %s", image_path)
        return None, None

    lat = _convert_to_degrees(gps_data.get(ExifTags.GPS.GPSLatitude))
    lon = _convert_to_degrees(gps_data.get(ExifTags.GPS.GPSLongitude))
    if lat is None or lon is None:
        logger.debug("Incomplete or invalid GPS data in image: %s", image_path)
        return None, None

    # Apply reference (negative for South/West)
    if _gps_ref(gps_data.get(ExifTags.GPS.GPSLatitudeRef)) == 'S':
        lat = -lat
    if _gps_ref(gps_data.get(ExifTags.GPS.GPSLongitudeRef)) == 'W':
        lon = -lon

    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        logger.warning("Out-of-range GPS coordinates in image %s: (%s, %s)", image_path, lat, lon)
        return None, None

    logger.info("Extracted GPS coordinates from image: (%s, %s)", lat, lon)
    return lat, lon


def _gps_ref(value) -> str:
    if isinstance(value, bytes):
        value = value.decode('ascii', errors='ignore')
    return str(value or '').strip().upper()


def _convert_to_degrees(value) -> float | None:
    """
    Convert GPS coordinates from EXIF format to decimal degrees.
    EXIF GPS coordinates are in (degrees, minutes, seconds) format.
    Returns None for missing or invalid values (e.g. 0/0 rationals written by
    cameras without a GPS fix), so they are never stored as a real position.
    """
    if value is None:
        return None
    try:
        d, m, s = (float(part) for part in value)
    except (TypeError, ValueError, ZeroDivisionError) as e:
        logger.warning("Failed to convert GPS value %s to degrees: %s", value, e)
        return None
    if any(part != part for part in (d, m, s)):  # NaN from a 0/0 rational
        return None
    return d + (m / 60.0) + (s / 3600.0)


def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate distance between two GPS coordinates in kilometers using Haversine formula.

    Args:
        lat1, lon1: First coordinate (checkpoint)
        lat2, lon2: Second coordinate (image)

    Returns:
        Distance in kilometers
    """

    R = 6371  # Earth's radius in kilometers

    lat1_rad = radians(lat1)
    lon1_rad = radians(lon1)
    lat2_rad = radians(lat2)
    lon2_rad = radians(lon2)

    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad

    a = sin(dlat / 2) ** 2 + cos(lat1_rad) * cos(lat2_rad) * sin(dlon / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))

    distance = R * c
    return distance


def resolve_language(race, user, requested_language=None, default_language=None):
    """Resolve a language for race-scoped content based on request, user, and race defaults."""

    race_languages = race.supported_languages or []
    if requested_language and requested_language in race_languages:
        return requested_language
    if user and user.preferred_language in race_languages:
        return user.preferred_language
    if race.default_language:
        return race.default_language
    return default_language or DEFAULT_LANGUAGE


def registration_mode(race):
    """Return race registration mode as 'team' or 'individual'."""
    return 'team' if race and race.allow_team_registration else 'individual'


def _normalize_lang(language):
    return (language or "").strip().lower()


def get_race_translation_for_language(race, language=None):
    """Return race translation object for a supported language, or None."""
    if not race:
        return None

    lang = _normalize_lang(language)
    if not lang or lang not in (race.supported_languages or []):
        return None

    return next((item for item in (race.translations or []) if item.language == lang), None)


def resolve_race_name(race, language=None):
    """Resolve race name in requested language with fallback to base race name."""
    if not race:
        return ""

    translation = get_race_translation_for_language(race, language)
    if translation and translation.name:
        return translation.name
    return race.name


def resolve_race_greeting(race, language=None):
    """Resolve race greeting in requested language with fallback to base greeting."""
    if not race:
        return ""

    translation = get_race_translation_for_language(race, language)
    if translation and translation.race_greeting is not None:
        return translation.race_greeting
    return race.race_greeting


def resolve_race_category_name(race_category, race=None, language=None):
    """Resolve race category name in requested language with sensible fallbacks."""
    if not race_category:
        return "N/A"

    lang = _normalize_lang(language)
    if not lang or not race or lang not in (race.supported_languages or []):
        return race_category.name

    translation = next(
        (item for item in (race_category.translations or []) if item.language == lang),
        None,
    )
    if translation and translation.name:
        return translation.name
    return race_category.name


def is_supported_race_language(race, language=None):
    """Check whether a language is supported by the given race."""
    if not language:
        return True
    if not race:
        return False

    lang = _normalize_lang(language)
    return lang in (race.supported_languages or [])


def find_translation_by_language(translations, language=None):
    """Return translation object for a language from a translation collection."""
    lang = _normalize_lang(language)
    if not lang:
        return None

    return next((item for item in (translations or []) if item.language == lang), None)


def resolve_title_description(base_title, base_description, translation=None):
    """Resolve title/description pair using translation with base fallback."""
    if not translation:
        return base_title, base_description

    title = translation.title if getattr(translation, "title", None) else base_title
    description = (
        translation.description
        if getattr(translation, "description", None) is not None
        else base_description
    )
    return title, description
