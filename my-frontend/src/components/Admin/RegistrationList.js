import React, { useEffect, useState } from 'react';
import { adminApi } from '../../services/adminApi';

export default function RegistrationList({ raceId }) {
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await adminApi.getRegistrations(raceId);
      // normalize to array if backend wraps result
      const regs = Array.isArray(payload) ? payload : (payload?.data || payload?.results || payload?.registrations || []);
      setRegistrations(regs || []);
    } catch (err) {
      setError('Failed to load registrations');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (raceId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raceId]);

  const refresh = () => load();

  if (!raceId) return null;

  return (
    <div className="mt-3">
      <div className="d-flex align-items-center mb-2">
        <h4 className="me-3">Registrations</h4>
        <button type="button" className="btn btn-sm btn-outline-secondary ms-auto" onClick={refresh}>Refresh</button>
      </div>

      {loading && <div>Loading…</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      <table className="table table-sm">
        <thead>
          <tr>
            <th>Team</th>
            <th>Category</th>
          </tr>
        </thead>
        <tbody>
          {(!registrations || registrations.length === 0) && (
            <tr><td colSpan="2" className="text-muted">No registrations</td></tr>
          )}
          {registrations.map((reg, idx) => {
            const teamName = reg.name || reg.team?.name || `#${reg.id ?? reg.team_id ?? idx}`;
            const categoryName = reg.race_category || reg.category || reg.category_name || '';
            return (
              <tr key={reg.id ?? reg.team_id ?? idx}>
                <td>{teamName}</td>
                <td>{categoryName}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}