import React, { useEffect, useState } from 'react';
import { adminApi } from '../../services/adminApi';

function normalizeResults(payload) {
  if (!payload) return [];
  // payload already an array of simple result objects (admin)
  if (Array.isArray(payload)) {
    return payload.map(p => ({
      teamId: p.team_id ?? p.id ?? null,
      teamName: p.team ?? p.team_name ?? p.name ?? (p.team?.name ?? ''),
      category: p.category ?? p.category_name ?? p.race_category ?? (p.category?.name ?? ''),
      points: p.points_for_checkpoints ?? p.points ?? p.points_for_checkpoint ?? 0,
      raw: p,
    }));
  }
  // wrapper objects: { data: [...] } or { results: [...] } etc.
  const arr = payload.data ?? payload.results ?? payload.standings ?? payload.items;
  if (Array.isArray(arr)) return normalizeResults(arr);
  return [];
}

export default function Standings({ raceId, onTeamClick }) {
  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await adminApi.getResults(raceId);
        const list = normalizeResults(payload);
        if (mounted) setStandings(list);
      } catch (err) {
        console.error('Failed to load standings', err);
        if (mounted) setError(err?.message || 'Failed to load standings');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    if (raceId) load();
    else {
      setStandings([]);
      setLoading(false);
    }

    return () => { mounted = false; };
  }, [raceId]);

  if (loading) return <div>Loading standings…</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <div>
      <h3>Current Standings</h3>

      {standings.length === 0 ? (
        <div className="text-muted">No standings available</div>
      ) : (
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Team</th>
              <th>Category</th>
              <th className="text-end">Points</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row, idx) => (
              <tr key={row.teamId ?? idx}>
                <td>
                  {onTeamClick ? (
                    <button className="btn btn-link p-0" onClick={() => onTeamClick(row.teamId || row.raw?.team_id || row.raw?.id)}>{row.teamName}</button>
                  ) : (
                    row.teamName
                  )}
                </td>
                <td>{row.category}</td>
                <td className="text-end">{row.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}