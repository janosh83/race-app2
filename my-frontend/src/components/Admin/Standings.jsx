import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { adminApi } from '../../services/adminApi';
import { logger } from '../../utils/logger';

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
        disqualified: !!p.disqualified,
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
  const { t } = useTranslation();
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
        logger.error('ADMIN', 'Failed to load standings', err);
        if (mounted) setError(err?.message || t('admin.standings.errorLoad'));
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
  }, [raceId, t]);

  const handleToggleDisqualification = async (teamId, current) => {
    if (!raceId || !teamId) return;
    try {
      await adminApi.setDisqualification(raceId, teamId, !current);
      const refreshed = await adminApi.getResults(raceId);
      setStandings(normalizeResults(refreshed));
    } catch (err) {
      logger.error('ADMIN', 'Failed to toggle disqualification', err);
      setError(err?.message || t('admin.standings.errorToggleDisqualification'));
    }
  };

  if (loading) return <div>{t('admin.standings.loading')}</div>;
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

  // Assign positions while keeping overall order; disqualified keep order but get dashed position
  const applyPositionLabels = (rows) => {
    const eligible = rows.filter((row) => !row.disqualified);
    const positionedEligible = computePositions(eligible);
    let idx = 0;
    return rows.map((row) => {
      if (row.disqualified) return { ...row, positionLabel: '—' };
      const label = positionedEligible[idx]?.positionLabel ?? '';
      idx += 1;
      return { ...row, positionLabel: label };
    });
  };

  // Compute overall standings with position labels
  const rowsWithPosition = applyPositionLabels(standings);

  // Group results by category
  const categoriesMap = new Map();
  standings.forEach(item => {
    const cat = item.category || t('admin.standings.uncategorized');
    if (!categoriesMap.has(cat)) {
      categoriesMap.set(cat, []);
    }
    categoriesMap.get(cat).push(item);
  });

  // Sort each category group and compute positions (excluding disqualified from ranking but keeping order)
  const categorizedResults = Array.from(categoriesMap.entries()).map(([categoryName, items]) => {
    const sorted = [...items].sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.pointsForCheckpoints !== a.pointsForCheckpoints) return b.pointsForCheckpoints - a.pointsForCheckpoints;
      return (a.teamName || '').localeCompare(b.teamName || '');
    });
    return {
      categoryName,
      results: applyPositionLabels(sorted)
    };
  }).sort((a, b) => a.categoryName.localeCompare(b.categoryName));

  const renderTable = (rows, showCategory = true) => (
    <table className="table table-sm">
      <thead>
        <tr>
          <th style={{ width: '90px' }}>{t('admin.standings.position')}</th>
          <th>{t('admin.standings.team')}</th>
          {showCategory && <th>{t('admin.standings.category')}</th>}
          <th className="text-end">{t('admin.standings.pointsCheckpoints')}</th>
          <th className="text-end">{t('admin.standings.pointsTasks')}</th>
          <th className="text-end">{t('admin.standings.totalPoints')}</th>
          <th style={{ width: '150px' }}>{t('admin.standings.disqualification')}</th>
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
            <td>
              <div className="d-flex align-items-center gap-2">
                <span className={`badge ${row.disqualified ? 'bg-danger' : 'bg-success'}`}>
                  {row.disqualified ? t('admin.standings.disqualified') : t('admin.standings.eligible')}
                </span>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-warning"
                  onClick={() => handleToggleDisqualification(row.teamId, row.disqualified)}
                >
                  {row.disqualified ? t('admin.standings.reinstate') : t('admin.standings.disqualify')}
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3 className="mb-0">{t('admin.standings.current')}</h3>
        <div className="btn-group" role="group">
          <button
            type="button"
            className={`btn btn-sm ${viewMode === 'overall' ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => setViewMode('overall')}
          >
            {t('admin.standings.overall')}
          </button>
          <button
            type="button"
            className={`btn btn-sm ${viewMode === 'byCategory' ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => setViewMode('byCategory')}
          >
            {t('admin.standings.byCategory')}
          </button>
        </div>
      </div>

      {standings.length === 0 ? (
        <div className="text-muted">{t('admin.standings.noStandings')}</div>
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