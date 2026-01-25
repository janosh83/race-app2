import React, { useEffect, useMemo, useState } from 'react';
import { isTokenExpired, logoutAndRedirect } from '../utils/api';
import { raceApi } from '../services/raceApi';

function Standings() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Normalize/sort and compute ranking once results change
  const rankedResults = useMemo(() => {
    const arr = Array.isArray(results) ? [...results] : [];
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
      const active = JSON.parse(localStorage.getItem('activeRace') || 'null');
      const activeRaceId = active?.race_id ?? active?.id ?? active?.raceId;
      if (!activeRaceId) {
        setError('No active race found.');
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
        setError(err?.message || 'Failed to fetch results');
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, []);

  if (loading) return <div>Loading results...</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <div className="container mt-5">
      <h1>Race Results</h1>
      {rankedResults.length === 0 ? (
        <p>No results available for this race.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Team</th>
              <th>Category</th>
              <th>Points for Checkpoints</th>
              <th>Points for Tasks</th>
              <th>Total Points</th>
            </tr>
          </thead>
          <tbody>
            {rankedResults.map((result, index) => (
              <tr key={index}>
                <td style={{ fontWeight: 600 }}>{result.positionLabel}</td>
                <td>{result.team}</td>
                <td>{result.category}</td>
                <td>{result.points_for_checkpoints}</td>
                <td>{result.points_for_tasks}</td>
                <td><strong>{result.total_points}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default Standings;