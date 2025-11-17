export function selectActiveRace(races) {
    // races: array of objects returned by backend (signed_races)
    // expected fields: start_showing_checkpoints, end_showing_checkpoints (ISO strings)
    if (!Array.isArray(races) || races.length === 0) return { activeRaceId: null, candidates: [] };

    const now = Date.now();
    const candidates = races.filter(r => {
        const startRaw = r.start_showing_checkpoints ?? r.start_showing_checkpoints_at ?? r.start_showing ?? r.start_logging;
        const endRaw = r.end_showing_checkpoints ?? r.end_showing_checkpoints_at ?? r.end_showing ?? r.end_logging;
        if (!startRaw || !endRaw) return false;
        const start = Date.parse(startRaw);
        const end = Date.parse(endRaw);
        if (Number.isNaN(start) || Number.isNaN(end)) return false;
        return start <= now && now <= end;
    });

    if (candidates.length === 1) {
        const first = candidates[0];
        const id = first.race_id ?? first.id ?? first.raceId;
        return { activeRaceId: id ?? null, candidates };
    }

    return { activeRaceId: null, candidates };
}