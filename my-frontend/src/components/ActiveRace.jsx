import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { formatDate, timeStateForRace, useTime } from '../contexts/TimeContext';
import { findCandidates } from '../utils/activeRaceUtils';
import { isTokenExpired, logoutAndRedirect } from '../utils/api';
import { logger } from '../utils/logger';

import LanguageFlagsDisplay from './LanguageFlagsDisplay';

const getPhasePresentation = (t, phaseState) => ({
  value: t(`activeRace.phase.${phaseState || 'UNKNOWN'}`),
  toneClass: phaseState === 'LOGGING'
    ? 'bg-success-subtle text-success-emphasis'
    : phaseState === 'SHOW_ONLY' || phaseState === 'POST_LOG_SHOW'
      ? 'bg-info-subtle text-info-emphasis'
      : phaseState === 'BEFORE_SHOW'
        ? 'bg-warning-subtle text-warning-emphasis'
        : 'bg-secondary-subtle text-secondary-emphasis',
});


function ActiveRace() {
  const { t } = useTranslation();
  // token expiry watcher (redirect to login when token expires)
  useEffect(() => {
    const check = () => {
      const token = localStorage.getItem('accessToken');
      if (!token) return;
      if (isTokenExpired(token, 5)) {
        logger.warn('TOKEN', 'Token expiry detected in ActiveRace');
        logoutAndRedirect();
      }
    };
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, []);

  const { activeRace, setActiveRace, signedRaces, timeInfo } = useTime();
  const candidates = useMemo(() => findCandidates(signedRaces || []), [signedRaces]);

  const normalizeName = (race) => race.name || race.race_name || t('activeRace.unnamedRace');
  const normalizeDescription = (race) => race.description || race.race_description || '';
  const activeRaceTimeConstraints = activeRace
    ? [
        {
          key: 'showing-window',
          label: t('activeRace.showingWindowLabel'),
          start: formatDate(activeRace.start_showing_checkpoints || activeRace.start_showing_checkpoints_at),
          end: formatDate(activeRace.end_showing_checkpoints || activeRace.end_showing_checkpoints_at),
        },
        {
          key: 'logging-window',
          label: t('activeRace.loggingWindowLabel'),
          start: formatDate(activeRace.start_logging || activeRace.start_logging_at),
          end: formatDate(activeRace.end_logging || activeRace.end_logging_at),
        },
      ]
    : [];

  const currentPhase = {
    label: t('activeRace.currentPhaseLabel'),
    ...getPhasePresentation(t, timeInfo?.state || 'UNKNOWN'),
  };

  useEffect(() => {
    if (!activeRace && candidates.length === 1) {
      logger.info('RACE', 'Auto-selecting single candidate race', { race: candidates[0].name || candidates[0].race_id });
      setActiveRace(candidates[0]);
    }
  }, [activeRace, candidates, setActiveRace]);


  const handleSelect = (race) => {
    logger.info('RACE', 'User selected race', { race: race.name || race.race_id });
    setActiveRace(race);
  };

  const others = signedRaces.filter(r => {
    if (!activeRace) return true;
    const idA = activeRace.race_id ?? activeRace.id ?? activeRace.raceId;
    const idB = r.race_id ?? r.id ?? r.raceId;
    return idA !== idB;
  });

  return (
    <div className="container mt-5">
      <h2>{t('activeRace.selectTitle')}</h2>
      <div className="alert alert-info py-2 px-3 mt-3" role="note">
        {t('activeRace.selectedRaceScopeNote')}
      </div>

      {activeRace ? (
        <div className="card mb-4">
          <div className="card-body">
            <h4 className="card-title">{normalizeName(activeRace)}</h4>
            <p className="card-text">{normalizeDescription(activeRace)}</p>

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

            <div
              className="mt-3 mb-3"
              style={{
                backgroundColor: '#fff8e7',
                border: '1px solid rgba(255, 193, 7, 0.25)',
                borderRadius: '12px',
                padding: '12px 16px',
              }}
            >
              <div>
                <div className="text-muted small mb-1">{currentPhase.label}</div>
                <div style={{ fontWeight: 600 }}>{currentPhase.value}</div>
              </div>
            </div>

            <div className="row g-3 mt-1">
              {activeRaceTimeConstraints.map((constraint) => (
                <div key={constraint.key} className="col-12 col-md-6">
                  <div
                    className="h-100"
                    style={{
                      backgroundColor: '#f8f9fa',
                      border: '1px solid rgba(0, 0, 0, 0.08)',
                      borderRadius: '12px',
                      padding: '14px 16px',
                    }}
                  >
                    <div className="text-muted small mb-1">{constraint.label}</div>
                    <div style={{ fontWeight: 600 }}>{constraint.start}</div>
                    <div className="text-muted small my-1">{t('activeRace.intervalSeparator')}</div>
                    <div style={{ fontWeight: 600 }}>{constraint.end}</div>
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
            <div>
              {t('activeRace.multipleActive')}
            </div>
          )}
        </div>
      )}

      <h3>{t('activeRace.otherSigned')}</h3>
      {others.length === 0 ? (
        <p>{t('activeRace.noOtherRaces')}</p>
      ) : (
        <div className="list-group">
          {others.map(r => {
            const id = r.race_id ?? r.id ?? r.raceId;
            const isCandidate = candidates.some(c => (c.race_id ?? c.id ?? c.raceId) === id);
            const otherRacePhase = getPhasePresentation(t, timeStateForRace(Date.now(), r).state);
            const otherRaceConstraints = [
              {
                key: 'showing-window',
                label: t('activeRace.showingWindowLabel'),
                start: formatDate(r.start_showing_checkpoints || r.start_showing_checkpoints_at),
                end: formatDate(r.end_showing_checkpoints || r.end_showing_checkpoints_at),
              },
              {
                key: 'logging-window',
                label: t('activeRace.loggingWindowLabel'),
                start: formatDate(r.start_logging || r.start_logging_at),
                end: formatDate(r.end_logging || r.end_logging_at),
              },
            ];
            return (
              <div key={id} className="list-group-item py-3">
                <div className="d-flex flex-column flex-lg-row justify-content-between gap-3">
                  <div className="flex-grow-1">
                    <strong>{normalizeName(r)}</strong>
                    <div className="text-muted small mb-2">{normalizeDescription(r)}</div>
                    <div className="d-flex flex-wrap gap-2">
                      {otherRaceConstraints.map((constraint) => (
                        <div
                          key={constraint.key}
                          style={{
                            backgroundColor: '#f8f9fa',
                            border: '1px solid rgba(0, 0, 0, 0.08)',
                            borderRadius: '999px',
                            padding: '6px 10px',
                            fontSize: '0.85rem',
                            lineHeight: 1.3,
                          }}
                        >
                          <span className="text-muted">{constraint.label}:</span>{' '}
                          <span style={{ fontWeight: 600 }}>{constraint.start}</span>{' '}
                          <span className="text-muted">{t('activeRace.intervalSeparator')}</span>{' '}
                          <span style={{ fontWeight: 600 }}>{constraint.end}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="text-lg-end d-flex flex-lg-column align-items-start align-items-lg-end gap-2">
                    <span className={`badge rounded-pill px-3 py-2 ${otherRacePhase.toneClass}`}>
                      {otherRacePhase.value}
                    </span>
                    {isCandidate && <span className="badge bg-info mb-2">{t('activeRace.currentlyShowing')}</span>}
                    <button className="btn btn-sm btn-outline-primary" onClick={() => handleSelect(r)}>
                      {t('activeRace.select')}
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

export default ActiveRace;