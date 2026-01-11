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

// Determine if a warning indicator should be shown for distance validation
function getDistanceWarning(visit) {
  const imageDistance = visit.image_distance_km;
  const userDistance = visit.user_distance_km;
  const THRESHOLD_KM = 0.2; // 200 meters
  
  // Both positions not available
  if (imageDistance === null && imageDistance === undefined &&
      userDistance === null && userDistance === undefined) {
    return {
      show: true,
      reason: 'No position data',
      className: 'bg-secondary'
    };
  }
  
  // Only one distance available and it's > 200m
  if ((imageDistance !== null && imageDistance !== undefined) &&
      (userDistance === null || userDistance === undefined)) {
    if (imageDistance > THRESHOLD_KM) {
      return {
        show: true,
        reason: `Image: ${(imageDistance * 1000).toFixed(0)}m`,
        className: 'bg-warning'
      };
    }
  }
  
  if ((userDistance !== null && userDistance !== undefined) &&
      (imageDistance === null || imageDistance === undefined)) {
    if (userDistance > THRESHOLD_KM) {
      return {
        show: true,
        reason: `User: ${(userDistance * 1000).toFixed(0)}m`,
        className: 'bg-warning'
      };
    }
  }
  
  // Both available and lower of two is > 200m
  if ((imageDistance !== null && imageDistance !== undefined) &&
      (userDistance !== null && userDistance !== undefined)) {
    const minDistance = Math.min(imageDistance, userDistance);
    if (minDistance > THRESHOLD_KM) {
      return {
        show: true,
        reason: `Min: ${(minDistance * 1000).toFixed(0)}m`,
        className: 'bg-danger'
      };
    }
  }
  
  return { show: false };
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
              <th>Distance Info</th>
              <th>Time</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {allItems.map(item => {
              const warning = item.type === 'visit' ? getDistanceWarning(item) : null;
              const imageDistance = item.type === 'visit' ? item.image_distance_km : null;
              const userDistance = item.type === 'visit' ? item.user_distance_km : null;
              
              return (
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
                  <td>
                    {item.type === 'visit' ? (
                      <div style={{ fontSize: '0.85em' }}>
                        {imageDistance !== null && imageDistance !== undefined ? (
                          <div>📷 {(imageDistance * 1000).toFixed(0)}m</div>
                        ) : (
                          <div className="text-muted">📷 —</div>
                        )}
                        {userDistance !== null && userDistance !== undefined ? (
                          <div>👤 {(userDistance * 1000).toFixed(0)}m</div>
                        ) : (
                          <div className="text-muted">👤 —</div>
                        )}
                        {warning && warning.show && (
                          <div style={{ marginTop: '4px' }}>
                            <span className={`badge ${warning.className}`} title={warning.reason}>
                              ⚠️ {warning.reason}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      '—'
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
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}