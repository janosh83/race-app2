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

// Position labels ("1.", or "2.-3." for a tie) for rows sorted by points.
function computePositions(resultsList) {
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
}

// Assign positions while keeping overall order; disqualified keep order but get dashed position
function applyPositionLabels(rows) {
  const eligible = rows.filter((row) => !row.disqualified);
  const positionedEligible = computePositions(eligible);
  let idx = 0;
  return rows.map((row) => {
    if (row.disqualified) return { ...row, positionLabel: '—' };
    const label = positionedEligible[idx]?.positionLabel ?? '';
    idx += 1;
    return { ...row, positionLabel: label };
  });
}

// Disqualifying is done per registration (Registrations tab); here a
// disqualified team only gets a badge and no place.
// `compact` is the narrow column next to a team's visits: short headings and
// the category under the team name at every width. `selectedTeamId` marks the
// row whose visits are open.
export default function Standings({
  raceId, onTeamClick, onLoaded, onOpenRegistrations, refreshVersion = 0, selectedTeamId = null, compact = false,
}) {
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
        if (mounted) {
          setStandings(list);
          onLoaded?.(applyPositionLabels(list));
        }
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
    // onLoaded is a notification only; a new callback identity must not reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raceId, refreshVersion, t]);

  const handleTeamKeyDown = (event, teamId) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onTeamClick?.(teamId);
    }
  };

  // A refresh (after a visit is deleted) keeps the table on screen.
  if (loading && standings.length === 0) return <div>{t('admin.standings.loading')}</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;

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

  // Full heading from 768px up, a short one on phones.
  const heading = (full, short) => (compact ? t(short) : (
    <>
      <span className="d-none d-md-inline">{t(full)}</span>
      <span className="d-md-none">{t(short)}</span>
    </>
  ));
  const categoryColumnClass = compact ? 'd-none' : 'd-none d-sm-table-cell';
  const categoryUnderNameClass = compact ? 'small text-muted' : 'small text-muted d-sm-none';

  // Phones (e.g. reading results out at the finish): short headings and the
  // category under the team name, so the total stays on screen. The table
  // scrolls inside its box, not the page.
  const renderTable = (rows, showCategory = true) => (
    <div className="table-responsive">
      <table className="table table-sm align-middle">
        <thead>
          <tr>
            <th className="text-nowrap">{heading('admin.standings.position', 'admin.standings.positionShort')}</th>
            <th>{t('admin.standings.team')}</th>
            {showCategory && <th className={categoryColumnClass}>{t('admin.standings.category')}</th>}
            <th className="text-end">{heading('admin.standings.pointsCheckpoints', 'admin.standings.pointsCheckpointsShort')}</th>
            <th className="text-end">{heading('admin.standings.pointsTasks', 'admin.standings.pointsTasksShort')}</th>
            <th className="text-end">{heading('admin.standings.totalPoints', 'admin.standings.totalPointsShort')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const selected = selectedTeamId !== null && String(row.teamId) === String(selectedTeamId);
            const teamId = row.teamId || row.raw?.team_id || row.raw?.id;
            const rowClasses = [onTeamClick && 'admin-standings-clickable', selected && 'table-active admin-standings-selected'];
            return (
              // The whole row opens the team (a big target on phones); the team
              // name stays the keyboard-focusable control.
              <tr
                key={row.teamId ?? idx}
                className={rowClasses.filter(Boolean).join(' ') || undefined}
                aria-current={selected ? 'true' : undefined}
                onClick={onTeamClick ? () => onTeamClick(teamId) : undefined}
              >
                <td className="text-nowrap" style={{ fontWeight: 600 }}>{row.positionLabel}</td>
                <td>
                  {onTeamClick ? (
                    <span
                      role="button"
                      tabIndex={0}
                      className="text-primary text-decoration-underline"
                      style={{ cursor: 'pointer' }}
                      onKeyDown={(event) => handleTeamKeyDown(event, teamId)}
                    >
                      {row.teamName}
                    </span>
                  ) : (
                    row.teamName
                  )}
                  {row.disqualified && (
                    <span className="badge bg-danger-subtle text-danger-emphasis ms-2">{t('admin.standings.disqualified')}</span>
                  )}
                  {showCategory && row.category && (
                    <div className={categoryUnderNameClass} aria-hidden="true">{row.category}</div>
                  )}
                </td>
                {showCategory && <td className={categoryColumnClass}>{row.category}</td>}
                <td className="text-end">{row.pointsForCheckpoints}</td>
                <td className="text-end">{row.pointsForTasks}</td>
                <td className="text-end"><strong>{row.totalPoints}</strong></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <h3 className={compact ? 'h5 mb-0' : 'mb-0'}>{t('admin.standings.current')}</h3>
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
          {standings.some(row => row.disqualified) && (
            <p className="small text-muted mb-0">
              {t('admin.standings.disqualifiedNote')}{' '}
              {onOpenRegistrations && (
                <button type="button" className="btn btn-link btn-sm p-0 align-baseline" onClick={onOpenRegistrations}>
                  {t('admin.standings.openRegistrations')}
                </button>
              )}
            </p>
          )}
        </>
      )}
    </div>
  );
}