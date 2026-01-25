import React, { useEffect, useState } from 'react';
import { adminApi } from '../../services/adminApi';

function normalizeResults(payload) {
  if (!payload) return [];
  // payload already an array of simple result objects (admin)
  if (Array.isArray(payload)) {
    return payload
      .map(p => ({
        teamId: p.team_id ?? p.id ?? null,
        teamName: p.team ?? p.team_name ?? p.name ?? (p.team?.name ?? ''),
        category: p.category ?? p.category_name ?? p.race_category ?? (p.category?.name ?? ''),
        pointsForCheckpoints: p.points_for_checkpoints ?? p.points ?? p.points_for_checkpoint ?? 0,
        pointsForTasks: p.points_for_tasks ?? 0,
        totalPoints: p.total_points ?? (p.points_for_checkpoints ?? p.points ?? p.points_for_checkpoint ?? 0) + (p.points_for_tasks ?? 0),
        raw: p,
      }))
      .sort((a, b) => {
        if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
        if (b.pointsForCheckpoints !== a.pointsForCheckpoints) return b.pointsForCheckpoints - a.pointsForCheckpoints;
        return (a.teamName || '').localeCompare(b.teamName || '');
      });
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

  // Compute shared position labels: same total points => same place (e.g., 2.-4.)
  const rowsWithPosition = (() => {
    const result = [];
    let i = 0;
    let nextPlace = 1;

    while (i < standings.length) {
      const startPlace = nextPlace;
      const currentPoints = standings[i].totalPoints;
      let j = i;
      while (j < standings.length && standings[j].totalPoints === currentPoints) {
        j += 1;
      }
      const endPlace = nextPlace + (j - i) - 1;
      const label = startPlace === endPlace ? `${startPlace}.` : `${startPlace}.-${endPlace}.`;
      for (let k = i; k < j; k += 1) {
        result.push({ ...standings[k], positionLabel: label });
      }
      nextPlace = endPlace + 1;
      i = j;
    }

    return result;
  })();

  return (
    <div>
      <h3>Current Standings</h3>

      {standings.length === 0 ? (
        <div className="text-muted">No standings available</div>
      ) : (
        <table className="table table-sm">
          <thead>
            <tr>
              <th style={{ width: '90px' }}>Position</th>
              <th>Team</th>
              <th>Category</th>
              <th className="text-end">Points for Checkpoints</th>
              <th className="text-end">Points for Tasks</th>
              <th className="text-end">Total Points</th>
            </tr>
          </thead>
          <tbody>
            {rowsWithPosition.map((row, idx) => (
              <tr key={row.teamId ?? idx}>
                <td style={{ fontWeight: 600 }}>{row.positionLabel}</td>
                <td>
                  {onTeamClick ? (
                    <button className="btn btn-link p-0" onClick={() => onTeamClick(row.teamId || row.raw?.team_id || row.raw?.id)}>{row.teamName}</button>
                  ) : (
                    row.teamName
                  )}
                </td>
                <td>{row.category}</td>
                <td className="text-end">{row.pointsForCheckpoints}</td>
                <td className="text-end">{row.pointsForTasks}</td>
                <td className="text-end"><strong>{row.totalPoints}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}