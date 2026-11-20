import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import './ActiveRace.css';
import { formatDate, timeStateForRace, useTime } from '../contexts/TimeContext';
import { findCandidates } from '../utils/activeRaceUtils';
import { readStoredUser } from '../utils/currentUser';
import { logger } from '../utils/logger';
import { getPhasePresentation } from '../utils/racePhase';

import LanguageFlagsDisplay from './LanguageFlagsDisplay';

const raceIdOf = (race) => race?.race_id ?? race?.id ?? race?.raceId;
const timeOf = (race, ...fields) => {
  const raw = fields.map(f => race[f]).find(Boolean);
  const ms = raw ? Date.parse(raw) : NaN;
  return Number.isNaN(ms) ? null : ms;
};
const startOf = (race) => timeOf(race, 'start_showing_checkpoints', 'start_showing_checkpoints_at', 'start_logging', 'start_logging_at');
const endOf = (race) => timeOf(race, 'end_showing_checkpoints', 'end_showing_checkpoints_at', 'end_logging', 'end_logging_at');

const timeWindows = (t, race) => [
  {
    key: 'showing-window',
    label: t('activeRace.showingWindowLabel'),
    start: formatDate(race.start_showing_checkpoints || race.start_showing_checkpoints_at),
    end: formatDate(race.end_showing_checkpoints || race.end_showing_checkpoints_at),
  },
  {
    key: 'logging-window',
    label: t('activeRace.loggingWindowLabel'),
    start: formatDate(race.start_logging || race.start_logging_at),
    end: formatDate(race.end_logging || race.end_logging_at),
  },
];

