export function findCandidates(races = []) {
  const now = Date.now();
  return races.filter(r => {
    const startRaw = r.start_showing_checkpoints || r.start_showing_checkpoints_at || r.start_showing || r.start_logging;
    const endRaw = r.end_showing_checkpoints || r.end_showing_checkpoints_at || r.end_showing || r.end_logging;
    const start = startRaw ? Date.parse(startRaw) : null;
    const end = endRaw ? Date.parse(endRaw) : null;
    return start && end && start <= now && now <= end;
  });
}

export function selectActiveRace(races) {
    // races: array of objects returned by backend (signed_races)
    // expected fields: start_showing_checkpoints, end_showing_checkpoints (ISO strings)
    if (!Array.isArray(races) || races.length === 0) return { activeRaceId: null, candidates: [] };

    const candidates = findCandidates(races);

    if (candidates.length === 1) {
        const first = candidates[0];
        const id = first.race_id ?? first.id ?? first.raceId;
        return { activeRaceId: id ?? null, candidates };
    }

    return { activeRaceId: null, candidates };
}