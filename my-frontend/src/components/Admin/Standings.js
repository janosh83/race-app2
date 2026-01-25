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
  const [viewMode, setViewMode] = useState('overall'); // 'overall' or 'byCategory'

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

  // Helper function to compute position labels for a set of results
  const computePositions = (resultsList) => {
    const result = [];
    let i = 0;
    let nextPlace = 1;

    while (i < resultsList.length) {
      const startPlace = nextPlace;
      const currentPoints = resultsList[i].totalPoints;
      let j = i;
      while (j < resultsList.length && resultsList[j].totalPoints === currentPoints) {
        j += 1;
      }
      const endPlace = nextPlace + (j - i) - 1;
      const label = startPlace === endPlace ? `${startPlace}.` : `${startPlace}.-${endPlace}.`;
      for (let k = i; k < j; k += 1) {
        result.push({ ...resultsList[k], positionLabel: label });
      }
      nextPlace = endPlace + 1;
      i = j;
    }

    return result;
  };

  // Compute overall standings with position labels
  const rowsWithPosition = computePositions(standings);

  // Group results by category
  const categoriesMap = new Map();
  standings.forEach(item => {
    const cat = item.category || 'Uncategorized';
    if (!categoriesMap.has(cat)) {
      categoriesMap.set(cat, []);
    }
    categoriesMap.get(cat).push(item);
  });

  // Sort each category group and compute positions
  const categorizedResults = Array.from(categoriesMap.entries()).map(([categoryName, items]) => {
    const sorted = [...items].sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.pointsForCheckpoints !== a.pointsForCheckpoints) return b.pointsForCheckpoints - a.pointsForCheckpoints;
      return (a.teamName || '').localeCompare(b.teamName || '');
    });
    return {
      categoryName,
      results: computePositions(sorted)
    };
  }).sort((a, b) => a.categoryName.localeCompare(b.categoryName));

  const renderTable = (rows, showCategory = true) => (
    <table className="table table-sm">
      <thead>
        <tr>
          <th style={{ width: '90px' }}>Position</th>
          <th>Team</th>
          {showCategory && <th>Category</th>}
          <th className="text-end">Points for Checkpoints</th>
          <th className="text-end">Points for Tasks</th>
          <th className="text-end">Total Points</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => (
          <tr key={row.teamId ?? idx}>
            <td style={{ fontWeight: 600 }}>{row.positionLabel}</td>
            <td>
              {onTeamClick ? (
                <button className="btn btn-link p-0" onClick={() => onTeamClick(row.teamId || row.raw?.team_id || row.raw?.id)}>{row.teamName}</button>
              ) : (
                row.teamName
              )}
            </td>
            {showCategory && <td>{row.category}</td>}
            <td className="text-end">{row.pointsForCheckpoints}</td>
            <td className="text-end">{row.pointsForTasks}</td>
            <td className="text-end"><strong>{row.totalPoints}</strong></td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3 className="mb-0">Current Standings</h3>
        <div className="btn-group" role="group">
          <button
            type="button"
            className={`btn btn-sm ${viewMode === 'overall' ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => setViewMode('overall')}
          >
            Overall
          </button>
          <button
            type="button"
            className={`btn btn-sm ${viewMode === 'byCategory' ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => setViewMode('byCategory')}
          >
            By Category
          </button>
        </div>
      </div>

      {standings.length === 0 ? (
        <div className="text-muted">No standings available</div>
      ) : (
        <>
          {viewMode === 'overall' ? (
            renderTable(rowsWithPosition, true)
          ) : (
            <>
              {categorizedResults.map(({ categoryName, results }) => (
                <div key={categoryName} className="mb-4">
                  <h5 className="mb-2">{categoryName}</h5>
                  {renderTable(results, false)}
                </div>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}