import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { adminApi } from '../../services/adminApi';
import { logger } from '../../utils/logger';
import { assessVisitPosition } from '../../utils/visitPosition';

const apiUrl = import.meta.env.VITE_API_URL || '';

const formatMeters = (km) => (km === null || km === undefined ? '—' : `${(km * 1000).toFixed(0)} m`);

const WARNING_STYLES = {
  missing: { backgroundColor: '#fff3cd', color: '#856404' },
  far: { backgroundColor: '#f8d7da', color: '#721c24' },
};

function formatDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

export default function VisitsList({ teamId, raceId, onDataChanged }) {
  const { t } = useTranslation();
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
        setError(t('admin.visits.errorLoad'));
      } finally {
        setLoading(false);
      }
    };

    if (teamId && raceId) fetchData();
  }, [teamId, raceId, t]);

  const handleDeleteVisit = async (visitId) => {
    if (window.confirm(t('admin.visits.confirmDeleteVisit'))) {
      try {
        const visit = visits.find(item => item.id === visitId);
        if (!visit) {
          throw new Error('Visit not found in local state');
        }
        await adminApi.deleteVisit(raceId, {
          checkpoint_id: visit.checkpoint_id,
          team_id: visit.team_id,
        });
        setVisits(visits.filter(visit => visit.id !== visitId));
        onDataChanged?.();
      } catch (err) {
        logger.error('ADMIN', 'Failed to delete visit', err);
        setError(t('admin.visits.errorDeleteVisit'));
      }
    }
  };

  const handleDeleteTaskCompletion = async (taskLogId) => {
    if (window.confirm(t('admin.visits.confirmDeleteTaskCompletion'))) {
      try {
        const completion = taskCompletions.find(item => item.id === taskLogId);
        if (!completion) {
          throw new Error('Task completion not found in local state');
        }
        await adminApi.deleteTaskCompletion(raceId, {
          task_id: completion.task_id,
          team_id: completion.team_id,
        });
        setTaskCompletions(taskCompletions.filter(task => task.id !== taskLogId));
        onDataChanged?.();
      } catch (err) {
        logger.error('ADMIN', 'Failed to delete task completion', err);
        setError(t('admin.visits.errorDeleteTaskCompletion'));
      }
    }
  };

  if (loading) return <div>{t('admin.visits.loading')}</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  const getPositionWarning = (assessment) => {
    if (assessment.status === 'missing') return t('admin.visits.noPositionData');
    if (assessment.status === 'far') {
      return t(assessment.source === 'image' ? 'admin.visits.farPhoto' : 'admin.visits.farDevice', {
        meters: (assessment.distanceKm * 1000).toFixed(0),
      });
    }
    return null;
  };

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
              alt={t('admin.visits.imageAltCheckpointVisit')}
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
        <div className="text-muted">{t('admin.visits.noItems')}</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '16px' }}>
          {allItems.map(item => {
            const assessment = item.type === 'visit' ? assessVisitPosition(item) : null;
            const warning = assessment ? getPositionWarning(assessment) : null;
            const imageUrl = item.image_filename
              ? `${apiUrl}/static/images/${item.image_filename}`
              : null;
            const hasImage = Boolean(imageUrl);

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
                      url: imageUrl,
                      checkpoint: item.type === 'visit'
                        ? item.checkpoint
                        : (item.task || item.task_title || t('admin.visits.unknownTask'))
                    })}
                  >
                    <img
                      src={imageUrl}
                      alt={t('admin.visits.imageAltCheckpointVisit')}
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
                      {t('admin.visits.clickToView')}
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
                    {t('admin.visits.noImage')}
                  </div>
                )}

                {/* Card Content */}
                <div style={{ padding: '16px', flex: '1', display: 'flex', flexDirection: 'column' }}>
                  {/* Header */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span className={`badge ${item.type === 'visit' ? 'bg-primary' : 'bg-success'}`}>
                        {item.type === 'visit' ? t('admin.visits.badgeCheckpoint') : t('admin.visits.badgeTask')}
                      </span>
                      {Number.isFinite(item.num_of_points) && (
                        <span className="badge bg-secondary">
                          {t('tasks.points', { count: item.num_of_points })}
                        </span>
                      )}
                    </div>
                    <h6 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>
                      {item.type === 'visit' ? (item.checkpoint || `#${item.checkpoint_id}`) : (item.task || item.task_title || t('admin.visits.unknownTask'))}
                    </h6>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      {formatDate(item.created_at)}
                    </div>
                  </div>

                  {/* Distance Info for Checkpoints */}
                  {assessment && (
                    <div style={{
                      marginBottom: '12px',
                      padding: '10px',
                      backgroundColor: warning ? WARNING_STYLES[assessment.status].backgroundColor : '#f8f9fa',
                      borderRadius: '4px',
                      fontSize: '13px'
                    }}>
                      {[
                        { source: 'image', label: t('admin.visits.distancePhoto'), km: item.image_distance_km },
                        { source: 'user', label: t('admin.visits.distanceDevice'), km: item.user_distance_km },
                      ].map(row => {
                        const used = assessment.source === row.source;
                        return (
                          <div
                            key={row.source}
                            style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: used ? undefined : '#6c757d' }}
                          >
                            <span>
                              {row.label}
                              {used && <span className="badge bg-dark ms-2">{t('admin.visits.usedForCheck')}</span>}
                            </span>
                            <span style={{ fontWeight: used ? '600' : '400' }}>{formatMeters(row.km)}</span>
                          </div>
                        );
                      })}
                      {warning && (
                        <div
                          role="alert"
                          style={{
                            marginTop: '8px',
                            padding: '6px 8px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: '600',
                            ...WARNING_STYLES[assessment.status],
                          }}
                        >
                          ⚠️ {warning}
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
                      {t('admin.visits.delete')}
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