import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { adminApi } from '../../services/adminApi';
import { logger } from '../../utils/logger';
import { assessVisitPosition } from '../../utils/visitPosition';

import InlineConfirm from './InlineConfirm';
import './VisitsList.css';

const apiUrl = import.meta.env.VITE_API_URL || '';

const formatMeters = (km) => (km === null || km === undefined ? '—' : `${(km * 1000).toFixed(0)} m`);

// Day, month and time without seconds, in the browser locale like the other
// admin dates.
function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// The visits and task completions of one team, newest first, for review:
// photo, where it was taken compared with the checkpoint, and a way to delete
// a visit that does not count.
export default function VisitsList({ teamId, raceId, onDataChanged }) {
  const { t } = useTranslation();
  const [visits, setVisits] = useState([]);
  const [taskCompletions, setTaskCompletions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [confirmKey, setConfirmKey] = useState(null); // card asking to confirm a delete
  const [deletingKey, setDeletingKey] = useState(null);
  const [viewerKey, setViewerKey] = useState(null); // key of the item shown in the photo viewer
  const swipeStartX = useRef(null);

  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      setViewerKey(null);
      try {
        const [visitsData, tasksData] = await Promise.all([
          adminApi.getVisitsByTeamAndRace(teamId, raceId),
          adminApi.getTaskCompletionsByTeamAndRace(teamId, raceId)
        ]);
        if (!mounted) return;
        setVisits(Array.isArray(visitsData) ? visitsData : (visitsData?.data || []));
        setTaskCompletions(Array.isArray(tasksData) ? tasksData : (tasksData?.data || []));
      } catch (err) {
        logger.error('ADMIN', 'Failed to load visits or tasks', err);
        if (mounted) setError(t('admin.visits.errorLoad'));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    if (teamId && raceId) fetchData();
    return () => { mounted = false; };
  }, [teamId, raceId, t]);

  // Deletes run after the admin confirmed in the card; a failure shows above
  // the cards and keeps the list.
  const handleDeleteVisit = async (visitId) => {
    setDeletingKey(`visit-${visitId}`);
    setActionError(null);
    try {
      const visit = visits.find(item => item.id === visitId);
      if (!visit) {
        throw new Error('Visit not found in local state');
      }
      await adminApi.deleteVisit(raceId, {
        checkpoint_id: visit.checkpoint_id,
        team_id: visit.team_id,
      });
      setVisits(prev => prev.filter(item => item.id !== visitId));
      onDataChanged?.();
    } catch (err) {
      logger.error('ADMIN', 'Failed to delete visit', err);
      setActionError(t('admin.visits.errorDeleteVisit'));
    } finally {
      setDeletingKey(null);
      setConfirmKey(null);
    }
  };

  const handleDeleteTaskCompletion = async (taskLogId) => {
    setDeletingKey(`task-${taskLogId}`);
    setActionError(null);
    try {
      const completion = taskCompletions.find(item => item.id === taskLogId);
      if (!completion) {
        throw new Error('Task completion not found in local state');
      }
      await adminApi.deleteTaskCompletion(raceId, {
        task_id: completion.task_id,
        team_id: completion.team_id,
      });
      setTaskCompletions(prev => prev.filter(task => task.id !== taskLogId));
      onDataChanged?.();
    } catch (err) {
      logger.error('ADMIN', 'Failed to delete task completion', err);
      setActionError(t('admin.visits.errorDeleteTaskCompletion'));
    } finally {
      setDeletingKey(null);
      setConfirmKey(null);
    }
  };

  const getPositionWarning = (assessment) => {
    if (assessment.status === 'missing') return t('admin.visits.noPositionData');
    if (assessment.status === 'far') {
      return t(assessment.source === 'image' ? 'admin.visits.farPhoto' : 'admin.visits.farDevice', {
        meters: (assessment.distanceKm * 1000).toFixed(0),
      });
    }
    return null;
  };

  const items = [
    ...visits.map(v => ({ ...v, type: 'visit' })),
    ...taskCompletions.map(tc => ({ ...tc, type: 'task' }))
  ]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(item => {
      const assessment = item.type === 'visit' ? assessVisitPosition(item) : null;
      return {
        ...item,
        key: `${item.type}-${item.id}`,
        title: item.type === 'visit'
          ? (item.checkpoint || `#${item.checkpoint_id}`)
          : (item.task || item.task_title || t('admin.visits.unknownTask')),
        imageUrl: item.image_filename ? `${apiUrl}/static/images/${item.image_filename}` : null,
        assessment,
        warning: assessment ? getPositionWarning(assessment) : null,
      };
    });

  const withPhotos = items.filter(item => item.imageUrl);
  const viewerIndex = withPhotos.findIndex(item => item.key === viewerKey);
  const viewerItem = viewerIndex >= 0 ? withPhotos[viewerIndex] : null;

  const showPhoto = useCallback((offset) => {
    if (viewerIndex < 0 || withPhotos.length === 0) return;
    const next = (viewerIndex + offset + withPhotos.length) % withPhotos.length;
    setViewerKey(withPhotos[next].key);
  }, [viewerIndex, withPhotos]);

  // Photo viewer keys: arrows go through the team's photos, Escape closes.
  useEffect(() => {
    if (!viewerItem) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setViewerKey(null);
      else if (event.key === 'ArrowRight') showPhoto(1);
      else if (event.key === 'ArrowLeft') showPhoto(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewerItem, showPhoto]);

  if (loading) return <div>{t('admin.visits.loading')}</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  if (items.length === 0) {
    return <div className="text-muted">{t('admin.visits.noItems')}</div>;
  }

  const toCheck = items.filter(item => item.warning).length;

  return (
    <div>
      <p className="admin-visits-summary">
        <span>{t('admin.visits.summaryCheckpoints', { count: visits.length })}</span>
        <span>{t('admin.visits.summaryTasks', { count: taskCompletions.length })}</span>
        {toCheck > 0 && (
          <span className="admin-visits-summary-warning">⚠️ {t('admin.visits.summaryToCheck', { count: toCheck })}</span>
        )}
      </p>

      {actionError && (
        <div className="alert alert-danger alert-dismissible py-2" role="alert">
          {actionError}
          <button type="button" className="btn-close py-2" aria-label={t('admin.close')} onClick={() => setActionError(null)} />
        </div>
      )}

      <div className="admin-visits-grid">
        {items.map(item => {
          const { assessment, warning } = item;
          return (
            <article key={item.key} className={`admin-visit-card${warning ? ` admin-visit-card-${assessment.status}` : ''}`}>
              {item.imageUrl ? (
                <button
                  type="button"
                  className="admin-visit-photo"
                  onClick={() => setViewerKey(item.key)}
                  aria-label={t('admin.visits.openPhoto', { name: item.title })}
                >
                  <img src={item.imageUrl} alt="" loading="lazy" />
                </button>
              ) : (
                <div className="admin-visit-no-photo">{t('admin.visits.noImage')}</div>
              )}

              <div className="admin-visit-body">
                <div className="admin-visit-header">
                  <div className="admin-visit-badges">
                    <span className={`badge ${item.type === 'visit' ? 'bg-primary' : 'bg-success'}`}>
                      {item.type === 'visit' ? t('admin.visits.badgeCheckpoint') : t('admin.visits.badgeTask')}
                    </span>
                    {Number.isFinite(item.num_of_points) && (
                      <span className="badge bg-secondary">
                        {t('tasks.points', { count: item.num_of_points })}
                      </span>
                    )}
                    <span className="admin-visit-time">{formatDate(item.created_at)}</span>
                  </div>
                  <h4 className="admin-visit-title">{item.title}</h4>
                </div>

                {assessment && (
                  <div className={`admin-visit-position${warning ? ` admin-visit-position-${assessment.status}` : ''}`}>
                    {[
                      { source: 'image', label: t('admin.visits.distancePhoto'), km: item.image_distance_km },
                      { source: 'user', label: t('admin.visits.distanceDevice'), km: item.user_distance_km },
                    ].map(row => {
                      const used = assessment.source === row.source;
                      return (
                        <div key={row.source} className={`admin-visit-position-row${used ? ' is-used' : ''}`}>
                          <span>
                            {row.label}
                            {used && <span className="badge bg-dark ms-2">{t('admin.visits.usedForCheck')}</span>}
                          </span>
                          <span className="admin-visit-distance">{formatMeters(row.km)}</span>
                        </div>
                      );
                    })}
                    {warning && (
                      <div role="alert" className="admin-visit-warning">⚠️ {warning}</div>
                    )}
                  </div>
                )}

                <div className="admin-visit-actions">
                  {confirmKey === item.key ? (
                    <InlineConfirm
                      className="w-100"
                      text={item.type === 'visit' ? t('admin.visits.confirmDeleteVisit') : t('admin.visits.confirmDeleteTaskCompletion')}
                      cancelLabel={t('admin.teams.keep')}
                      confirmLabel={t('admin.teams.deleteYes')}
                      busy={deletingKey === item.key}
                      onCancel={() => setConfirmKey(null)}
                      onConfirm={() => (item.type === 'visit' ? handleDeleteVisit(item.id) : handleDeleteTaskCompletion(item.id))}
                    />
                  ) : (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => setConfirmKey(item.key)}
                    >
                      {t('admin.visits.delete')}
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {viewerItem && (
        <div
          className="admin-photo-viewer"
          role="dialog"
          aria-modal="true"
          aria-label={viewerItem.title}
          onClick={() => setViewerKey(null)}
          // Swipe sideways on a phone to go through the photos.
          onTouchStart={(e) => { swipeStartX.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            if (swipeStartX.current === null) return;
            const dx = e.changedTouches[0].clientX - swipeStartX.current;
            swipeStartX.current = null;
            if (Math.abs(dx) > 50) showPhoto(dx < 0 ? 1 : -1);
          }}
        >
          <img src={viewerItem.imageUrl} alt={viewerItem.title} onClick={(e) => e.stopPropagation()} />
          <button
            type="button"
            className="admin-photo-viewer-close"
            aria-label={t('admin.dashboard.close')}
            onClick={() => setViewerKey(null)}
          >
            ✕
          </button>
          {withPhotos.length > 1 && (
            <>
              <button
                type="button"
                className="admin-photo-viewer-nav is-prev"
                aria-label={t('admin.visits.previousPhoto')}
                onClick={(e) => { e.stopPropagation(); showPhoto(-1); }}
              >
                ‹
              </button>
              <button
                type="button"
                className="admin-photo-viewer-nav is-next"
                aria-label={t('admin.visits.nextPhoto')}
                onClick={(e) => { e.stopPropagation(); showPhoto(1); }}
              >
                ›
              </button>
            </>
          )}
          <div className="admin-photo-viewer-caption" onClick={(e) => e.stopPropagation()}>
            <strong>{viewerItem.title}</strong>
            <span>{formatDate(viewerItem.created_at)}</span>
            {viewerItem.assessment?.distanceKm !== null && viewerItem.assessment?.distanceKm !== undefined && (
              <span>{formatMeters(viewerItem.assessment.distanceKm)}</span>
            )}
            {viewerItem.warning && <span className="admin-photo-viewer-warning">⚠️ {viewerItem.warning}</span>}
            {withPhotos.length > 1 && <span>{viewerIndex + 1} / {withPhotos.length}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
