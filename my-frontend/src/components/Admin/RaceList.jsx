import React from 'react';
import { useTranslation } from 'react-i18next';

import { formatDate, timeStateForRace } from '../../contexts/TimeContext';
import { getPhasePresentation } from '../../utils/racePhase';

// All races with their current phase and time windows; a row opens the race.
export default function RaceList({ races, onSelect, onNew }) {
  const { t } = useTranslation();
  const now = Date.now();

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="h4 mb-0">{t('admin.raceList.title')}</h2>
        {onNew && (
          <button className="btn btn-success" onClick={onNew}>{t('admin.dashboard.newRace')}</button>
        )}
      </div>
      <div className="list-group">
        {races.map((r) => {
          const phase = getPhasePresentation(t, timeStateForRace(now, r).state);
          return (
            <button
              type="button"
              key={r.id}
              className="list-group-item list-group-item-action admin-race-row"
              onClick={() => onSelect(r)}
            >
              <div className="d-flex justify-content-between align-items-start gap-2">
                <span className="fw-semibold">{r.name}</span>
                <span className={`badge rounded-pill ${phase.toneClass}`}>{phase.value}</span>
              </div>
              <div className="small text-muted mt-1 d-flex flex-wrap column-gap-3">
                <span>
                  {t('activeRace.showingWindowLabel')}: {formatDate(r.start_showing_checkpoints_at ?? r.start_showing_checkpoints)} – {formatDate(r.end_showing_checkpoints_at ?? r.end_showing_checkpoints)}
                </span>
                <span>
                  {t('activeRace.loggingWindowLabel')}: {formatDate(r.start_logging_at ?? r.start_logging)} – {formatDate(r.end_logging_at ?? r.end_logging)}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
