import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { adminApi } from '../../services/adminApi';
import { logger } from '../../utils/logger';

const EMPTY_STATS = {
  registered_teams_count: 0,
  checkpoints_count: 0,
  tasks_count: 0,
  visits_count: 0,
  task_completions_count: 0,
  checkpoints_with_visits_count: 0,
  tasks_with_completions_count: 0,
  top_visited_checkpoints: [],
  top_completed_tasks: [],
  least_visited_checkpoints: [],
  least_completed_tasks: [],
};

function StatCard({ label, value, colClass = 'col-12 col-md-4' }) {
  return (
    <div className={colClass}>
      <div className="card h-100">
        <div className="card-body">
          <div className="text-muted small mb-2">{label}</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.1 }}>{value}</div>
        </div>
      </div>
    </div>
  );
}

export default function RaceStatistics({ raceId }) {
  const { t } = useTranslation();
  const [stats, setStats] = useState(EMPTY_STATS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!raceId) {
        setStats(EMPTY_STATS);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const payload = await adminApi.getRaceStatistics(raceId);
        if (!mounted) return;
        setStats({
          registered_teams_count: Number(payload?.registered_teams_count || 0),
          checkpoints_count: Number(payload?.checkpoints_count || 0),
          tasks_count: Number(payload?.tasks_count || 0),
          visits_count: Number(payload?.visits_count || 0),
          task_completions_count: Number(payload?.task_completions_count || 0),
          checkpoints_with_visits_count: Number(payload?.checkpoints_with_visits_count || 0),
          tasks_with_completions_count: Number(payload?.tasks_with_completions_count || 0),
          top_visited_checkpoints: Array.isArray(payload?.top_visited_checkpoints) ? payload.top_visited_checkpoints : [],
          top_completed_tasks: Array.isArray(payload?.top_completed_tasks) ? payload.top_completed_tasks : [],
          least_visited_checkpoints: Array.isArray(payload?.least_visited_checkpoints) ? payload.least_visited_checkpoints : [],
          least_completed_tasks: Array.isArray(payload?.least_completed_tasks) ? payload.least_completed_tasks : [],
        });
      } catch (err) {
        logger.error('ADMIN', 'Failed to load race statistics', err);
        if (!mounted) return;
        setError(err?.message || t('admin.statistics.errorLoad'));
        setStats(EMPTY_STATS);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [raceId, t]);

  if (loading) return <div>{t('admin.statistics.loading')}</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <div className="card mb-3">
      <div className="card-body">
        <h5 className="card-title mb-3">{t('admin.statistics.title')}</h5>
        <div className="row g-3">
          <StatCard
            label={t('admin.statistics.registeredTeams')}
            value={stats.registered_teams_count}
            colClass="col-12 col-md-6 col-lg-4"
          />
        </div>

        <div className="row g-3 mt-2">
          <div className="col-12 col-lg-6">
            <div className="card h-100">
              <div className="card-body">
                <h6 className="card-title mb-3">{t('admin.statistics.checkpoints')}</h6>
                <div className="d-flex justify-content-between py-2 border-bottom">
                  <span className="text-muted">{t('admin.statistics.checkpoints')}</span>
                  <strong>{stats.checkpoints_count}</strong>
                </div>
                <div className="d-flex justify-content-between py-2 border-bottom">
                  <span className="text-muted">{t('admin.statistics.visits')}</span>
                  <strong>{stats.visits_count}</strong>
                </div>
                <div className="d-flex justify-content-between py-2 border-bottom mb-3">
                  <span className="text-muted">{t('admin.statistics.checkpointsWithVisits')}</span>
                  <strong>{stats.checkpoints_with_visits_count}</strong>
                </div>

                <h6 className="card-title mb-3">{t('admin.statistics.topVisitedCheckpoints')}</h6>
                {stats.top_visited_checkpoints.length === 0 ? (
                  <div className="text-muted">{t('admin.statistics.noTopData')}</div>
                ) : (
                  <ol className="mb-0 ps-3">
                    {stats.top_visited_checkpoints.map((item) => (
                      <li key={item.checkpoint_id} className="mb-2">
                        <div className="d-flex justify-content-between gap-2">
                          <span>{item.title}</span>
                          <span className="badge bg-secondary">{item.visits_count}</span>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}

                <h6 className="card-title mt-4 mb-3">{t('admin.statistics.leastVisitedCheckpoints')}</h6>
                {stats.least_visited_checkpoints.length === 0 ? (
                  <div className="text-muted">{t('admin.statistics.noTopData')}</div>
                ) : (
                  <ol className="mb-0 ps-3">
                    {stats.least_visited_checkpoints.map((item) => (
                      <li key={`least-cp-${item.checkpoint_id}`} className="mb-2">
                        <div className="d-flex justify-content-between gap-2">
                          <span>{item.title}</span>
                          <span className="badge bg-secondary">{item.visits_count}</span>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-6">
            <div className="card h-100">
              <div className="card-body">
                <h6 className="card-title mb-3">{t('admin.statistics.tasks')}</h6>
                <div className="d-flex justify-content-between py-2 border-bottom">
                  <span className="text-muted">{t('admin.statistics.tasks')}</span>
                  <strong>{stats.tasks_count}</strong>
                </div>
                <div className="d-flex justify-content-between py-2 border-bottom">
                  <span className="text-muted">{t('admin.statistics.taskCompletions')}</span>
                  <strong>{stats.task_completions_count}</strong>
                </div>
                <div className="d-flex justify-content-between py-2 border-bottom mb-3">
                  <span className="text-muted">{t('admin.statistics.tasksWithCompletions')}</span>
                  <strong>{stats.tasks_with_completions_count}</strong>
                </div>

                <h6 className="card-title mb-3">{t('admin.statistics.topCompletedTasks')}</h6>
                {stats.top_completed_tasks.length === 0 ? (
                  <div className="text-muted">{t('admin.statistics.noTopData')}</div>
                ) : (
                  <ol className="mb-0 ps-3">
                    {stats.top_completed_tasks.map((item) => (
                      <li key={item.task_id} className="mb-2">
                        <div className="d-flex justify-content-between gap-2">
                          <span>{item.title}</span>
                          <span className="badge bg-secondary">{item.completions_count}</span>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}

                <h6 className="card-title mt-4 mb-3">{t('admin.statistics.leastCompletedTasks')}</h6>
                {stats.least_completed_tasks.length === 0 ? (
                  <div className="text-muted">{t('admin.statistics.noTopData')}</div>
                ) : (
                  <ol className="mb-0 ps-3">
                    {stats.least_completed_tasks.map((item) => (
                      <li key={`least-task-${item.task_id}`} className="mb-2">
                        <div className="d-flex justify-content-between gap-2">
                          <span>{item.title}</span>
                          <span className="badge bg-secondary">{item.completions_count}</span>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
