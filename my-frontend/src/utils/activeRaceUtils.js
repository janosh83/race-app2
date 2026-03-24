/**
 * Finds all races that are currently active (within their checkpoint logging window).
 * A race is a candidate if the current time falls between its start and end times.
 *
 * Selection criteria:
 * - Uses canonical *_at fields from the API contract
 * - Parses ISO timestamp strings to milliseconds since epoch
 * - Returns only races where: startTime <= currentTime <= endTime
 *
 * @param {Array} races - Array of race objects from backend
 * @returns {Array} Races currently active/in-progress
 */
export function findCandidates(races = []) {
  const now = Date.now();
  if (!races || !Array.isArray(races)) return [];
  return races.filter(r => {
    const startRaw = r.start_showing_checkpoints_at;
    const endRaw = r.end_showing_checkpoints_at;

    // Parse ISO strings to timestamps, or null if not available
    const start = startRaw ? Date.parse(startRaw) : null;
    const end = endRaw ? Date.parse(endRaw) : null;

    // Include race only if both times exist and current time is within the window
    return start && end && start <= now && now <= end;
  });
}

/**
 * Selects the active race for the current user session.
 *
 * SELECTION LOGIC:
 * 1. Find all candidate races (currently within their time window) via findCandidates()
 * 2. If exactly 1 candidate exists -> that's the active race (auto-selected)
 * 3. If 0 or 2+ candidates exist -> no single active race (ambiguous or none available)
 *
 * Use case: When a user has multiple races they can access, this determines which one
 * is currently "active" for checkpoint logging. If exactly one race is in progress,
 * it's automatically selected; otherwise the app must prompt user to choose.
 *
 * @param {Array} races - Array of race objects returned by backend (signed_races)
 *                        Expected to contain: race_id and canonical *_at timestamp fields
 * @returns {Object} { activeRaceId: number|null, candidates: Array }
 *                   activeRaceId is set only if exactly 1 candidate race exists
 */
export function selectActiveRace(races) {
    if (!Array.isArray(races) || races.length === 0) return { activeRaceId: null, candidates: [] };

    // Step 1: Find races that are currently active (within their time window)
    const candidates = findCandidates(races);

    // Step 2: If exactly one race is active, select it automatically
    if (candidates.length === 1) {
        const first = candidates[0];
      const id = first.race_id;
        return { activeRaceId: id ?? null, candidates };
    }

    // Step 3: If 0 or 2+ races are active, return null (no auto-selection)
    // In this case, the frontend should display a race picker UI
    return { activeRaceId: null, candidates };
}