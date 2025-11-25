import React, { useEffect, useState } from 'react';
import { adminApi } from '../../services/adminApi';

export default function VisitsList({ teamId }) {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchVisits = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await adminApi.getVisitsByTeam(teamId);
        setVisits(data);
      } catch (err) {
        console.error('Failed to load visits', err);
        setError('Failed to load visits');
      } finally {
        setLoading(false);
      }
    };

    fetchVisits();
  }, [teamId]);

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
      <h3>Visits</h3>
      <ul>
        {visits.map(visit => (
          <li key={visit.id}>
            <span>{visit.time} - {visit.image && <img src={visit.image} alt="Visit" width="50" />}</span>
            <button onClick={() => handleDelete(visit.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}