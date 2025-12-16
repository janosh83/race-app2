from datetime import datetime, timezone

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
        from dateutil import parser
        dt = parser.parse(s)
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        raise ValueError(f"unrecognized datetime format: {s}")