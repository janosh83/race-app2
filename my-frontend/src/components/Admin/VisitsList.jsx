import React, { useEffect, useState } from 'react';
import { adminApi } from '../../services/adminApi';
import { logger } from '../../utils/logger';

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
  const [selectedImage, setSelectedImage] = useState(null); // For image modal
  const [imageZoom, setImageZoom] = useState(1); // For pinch zoom on mobile

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
        logger.error('ADMIN', 'Failed to load visits or tasks', err);
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
        logger.error('ADMIN', 'Failed to delete visit', err);
      }
    }
  };

  const handleDeleteTaskCompletion = async (taskLogId) => {
    if (window.confirm('Are you sure you want to delete this task completion?')) {
      try {
        await adminApi.deleteTaskCompletion(taskLogId);
        setTaskCompletions(taskCompletions.filter(task => task.id !== taskLogId));
      } catch (err) {
        logger.error('ADMIN', 'Failed to delete task completion', err);
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
      {/* Image Viewer Modal */}
      {selectedImage && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.95)',
            zIndex: 1050,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '10px',
            cursor: 'zoom-in'
          }}
          onClick={() => {
            setSelectedImage(null);
            setImageZoom(1);
          }}
        >
          <div style={{ maxWidth: '100%', maxHeight: '100%', position: 'relative' }}>
            <img 
              src={selectedImage.url}
              alt="Checkpoint visit"
              style={{
                maxWidth: '100%',
                maxHeight: '90vh',
                objectFit: 'contain',
                transform: `scale(${imageZoom})`
              }}
              onClick={(e) => e.stopPropagation()}
            />
            {/* Close button */}
            <button
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                background: 'rgba(255,255,255,0.9)',
                border: 'none',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                fontSize: '24px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onClick={() => {
                setSelectedImage(null);
                setImageZoom(1);
              }}
            >
              ✕
            </button>
            {/* Image info */}
            {selectedImage.checkpoint && (
              <div style={{
                position: 'absolute',
                bottom: '10px',
                left: '10px',
                background: 'rgba(0,0,0,0.7)',
                color: 'white',
                padding: '8px 12px',
                borderRadius: '4px',
                fontSize: '12px'
              }}>
                {selectedImage.checkpoint}
              </div>
            )}
          </div>
        </div>
      )}

      {allItems.length === 0 ? (
        <div className="text-muted">No visits or task completions</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '16px' }}>
          {allItems.map(item => {
            const warning = item.type === 'visit' ? getDistanceWarning(item) : null;
            const imageDistance = item.type === 'visit' ? item.image_distance_km : null;
            const userDistance = item.type === 'visit' ? item.user_distance_km : null;
            const hasImage = item.type === 'visit' && item.image_url;
            
            return (
              <div
                key={`${item.type}-${item.id}`}
                style={{
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  backgroundColor: '#fff',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                {/* Image Section */}
                {hasImage ? (
                  <div
                    style={{
                      position: 'relative',
                      backgroundColor: '#f0f0f0',
                      minHeight: '200px',
                      cursor: 'pointer',
                      overflow: 'hidden'
                    }}
                    onClick={() => setSelectedImage({ 
                      url: item.image_url, 
                      checkpoint: item.checkpoint 
                    })}
                  >
                    <img
                      src={item.image_url}
                      alt={`${item.checkpoint} visit`}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                    />
                    {/* Tap to view indicator on mobile */}
                    <div
                      style={{
                        position: 'absolute',
                        inset: '0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(0,0,0,0)',
                        opacity: '0',
                        transition: 'opacity 0.2s',
                        fontSize: '14px',
                        color: 'white',
                        fontWeight: 'bold'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = '0'}
                      className="hover-indicator"
                    >
                      Click to view
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      backgroundColor: '#f9f9f9',
                      padding: '40px 16px',
                      textAlign: 'center',
                      color: '#999'
                    }}
                  >
                    📷 No image
                  </div>
                )}

                {/* Card Content */}
                <div style={{ padding: '16px', flex: '1', display: 'flex', flexDirection: 'column' }}>
                  {/* Header */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span className={`badge ${item.type === 'visit' ? 'bg-primary' : 'bg-success'}`}>
                        {item.type === 'visit' ? '🚩 Checkpoint' : '✓ Task'}
                      </span>
                    </div>
                    <h6 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>
                      {item.type === 'visit' ? (item.checkpoint || `#${item.checkpoint_id}`) : (item.task || item.task_title || 'Task')}
                    </h6>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      {formatDate(item.created_at)}
                    </div>
                  </div>

                  {/* Distance Info for Checkpoints */}
                  {item.type === 'visit' && (
                    <div style={{ 
                      marginBottom: '12px', 
                      padding: '10px',
                      backgroundColor: warning?.show ? '#fff3cd' : '#f8f9fa',
                      borderRadius: '4px',
                      fontSize: '13px'
                    }}>
                      <div style={{ marginBottom: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span>📷 Checkpoint:</span>
                          <span style={{ fontWeight: '600' }}>
                            {imageDistance !== null && imageDistance !== undefined 
                              ? `${(imageDistance * 1000).toFixed(0)}m` 
                              : '—'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>👤 User:</span>
                          <span style={{ fontWeight: '600' }}>
                            {userDistance !== null && userDistance !== undefined 
                              ? `${(userDistance * 1000).toFixed(0)}m` 
                              : '—'}
                          </span>
                        </div>
                      </div>
                      {warning && warning.show && (
                        <div style={{
                          marginTop: '8px',
                          padding: '6px 8px',
                          backgroundColor: warning.className.includes('danger') ? '#f8d7da' : 
                                          warning.className.includes('warning') ? '#fff3cd' : '#e2e3e5',
                          borderRadius: '4px',
                          color: warning.className.includes('danger') ? '#721c24' : 
                                warning.className.includes('warning') ? '#856404' : '#383d41',
                          fontSize: '11px',
                          fontWeight: '500'
                        }}>
                          ⚠️ {warning.reason}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ marginTop: 'auto' }}>
                    <button 
                      className="btn btn-sm btn-danger w-100"
                      onClick={() => item.type === 'visit' ? handleDeleteVisit(item.id) : handleDeleteTaskCompletion(item.id)}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}