from datetime import datetime, timedelta
from types import SimpleNamespace

from app.utils import get_registration_time_windows


def test_fixed_mode_uses_race_windows_for_all_teams():
    now = datetime.utcnow()
    race = SimpleNamespace(
        time_constraint_mode='fixed',
        start_showing_checkpoints_at=now,
        end_showing_checkpoints_at=now + timedelta(hours=12),
        start_logging_at=now + timedelta(hours=1),
        end_logging_at=now + timedelta(hours=3),
    )
    registration = SimpleNamespace(
        start_showing_checkpoints_at=None,
        end_showing_checkpoints_at=None,
        start_logging_at=None,
        end_logging_at=None,
        payment_confirmed_at=now + timedelta(days=3),
    )

    windows = get_registration_time_windows(registration, race)

    assert windows['start_showing_checkpoints_at'] == race.start_showing_checkpoints_at
    assert windows['end_showing_checkpoints_at'] == race.end_showing_checkpoints_at
    assert windows['start_logging_at'] == race.start_logging_at
    assert windows['end_logging_at'] == race.end_logging_at


def test_registration_shift_mode_uses_offsets_from_payment_confirmation():
    anchor = datetime.utcnow()
    race = SimpleNamespace(
        time_constraint_mode='registration_shift',
        start_showing_checkpoints_at=anchor,
        end_showing_checkpoints_at=anchor,
        start_logging_at=anchor,
        end_logging_at=anchor,
        start_showing_offset_seconds=30 * 24 * 3600,
        end_showing_offset_seconds=32 * 24 * 3600,
        start_logging_offset_seconds=30 * 24 * 3600,
        end_logging_offset_seconds=32 * 24 * 3600,
    )
    registration = SimpleNamespace(
        start_showing_checkpoints_at=None,
        end_showing_checkpoints_at=None,
        start_logging_at=None,
        end_logging_at=None,
        payment_confirmed_at=anchor,
    )

    windows = get_registration_time_windows(registration, race)

    assert windows['start_showing_checkpoints_at'] == anchor + timedelta(days=30)
    assert windows['start_logging_at'] == anchor + timedelta(days=30)
    assert windows['end_showing_checkpoints_at'] == anchor + timedelta(days=32)
    assert windows['end_logging_at'] == anchor + timedelta(days=32)


def test_registration_shift_mode_derives_offsets_from_existing_race_window_when_missing():
    base = datetime.utcnow()
    race = SimpleNamespace(
        time_constraint_mode='registration_shift',
        start_showing_checkpoints_at=base - timedelta(days=2),
        end_showing_checkpoints_at=base + timedelta(days=3),
        start_logging_at=base,
        end_logging_at=base + timedelta(hours=48),
        start_showing_offset_seconds=None,
        end_showing_offset_seconds=None,
        start_logging_offset_seconds=None,
        end_logging_offset_seconds=None,
    )
    anchor = base + timedelta(days=7)
    registration = SimpleNamespace(
        start_showing_checkpoints_at=None,
        end_showing_checkpoints_at=None,
        start_logging_at=None,
        end_logging_at=None,
        payment_confirmed_at=anchor,
    )

    windows = get_registration_time_windows(registration, race)

    assert windows['start_showing_checkpoints_at'] == anchor - timedelta(days=2)
    assert windows['start_logging_at'] == anchor
    assert windows['end_logging_at'] == anchor + timedelta(hours=48)
    assert windows['end_showing_checkpoints_at'] == anchor + timedelta(days=3)
