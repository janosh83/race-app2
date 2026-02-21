import logging
from datetime import datetime, timezone
from math import radians, sin, cos, sqrt, atan2
from dateutil import parser
from PIL import Image
from app.constants import DEFAULT_LANGUAGE

logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif"}


def allowed_file(filename: str) -> bool:
    """Check whether a filename has an allowed image extension."""
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

def parse_datetime(s: str) -> datetime:
    """Parse common datetime string formats into a timezone-aware UTC datetime."""
    if s is None:
        raise ValueError("empty string")

    # handle ISO 8601 with trailing Z
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    try:
        # accepts "YYYY-MM-DDTHH:MM:SS" and with timezone offset
        dt = datetime.fromisoformat(s)
        # make tz-aware UTC if naive
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
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
            dt = datetime.strptime(s, fmt)
            return dt.replace(tzinfo=timezone.utc)
        except ValueError:
            continue

    # fallback: use dateutil if available (more flexible)
    try:
        dt = parser.parse(s)
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
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
        image = Image.open(image_path)
        exif_data = image.getexif()

        if not exif_data:
            logger.debug("No EXIF data found in image: %s", image_path)
            return None, None

        # GPS IFD tags
        gps_ifd_tag = 34853
        if gps_ifd_tag not in exif_data:
            logger.debug("No GPS data in EXIF for image: %s", image_path)
            return None, None

        gps_data = exif_data[gps_ifd_tag]

        # GPS tags: North/South (1) and East/West (3)
        lat_tag = 2  # North latitude
        lon_tag = 4  # East longitude
        lat_ref_tag = 1  # North/South reference
        lon_ref_tag = 3  # East/West reference

        if lat_tag in gps_data and lon_tag in gps_data:
            lat = _convert_to_degrees(gps_data[lat_tag])
            lon = _convert_to_degrees(gps_data[lon_tag])

            # Apply reference (negative for South/West)
            if gps_data.get(lat_ref_tag) == 'S':
                lat = -lat
            if gps_data.get(lon_ref_tag) == 'W':
                lon = -lon

            logger.info("Extracted GPS coordinates from image: (%s, %s)", lat, lon)
            return lat, lon

        logger.debug("Incomplete GPS data in image: %s", image_path)
        return None, None

    except (OSError, AttributeError, TypeError, ValueError, KeyError) as err:
        logger.warning("Failed to extract coordinates from image %s: %s", image_path, err)
        return None, None


def _convert_to_degrees(value) -> float:
    """
    Convert GPS coordinates from EXIF format to decimal degrees.
    EXIF GPS coordinates are in (degrees, minutes, seconds) format.
    """
    try:
        d, m, s = value
        return float(d) + (float(m) / 60.0) + (float(s) / 3600.0)
    except (TypeError, ValueError, ZeroDivisionError) as e:
        logger.warning("Failed to convert GPS value %s to degrees: %s", value, e)
        return 0.0


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
