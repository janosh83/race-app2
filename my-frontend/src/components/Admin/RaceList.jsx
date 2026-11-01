import React from 'react';
import { useTranslation } from 'react-i18next';

import { timeStateForRace } from '../../contexts/TimeContext';
import { formatDateRange } from '../../utils/dateRange';
import { getPhasePresentation } from '../../utils/racePhase';

const endOfLogging = (race) => {
  const value = race.end_logging_at ?? race.end_logging;
  const ms = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(ms) ? ms : null;
};

// Races by the end of logging, latest first; races without it go last.
export function sortRacesForAdmin(races, now = Date.now()) {
  return races
    .map(race => ({ race, state: timeStateForRace(now, race).state, end: endOfLogging(race) }))
    .sort((a, b) => {
      if (a.end === null || b.end === null) return (a.end === null) - (b.end === null);
      return b.end - a.end || a.race.id - b.race.id;
    });
}

// All races in a table with their phase, time windows and registration; a
// row opens the race. Narrower screens drop columns: on phones the status
// and logging window fold under the name.
export default function RaceList({ races, onSelect, onNew }) {
  const { t } = useTranslation();
  const now = Date.now();
  const rows = sortRacesForAdmin(races, now);

  const showingRange = (r) => formatDateRange(
    r.start_showing_checkpoints_at ?? r.start_showing_checkpoints,
    r.end_showing_checkpoints_at ?? r.end_showing_checkpoints,
  );
  const loggingRange = (r) => formatDateRange(r.start_logging_at ?? r.start_logging, r.end_logging_at ?? r.end_logging);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="h4 mb-0">
          {t('admin.raceList.title')} <span className="text-muted fw-normal">({races.length})</span>
        </h2>
        {onNew && (
          <button className="btn btn-primary" onClick={onNew}>{t('admin.dashboard.newRace')}</button>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="text-muted">{t('admin.raceList.empty')}</p>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover align-middle admin-race-table">
            <thead>
              <tr>
                <th className="admin-race-col-name">{t('admin.raceList.colRace')}</th>
                <th className="d-none d-sm-table-cell">{t('admin.raceList.colStatus')}</th>
                <th className="d-none d-lg-table-cell">{t('activeRace.showingWindowLabel')}</th>
                <th className="d-none d-md-table-cell">{t('activeRace.loggingWindowLabel')}</th>
                <th className="d-none d-lg-table-cell">{t('admin.raceList.colRegistration')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ race: r, state }) => {
                const phase = getPhasePresentation(t, state);
                return (
                  // The whole row opens the race; the name is the keyboard control.
                  <tr key={r.id} className="admin-race-row" onClick={() => onSelect(r)}>
                    <td>
                      <button
                        type="button"
                        className="btn btn-link p-0 fw-semibold text-start text-decoration-none admin-race-name"
                        onClick={(e) => { e.stopPropagation(); onSelect(r); }}
                      >
                        {r.name}
                      </button>
                      <div className="d-sm-none mt-1">
                        <span className={`badge rounded-pill ${phase.toneClass}`}>{phase.value}</span>
                      </div>
                      <div className="small text-muted d-md-none mt-1">
                        {t('activeRace.loggingWindowLabel')}: <span className="text-nowrap">{loggingRange(r)}</span>
                      </div>
                    </td>
                    <td className="d-none d-sm-table-cell">
                      <span className={`badge rounded-pill ${phase.toneClass}`}>{phase.value}</span>
                    </td>
                    <td className="d-none d-lg-table-cell text-nowrap small">{showingRange(r)}</td>
                    <td className="d-none d-md-table-cell text-nowrap small">{loggingRange(r)}</td>
                    <td className="d-none d-lg-table-cell small">
                      {r.registration_enabled ? (
                        <span className="text-success-emphasis">{t('admin.raceList.registrationOpen')}</span>
                      ) : (
                        <span className="text-muted">{t('admin.raceList.registrationClosed')}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
