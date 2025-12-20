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
  const [taskCompletions, setTaskCompletions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [visitsData, tasksData] = await Promise.all([
          adminApi.getVisitsByTeamAndRace(teamId, raceId),
          adminApi.getTaskCompletionsByTeamAndRace(teamId, raceId)
        ]);
        setVisits(Array.isArray(visitsData) ? visitsData : (visitsData?.data || []));
        setTaskCompletions(Array.isArray(tasksData) ? tasksData : (tasksData?.data || []));
      } catch (err) {
        console.error('Failed to load visits or tasks', err);
        setError('Failed to load visits or tasks');
      } finally {
        setLoading(false);
      }
    };

    if (teamId && raceId) fetchData();
  }, [teamId, raceId]);

  const handleDeleteVisit = async (visitId) => {
    if (window.confirm('Are you sure you want to delete this visit?')) {
      try {
        await adminApi.deleteVisit(visitId);
        setVisits(visits.filter(visit => visit.id !== visitId));
      } catch (err) {
        console.error('Failed to delete visit', err);
      }
    }
  };

  const handleDeleteTaskCompletion = async (taskLogId) => {
    if (window.confirm('Are you sure you want to delete this task completion?')) {
      try {
        await adminApi.deleteTaskCompletion(taskLogId);
        setTaskCompletions(taskCompletions.filter(task => task.id !== taskLogId));
      } catch (err) {
        console.error('Failed to delete task completion', err);
      }
    }
  };

  if (loading) return <div>Loading visits and tasks...</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  const allItems = [
    ...visits.map(v => ({ ...v, type: 'visit', sortTime: v.created_at })),
    ...taskCompletions.map(t => ({ ...t, type: 'task', sortTime: t.created_at }))
  ].sort((a, b) => new Date(b.sortTime) - new Date(a.sortTime));

  return (
    <div>
      {allItems.length === 0 ? (
        <div className="text-muted">No visits or task completions</div>
      ) : (
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Type</th>
              <th>Details</th>
              <th>Time</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {allItems.map(item => (
              <tr key={`${item.type}-${item.id}`}>
                <td>
                  <span className={`badge ${item.type === 'visit' ? 'bg-primary' : 'bg-success'}`}>
                    {item.type === 'visit' ? 'Checkpoint' : 'Task'}
                  </span>
                </td>
                <td>
                  {item.type === 'visit' ? (
                    item.checkpoint || `#${item.checkpoint_id}`
                  ) : (
                    item.task || item.task_title || 'Task'
                  )}
                </td>
                <td>{formatDate(item.created_at)}</td>
                <td>
                  <button 
                    className="btn btn-sm btn-danger" 
                    onClick={() => item.type === 'visit' ? handleDeleteVisit(item.id) : handleDeleteTaskCompletion(item.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}