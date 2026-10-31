// Visits logged farther than this from the checkpoint are flagged for review.
export const POSITION_THRESHOLD_KM = 0.2;

const toDistance = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/**
 * Decide which position to trust when an admin reviews a checkpoint visit:
 * 1. neither the photo nor the device position is known -> 'missing' (verify manually);
 * 2. only one is known -> use it;
 * 3. both are known -> use the photo, which shows where the picture was taken
 *    (the device position is only where the phone was when the visit was logged).
 *
 * Returns { status: 'missing' | 'far' | 'ok', source: 'image' | 'user' | null, distanceKm }.
 */
export function assessVisitPosition(visit, thresholdKm = POSITION_THRESHOLD_KM) {
  const imageDistance = toDistance(visit?.image_distance_km);
  const userDistance = toDistance(visit?.user_distance_km);

  if (imageDistance === null && userDistance === null) {
    return { status: 'missing', source: null, distanceKm: null };
  }

  const source = imageDistance !== null ? 'image' : 'user';
  const distanceKm = source === 'image' ? imageDistance : userDistance;
  return { status: distanceKm > thresholdKm ? 'far' : 'ok', source, distanceKm };
}
