import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { adminApi } from '../../services/adminApi';
import { logger } from '../../utils/logger';

import StatTile from './StatTile';

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
  favourites_count: 0,
  teams_with_favourites_count: 0,
  top_favourite_checkpoints: [],
};

// A ranked list of items with a count badge each, or "No data yet".
function RankedList({ title, items, idKey, countKey, badgeClass = 'bg-secondary', badgePrefix = '' }) {
  const { t } = useTranslation();
  return (
    <div className="mb-3">
      <h4 className="h6">{title}</h4>
      {items.length === 0 ? (
        <div className="small text-muted">{t('admin.statistics.noTopData')}</div>
      ) : (
        <ol className="mb-0 ps-3">
          {items.map((item) => (
            <li key={item[idKey]} className="mb-1">
              <div className="d-flex justify-content-between gap-2">
                <span>{item.title}</span>
                <span className={`badge ${badgeClass}`}>{badgePrefix}{item[countKey]}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
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
          favourites_count: Number(payload?.favourites_count || 0),
          teams_with_favourites_count: Number(payload?.teams_with_favourites_count || 0),
          top_favourite_checkpoints: Array.isArray(payload?.top_favourite_checkpoints) ? payload.top_favourite_checkpoints : [],
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
    <div className="mt-3 mb-3">
      <h2 className="h4 mb-3">{t('admin.statistics.title')}</h2>

      <div className="row row-cols-2 row-cols-lg-4 g-2 mb-4">
        <StatTile label={t('admin.statistics.registeredTeams')}>
          <div className="fs-4 fw-semibold">{stats.registered_teams_count}</div>
        </StatTile>
        <StatTile
          label={t('admin.statistics.visits')}
          detail={t('admin.statistics.visitsDetail', { visited: stats.checkpoints_with_visits_count, total: stats.checkpoints_count })}
        >
          <div className="fs-4 fw-semibold">{stats.visits_count}</div>
        </StatTile>
        <StatTile
          label={t('admin.statistics.taskCompletions')}
          detail={t('admin.statistics.completionsDetail', { completed: stats.tasks_with_completions_count, total: stats.tasks_count })}
        >
          <div className="fs-4 fw-semibold">{stats.task_completions_count}</div>
        </StatTile>
        <StatTile
          label={t('admin.statistics.favouritesCount')}
          detail={t('admin.statistics.favouritesDetail', { count: stats.teams_with_favourites_count })}
        >
          <div className="fs-4 fw-semibold">{stats.favourites_count}</div>
        </StatTile>
      </div>

      <div className="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-3">
        <div className="col">
          <section className="card h-100">
            <div className="card-body">
              <h3 className="h5 mb-3">{t('admin.statistics.checkpoints')}</h3>
              <RankedList
                title={t('admin.statistics.topVisitedCheckpoints')}
                items={stats.top_visited_checkpoints}
                idKey="checkpoint_id"
                countKey="visits_count"
              />
              <RankedList
                title={t('admin.statistics.leastVisitedCheckpoints')}
                items={stats.least_visited_checkpoints}
                idKey="checkpoint_id"
                countKey="visits_count"
              />
            </div>
          </section>
        </div>
        <div className="col">
          <section className="card h-100">
            <div className="card-body">
              <h3 className="h5 mb-3">{t('admin.statistics.tasks')}</h3>
              <RankedList
                title={t('admin.statistics.topCompletedTasks')}
                items={stats.top_completed_tasks}
                idKey="task_id"
                countKey="completions_count"
              />
              <RankedList
                title={t('admin.statistics.leastCompletedTasks')}
                items={stats.least_completed_tasks}
                idKey="task_id"
                countKey="completions_count"
              />
            </div>
          </section>
        </div>
        <div className="col">
          <section className="card h-100">
            <div className="card-body">
              <h3 className="h5 mb-3">{t('admin.statistics.favourites')}</h3>
              <RankedList
                title={t('admin.statistics.topFavouriteCheckpoints')}
                items={stats.top_favourite_checkpoints}
                idKey="checkpoint_id"
                countKey="favourites_count"
                badgeClass="bg-warning text-dark"
                badgePrefix="★ "
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
