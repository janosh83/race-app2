export function getRaceId(race) {
  if (!race) return null;
  return race.race_id ?? race.id ?? race.raceId ?? null;
}

export function resolveRaceRecord(race, races = []) {
  const raceId = getRaceId(race);
  if (raceId == null || !Array.isArray(races)) return race || null;
  return races.find(candidate => getRaceId(candidate) === raceId) || race || null;
}

/**
 * Finds all signed-race records that are currently active within their effective
 * checkpoint/logging window.
 *
 * Selection criteria:
 * - Checks multiple possible field names for start/end times (handles API variations)
 * - Parses ISO timestamp strings to milliseconds since epoch
 * - Returns only records where: startTime <= currentTime <= endTime
 *
 * @param {Array} races - Array of signed-race records from backend
 * @returns {Array} Signed-race records currently active/in-progress
 */
export function findCandidates(races = []) {
  const now = Date.now();
  if (!races || !Array.isArray(races)) return [];
  return races.filter(r => {
    // Try multiple field names (API flexibility for different endpoint responses)
    const startRaw = r.start_showing_checkpoints || r.start_showing_checkpoints_at || r.start_showing || r.start_logging;
    const endRaw = r.end_showing_checkpoints || r.end_showing_checkpoints_at || r.end_showing || r.end_logging;

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
 * @param {Array} races - Array of signed-race records returned by backend (signed_races)
 *                        Expected to contain: race_id/id/raceId, start/end timestamp fields
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
        // Try multiple possible ID field names (API flexibility)
        return { activeRaceId: getRaceId(first), candidates };
    }

    // Step 3: If 0 or 2+ races are active, return null (no auto-selection)
    // In this case, the frontend should display a race picker UI
    return { activeRaceId: null, candidates };
}