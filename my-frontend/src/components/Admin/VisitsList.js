import React, { useEffect, useState } from 'react';
import { adminApi } from '../../services/adminApi';

function formatDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

export default function VisitsList({ teamId, raceId }) {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchVisits = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await adminApi.getVisitsByTeamAndRace(teamId, raceId);
        setVisits(Array.isArray(data) ? data : (data?.data || []));
      } catch (err) {
        console.error('Failed to load visits', err);
        setError('Failed to load visits');
      } finally {
        setLoading(false);
      }
    };

    if (teamId && raceId) fetchVisits();
  }, [teamId, raceId]);

  const handleDelete = async (visitId) => {
    if (window.confirm('Are you sure you want to delete this visit?')) {
      try {
        await adminApi.deleteVisit(visitId);
        setVisits(visits.filter(visit => visit.id !== visitId));
      } catch (err) {
        console.error('Failed to delete visit', err);
      }
    }
  };

  if (loading) return <div>Loading visits...</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <div>
      {visits.length === 0 ? (
        <div className="text-muted">No visits</div>
      ) : (
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Checkpoint</th>
              <th>Time</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visits.map(visit => (
              <tr key={visit.id}>
                <td>{visit.checkpoint || `#${visit.checkpoint_id}`}</td>
                <td>{formatDate(visit.created_at)}</td>
                <td>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(visit.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}