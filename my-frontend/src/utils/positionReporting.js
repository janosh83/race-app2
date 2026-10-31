import { apiFetch } from './api';
import { logger } from './logger';

// Fixes less accurate than this are useless on the admin trail map.
export const MAX_ACCURACY_M = 200;

const GEO_OPTIONS = { enableHighAccuracy: true, maximumAge: 30_000, timeout: 15_000 };

function raceIdOf(race) {
  return race?.race_id ?? race?.id ?? race?.raceId;
}

export function isLoggingWindowOpen(race, nowMs = Date.now()) {
  const start = Date.parse(race?.start_logging ?? race?.start_logging_at ?? '');
  const end = Date.parse(race?.end_logging ?? race?.end_logging_at ?? '');
  return Number.isFinite(start) && Number.isFinite(end) && start <= nowMs && nowMs <= end;
}

// Report only when the user already allowed location access (the race map
// and checkpoint list ask for it); a background timer must never pop up a
// permission prompt. Without the Permissions API we just try.
async function geolocationGranted() {
  if (!navigator.geolocation) return false;
  if (!navigator.permissions?.query) return true;
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' });
    return status.state === 'granted';
  } catch {
    return true;
  }
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, GEO_OPTIONS);
  });
}

/**
 * Send the device position for the race to the backend, so organizers can see
 * the team's trail. Does nothing outside the race logging window, without
 * location permission, or when the fix is too inaccurate. Never throws.
 * Returns true when a position was sent.
 */
export async function reportPosition(race) {
  const raceId = raceIdOf(race);
  if (raceId === undefined || raceId === null || !isLoggingWindowOpen(race)) return false;

  try {
    if (!(await geolocationGranted())) return false;
    const { coords, timestamp } = await getCurrentPosition();
    if (coords.accuracy > MAX_ACCURACY_M) {
      logger.info('GEO', 'Skipping inaccurate position report', { accuracy: coords.accuracy });
      return false;
    }
    await apiFetch(`/api/race/${raceId}/positions/`, {
      method: 'POST',
      body: {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        recorded_at: new Date(timestamp || Date.now()).toISOString(),
      },
    });
    return true;
  } catch (err) {
    logger.warn('GEO', 'Position report failed', err?.message || String(err));
    return false;
  }
}
