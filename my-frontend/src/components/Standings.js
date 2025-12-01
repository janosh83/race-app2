import React, { useEffect, useState } from 'react';
import { isTokenExpired, logoutAndRedirect } from '../utils/api';
import { raceApi } from '../services/raceApi';

function Standings() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
      {results.length === 0 ? (
        <p>No results available for this race.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Team</th>
              <th>Category</th>
              <th>Points for Checkpoints</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result, index) => (
              <tr key={index}>
                <td>{result.team}</td>
                <td>{result.category}</td>
                <td>{result.points_for_checkpoints}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default Standings;