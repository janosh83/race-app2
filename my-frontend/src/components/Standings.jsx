import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { raceApi } from '../services/raceApi';
import { isTokenExpired, logoutAndRedirect } from '../utils/api';

const normalizeComparableId = (value) => (
  value === null || value === undefined ? null : String(value)
);

function Standings() {
  const { t } = useTranslation();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const activeRace = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('activeRace') || 'null');
    } catch {
      return null;
    }
  }, []);
  const activeRaceId = activeRace?.race_id ?? activeRace?.id ?? activeRace?.raceId;
  const activeTeamId = normalizeComparableId(activeRace?.team_id);

  // Normalize/sort and compute ranking once results change
  const rankedResults = useMemo(() => {
    const arr = Array.isArray(results)
      ? results.map((result) => ({
          ...result,
          normalizedTeamId: normalizeComparableId(result?.team_id ?? result?.id),
        }))
      : [];
    arr.sort((a, b) => {
      const totalA = a?.total_points ?? 0;
      const totalB = b?.total_points ?? 0;
      if (totalB !== totalA) return totalB - totalA;
      const checkpointsA = a?.points_for_checkpoints ?? 0;
      const checkpointsB = b?.points_for_checkpoints ?? 0;
      if (checkpointsB !== checkpointsA) return checkpointsB - checkpointsA;
      return (a?.team || '').localeCompare(b?.team || '');
    });

    // Compute shared position labels: same total points => same place (e.g., 2.-4.)
    const result = [];
    let i = 0;
    let nextPlace = 1;

    while (i < arr.length) {
      const startPlace = nextPlace;
      const currentPoints = arr[i]?.total_points ?? 0;
      let j = i;
      while (j < arr.length && (arr[j]?.total_points ?? 0) === currentPoints) {
        j += 1;
      }
      const endPlace = nextPlace + (j - i) - 1;
      const label = startPlace === endPlace ? `${startPlace}.` : `${startPlace}.-${endPlace}.`;
      for (let k = i; k < j; k += 1) {
        result.push({ ...arr[k], positionLabel: label });
      }
      nextPlace = endPlace + 1;
      i = j;
    }

    return result;
  }, [results]);

  useEffect(() => {
    const check = () => {
      const token = localStorage.getItem('accessToken');
      if (!token) return;
      if (isTokenExpired(token, 5)) logoutAndRedirect();
    };
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const fetchResults = async () => {
      if (!activeRaceId) {
        setError(t('results.noActiveRace'));
        setLoading(false);
        return;
      }

      try {
      // Use raceApi proxy which uses apiFetch under the hood
      const payload = await raceApi.getResults(activeRaceId);
        // normalize common shapes: array or { data: [...] } etc.
        const data = Array.isArray(payload) ? payload : (payload?.data || payload?.results || payload?.standings || []);
        setResults(data);
      } catch (err) {
        setError(err?.message || t('results.fetchFailed'));
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [activeRaceId, t]);

  if (loading) return <div>{t('results.loading')}</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  const isOwnTeam = (result) => activeTeamId !== null && result.normalizedTeamId === activeTeamId;

  const renderPointsCell = (result, value, emphasize = false) => {
    if (!isOwnTeam(result)) {
      return <span aria-label="hidden-points">-</span>;
    }

    return emphasize ? <strong>{value}</strong> : value;
  };

  return (
    <div className="container mt-5">
      <h1>{t('results.title')}</h1>
      {rankedResults.length === 0 ? (
        <p>{t('results.noResults')}</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>{t('results.position')}</th>
              <th>{t('results.team')}</th>
              <th>{t('results.category')}</th>
              <th>{t('results.pointsCheckpoints')}</th>
              <th>{t('results.pointsTasks')}</th>
              <th>{t('results.pointsTotal')}</th>
            </tr>
          </thead>
          <tbody>
            {rankedResults.map((result, index) => (
              <tr
                key={index}
                className={isOwnTeam(result) ? 'table-warning' : ''}
                style={isOwnTeam(result) ? { boxShadow: 'inset 4px 0 0 #fd7e14' } : undefined}
              >
                <td style={{ fontWeight: 600 }}>{result.positionLabel}</td>
                <td>{result.team}</td>
                <td>{result.category}</td>
                <td>{renderPointsCell(result, result.points_for_checkpoints)}</td>
                <td>{renderPointsCell(result, result.points_for_tasks)}</td>
                <td>{renderPointsCell(result, result.total_points, true)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default Standings;