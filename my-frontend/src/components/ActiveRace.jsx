import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { formatDate, useTime } from '../contexts/TimeContext';
import { findCandidates } from '../utils/activeRaceUtils';
import { isTokenExpired, logoutAndRedirect } from '../utils/api';
import { logger } from '../utils/logger';

import LanguageFlagsDisplay from './LanguageFlagsDisplay';


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

  const { activeRace, setActiveRace, signedRaces } = useTime();
  const candidates = useMemo(() => findCandidates(signedRaces || []), [signedRaces]);

  const normalizeName = (race) => race.name || race.race_name || t('activeRace.unnamedRace');
  const normalizeDescription = (race) => race.description || race.race_description || '';

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

            <ul className="list-group list-group-flush">
              <li className="list-group-item">
                {t('activeRace.startShowing')}: {formatDate(activeRace.start_showing_checkpoints || activeRace.start_showing_checkpoints_at)}
              </li>
              <li className="list-group-item">
                {t('activeRace.endShowing')}: {formatDate(activeRace.end_showing_checkpoints || activeRace.end_showing_checkpoints_at)}
              </li>
              <li className="list-group-item">
                {t('activeRace.startLogging')}: {formatDate(activeRace.start_logging || activeRace.start_logging_at)}
              </li>
              <li className="list-group-item">
                {t('activeRace.endLogging')}: {formatDate(activeRace.end_logging || activeRace.end_logging_at)}
              </li>
            </ul>
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
            return (
              <div key={id} className="list-group-item">
                <div className="d-flex justify-content-between">
                  <div>
                    <strong>{normalizeName(r)}</strong>
                    <div className="text-muted small">{normalizeDescription(r)}</div>
                    <div className="small mt-1">
                      {t('activeRace.showingRange', { start: formatDate(r.start_showing_checkpoints || r.start_showing_checkpoints_at), end: formatDate(r.end_showing_checkpoints || r.end_showing_checkpoints_at) })}
                    </div>
                    <div className="small">
                      {t('activeRace.loggingRange', { start: formatDate(r.start_logging || r.start_logging_at), end: formatDate(r.end_logging || r.end_logging_at) })}
                    </div>
                  </div>
                  <div className="text-end">
                    {isCandidate && <span className="badge bg-info mb-2">{t('activeRace.currentlyShowing')}</span>}
                    <div>
                      <button className="btn btn-sm btn-outline-primary" onClick={() => handleSelect(r)}>
                        {t('activeRace.select')}
                      </button>
                    </div>
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