// The user's team in a race: name, category and members (the user first).
function TeamCard({ race, userId }) {
  const { t } = useTranslation();
  const members = [...(race.team_members || [])].sort((a, b) => (b.id === userId) - (a.id === userId));
  if (!race.team_name && !race.race_category && members.length === 0) return null;
  return (
    <div className="active-race-team mb-3">
      <div className="text-muted small mb-1">{t('activeRace.yourTeam')}</div>
      <div className="d-flex align-items-center flex-wrap gap-2">
        {race.team_name && <span className="active-race-strong">{race.team_name}</span>}
        {race.race_category && (
          <span className="badge rounded-pill bg-primary-subtle text-primary-emphasis">{race.race_category}</span>
        )}
      </div>
      {members.length > 0 && (
        <ul className="active-race-team-members list-unstyled mb-0 mt-2" aria-label={t('activeRace.teamMembers')}>
          {members.map(member => (
            <li key={member.id}>
              {member.name}
              {member.id === userId && <span className="text-muted"> ({t('activeRace.you')})</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// "My races": the selected race on top, then the other signed races grouped
// as running now (to switch between races held at the same time), upcoming
// and past (opened read-only: map, checkpoints and final results).
function ActiveRace() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { activeRace, setActiveRace, signedRaces, timeInfo } = useTime();
  const races = useMemo(() => signedRaces || [], [signedRaces]);
  const userId = useMemo(() => readStoredUser()?.id, []);
  const candidates = useMemo(() => findCandidates(races), [races]);

  const normalizeName = (race) => race.name || race.race_name || t('activeRace.unnamedRace');
  const normalizeDescription = (race) => race.description || race.race_description || '';
  const activeRaceId = raceIdOf(activeRace);

  const currentPhase = {
    label: t('activeRace.currentPhaseLabel'),
    ...getPhasePresentation(t, timeInfo?.state || 'UNKNOWN'),
  };

  const groups = useMemo(() => {
    const now = Date.now();
    const running = [];
    const upcoming = [];
    const past = [];
    races.forEach((race) => {
      if (activeRace && raceIdOf(race) === activeRaceId) return;
      if (candidates.some(c => raceIdOf(c) === raceIdOf(race))) running.push(race);
      else if ((endOf(race) ?? Infinity) < now) past.push(race);
      else upcoming.push(race);
    });
    upcoming.sort((a, b) => (startOf(a) ?? Infinity) - (startOf(b) ?? Infinity));
    past.sort((a, b) => (endOf(b) ?? 0) - (endOf(a) ?? 0));
    return [
      { key: 'running', title: t('activeRace.groupRunning'), races: running },
      { key: 'upcoming', title: t('activeRace.groupUpcoming'), races: upcoming },
      { key: 'past', title: t('activeRace.groupPast'), races: past },
    ].filter(group => group.races.length > 0);
  }, [races, candidates, activeRace, activeRaceId, t]);

  const handleSelect = (race, groupKey) => {
    logger.info('RACE', 'User selected race', { race: race.name || race.race_id });
    setActiveRace(race);
    // A running race is picked to log visits in it, so go straight to its map;
    // otherwise stay here with the race shown on top.
    if (groupKey === 'running') navigate(`/race/${raceIdOf(race)}/map`);
    else window.scrollTo?.({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="container mt-4 active-race-page">
      <h2>{t('activeRace.myRaces')}</h2>

      {activeRace ? (
        <div className="card mb-4 active-race-selected">
          <div className="card-body">
            <div className="text-muted small text-uppercase fw-semibold mb-1">{t('activeRace.selectedLabel')}</div>
            <h3 className="h4 card-title">{normalizeName(activeRace)}</h3>
            <p className="card-text">{normalizeDescription(activeRace)}</p>
            <p className="small text-muted">{t('activeRace.selectedRaceScopeNote')}</p>

            <TeamCard race={activeRace} userId={userId} />

            {activeRace.supported_languages && activeRace.supported_languages.length > 0 && (
              <div className="mb-3">
                <p className="text-muted small mb-2">{t('activeRace.supportedLanguages')}:</p>
                <LanguageFlagsDisplay
                  languages={activeRace.supported_languages}
                  flagWidth={32}
                  flagHeight={24}
                />
              </div>
            )}

            <div className="mt-3 mb-3 active-race-current-phase">
              <div className="text-muted small mb-1">{currentPhase.label}</div>
              <div className="active-race-strong">{currentPhase.value}</div>
            </div>

            <div className="d-flex flex-wrap gap-2 mb-3">
              <Link className="btn btn-primary" to={`/race/${activeRaceId}/map`}>
                {t('nav.map')}
              </Link>
              <Link className="btn btn-outline-primary" to={`/race/${activeRaceId}/checkpoints`}>
                {t('nav.checkpoints')}
              </Link>
              <Link className="btn btn-outline-primary" to={`/race/${activeRaceId}/tasks`}>
                {t('nav.tasks')}
              </Link>
              <Link className="btn btn-outline-primary" to={`/race/${activeRaceId}/standings`}>
                {t('nav.standings')}
              </Link>
            </div>

            <div className="row g-3 mt-1">
              {timeWindows(t, activeRace).map((constraint) => (
                <div key={constraint.key} className="col-12 col-md-6">
                  <div className="h-100 active-race-time-window">
                    <div className="text-muted small mb-1">{constraint.label}</div>
                    <div className="active-race-strong">{constraint.start}</div>
                    <div className="text-muted small my-1">{t('activeRace.intervalSeparator')}</div>
                    <div className="active-race-strong">{constraint.end}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="alert alert-warning">
          {t('activeRace.noActiveSelected')}
          {candidates.length === 0 ? (
            <div>{t('activeRace.noneShowing')}</div>
          ) : (
            <div>{t('activeRace.multipleActive')}</div>
          )}
        </div>
      )}

      {groups.length === 0 && (
        <p className="text-muted">{t('activeRace.noOtherRaces')}</p>
      )}

      {groups.map(group => (
        <section key={group.key} className="mb-4" aria-labelledby={`races-${group.key}`}>
          <h3 id={`races-${group.key}`} className="h5">
            {group.title} <span className="text-muted fw-normal">({group.races.length})</span>
          </h3>
          <div className="list-group">
            {group.races.map(r => {
              const phase = getPhasePresentation(t, timeStateForRace(Date.now(), r).state);
              return (
                <div key={raceIdOf(r)} className="list-group-item py-3">
                  <div className="d-flex flex-column flex-lg-row justify-content-between gap-3">
                    <div className="flex-grow-1">
                      <strong>{normalizeName(r)}</strong>
                      {(r.team_name || r.race_category) && (
                        <div className="small mb-1">
                          {[r.team_name, r.race_category].filter(Boolean).join(' · ')}
                        </div>
                      )}
                      <div className="text-muted small mb-2">{normalizeDescription(r)}</div>
                      <div className="d-flex flex-wrap gap-2">
                        {timeWindows(t, r).map((constraint) => (
                          <div key={constraint.key} className="active-race-chip">
                            <span className="text-muted">{constraint.label}:</span>{' '}
                            <span className="active-race-strong">{constraint.start}</span>{' '}
                            <span className="text-muted">{t('activeRace.intervalSeparator')}</span>{' '}
                            <span className="active-race-strong">{constraint.end}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="d-flex flex-wrap flex-lg-column flex-lg-nowrap align-items-center align-items-lg-end gap-2">
                      <span className={`badge rounded-pill px-3 py-2 ${phase.toneClass}`}>
                        {phase.value}
                      </span>
                      <button
                        type="button"
                        className={`btn ${group.key === 'running' ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={() => handleSelect(r, group.key)}
                      >
                        {group.key === 'past' ? t('activeRace.open') : t('activeRace.select')}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

export default ActiveRace;
