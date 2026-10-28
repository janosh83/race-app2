import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { selectActiveRace } from '../utils/activeRaceUtils';
import { apiFetch } from '../utils/api';
import { logger } from '../utils/logger';

const TimeContext = createContext(null);

const POLL_INTERVAL_MS = 60_000;
const MIN_EVENT_REFRESH_INTERVAL_MS = 5_000;

const raceIdOf = (race) => race?.race_id ?? race?.id ?? race?.raceId;

function parseRaceTimeField(race, ...keys) {
  for (const k of keys) {
    if (race && race[k]) return Date.parse(race[k]);
  }
  return null;
}

export function timeStateForRace(nowMs, race) {
  const startShow = parseRaceTimeField(race, 'start_showing_checkpoints', 'start_showing_checkpoints_at', 'start_showing');
  const startLogging = parseRaceTimeField(race, 'start_logging', 'start_logging_at');
  const endLogging = parseRaceTimeField(race, 'end_logging', 'end_logging_at');
  const endShow = parseRaceTimeField(race, 'end_showing_checkpoints', 'end_showing_checkpoints_at', 'end_showing');

  if (!startShow || !endShow) return { state: 'UNKNOWN', info: 'Race time window not available' };

  if (nowMs < startShow) {
    return { state: 'BEFORE_SHOW', startShow, startLogging, endLogging, endShow };
  }
  if (nowMs >= startShow && (startLogging === null || nowMs < startLogging)) {
    return { state: 'SHOW_ONLY', startShow, startLogging, endLogging, endShow };
  }
  if (startLogging && nowMs >= startLogging && (!endLogging || nowMs <= endLogging)) {
    return { state: 'LOGGING', startShow, startLogging, endLogging, endShow };
  }
  if (endLogging && nowMs > endLogging && nowMs <= endShow) {
    return { state: 'POST_LOG_SHOW', startShow, startLogging, endLogging, endShow };
  }
  return { state: 'AFTER_SHOW', startShow, startLogging, endLogging, endShow };
}

// Checkpoints and tasks are visible (and served by the API) in these phases.
export function isContentShown(timeInfo) {
  return ['SHOW_ONLY', 'LOGGING', 'POST_LOG_SHOW'].includes(timeInfo?.state);
}

// When showing starts our clock may be slightly ahead of the server's, so a
// 403 right then is retried quietly before it's reported as an error.
export const SHOW_START_RETRIES = 6;
export const SHOW_START_RETRY_MS = 10_000;

export function formatDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString();
}

// isLoggedIn: null while App is still checking auth, then true/false.
export function TimeProvider({ isLoggedIn = null, children }) {
  const [activeRace, setActiveRace] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('activeRace') || 'null');
      logger.info('CONTEXT', 'Initialized activeRace from localStorage', { race: stored?.race_name || stored?.name || 'none' });
      return stored;
    } catch {
      logger.warn('CONTEXT', 'Failed to parse activeRace from localStorage');
      return null;
    }
  });
  const [signedRaces, setSignedRaces] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('signedRaces') || '[]');
      logger.info('CONTEXT', 'Initialized signedRaces from localStorage', { count: stored.length });
      return stored;
    } catch {
      logger.warn('CONTEXT', 'Failed to parse signedRaces from localStorage');
      return [];
    }
  });
  const [selectedLanguage, setSelectedLanguage] = useState(() => {
    try {
      const stored = localStorage.getItem('selectedLanguage') || 'en';
      logger.info('CONTEXT', 'Initialized selectedLanguage from localStorage', { language: stored });
      return stored;
    } catch {
      logger.warn('CONTEXT', 'Failed to parse selectedLanguage from localStorage');
      return 'en';
    }
  });
  const [timeInfo, setTimeInfo] = useState({ state: 'UNKNOWN' });

  const intervalRef = useRef(null);
  const refreshRef = useRef(null);

  useEffect(() => {
    function compute() {
      const now = Date.now();
      const next = timeStateForRace(now, activeRace);
      setTimeInfo(prev => {
        if (!prev) return next;
        if (
          prev.state === next.state &&
          prev.startShow === next.startShow &&
          prev.startLogging === next.startLogging &&
          prev.endLogging === next.endLogging &&
          prev.endShow === next.endShow
        ) {
          return prev; // no change → avoid re-render
        }
        logger.info('CONTEXT', 'Time state changed', { from: prev.state, to: next.state });
        return next;
      });
    }

    compute();
    if (intervalRef.current) clearInterval(intervalRef.current);
    // re-evaluate every 15 seconds
    intervalRef.current = setInterval(compute, 15_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeRace]);

  // Mirrors of state/props for callbacks that must stay stable (so the polling
  // effect below isn't torn down on every refresh).
  const activeRaceRef = useRef(activeRace);
  const isLoggedInRef = useRef(isLoggedIn);
  isLoggedInRef.current = isLoggedIn;
  const lastSyncRef = useRef(0);

  const setActiveRaceAndPersist = useCallback((race) => {
    if (!race) {
      logger.info('CONTEXT', 'Clearing active race');
      localStorage.removeItem('activeRace');
    } else {
      logger.info('CONTEXT', 'Setting active race', { race: race.race_name || race.name || race.race_id });
      localStorage.setItem('activeRace', JSON.stringify(race));
    }
    activeRaceRef.current = race;
    setActiveRace(race);
  }, []);

  const setSignedRacesAndPersist = useCallback((races) => {
    const safeRaces = races || [];
    logger.info('CONTEXT', 'Updating signed races', { count: safeRaces.length });
    setSignedRaces(safeRaces);
    localStorage.setItem('signedRaces', JSON.stringify(safeRaces));
  }, []);

  const setSelectedLanguageAndPersist = useCallback((language) => {
    logger.info('CONTEXT', 'Setting selected language', { language });
    setSelectedLanguage(language);
    localStorage.setItem('selectedLanguage', language);
  }, []);

  /**
   * Store a fresh signed-races list (from login or a refresh) and reconcile the
   * selected race with it:
   * - the selected race is replaced by its fresh copy, or cleared when the user
   *   is no longer registered for it (e.g. an admin removed the registration);
   * - with no race selected, a single race currently in its time window is
   *   auto-selected. A race the user picked manually is never replaced.
   * Returns the resulting active race (or null).
   */
  const syncSignedRaces = useCallback((races, { resetSelection = false } = {}) => {
    const safeRaces = Array.isArray(races) ? races : [];
    lastSyncRef.current = Date.now();
    setSignedRacesAndPersist(safeRaces);

    const current = resetSelection ? null : activeRaceRef.current;
    let next = current ? safeRaces.find(r => raceIdOf(r) === raceIdOf(current)) ?? null : null;
    if (current && !next) {
      logger.info('CONTEXT', 'Selected race is no longer among signed races, clearing it', { raceId: raceIdOf(current) });
    }
    if (!next) {
      const { activeRaceId } = selectActiveRace(safeRaces);
      if (activeRaceId !== null && activeRaceId !== undefined) {
        next = safeRaces.find(r => raceIdOf(r) === activeRaceId) ?? null;
        logger.info('CONTEXT', 'Auto-selecting the only race in its time window', { raceId: activeRaceId });
      }
    }
    // Compare with the stored race, not `current`: with resetSelection both
    // may be null while a previous session's race is still stored.
    if (next !== activeRaceRef.current) setActiveRaceAndPersist(next);
    return next;
  }, [setActiveRaceAndPersist, setSignedRacesAndPersist]);

  const refreshSignedRaces = useCallback(async () => {
    logger.info('CONTEXT', 'Refreshing signed races from server');
    lastSyncRef.current = Date.now(); // also covers the request in flight
    try {
      const data = await apiFetch('/api/user/signed-races/');
      // Ignore a response that arrives after logout.
      if (!isLoggedInRef.current) return;
      if (data && Array.isArray(data.signed_races)) {
        syncSignedRaces(data.signed_races);
        logger.success('CONTEXT', 'Signed races refreshed successfully');
      }
    } catch (e) {
      logger.error('CONTEXT', 'Failed to refresh signed races', e.message);
      // ignore errors; next refresh will try again
    }
  }, [syncSignedRaces]);

  useEffect(() => {
    if (isLoggedIn === false) {
      // Logged out (possibly in another tab, without a page reload): drop the
      // previous user's races so nothing keeps polling or shows stale data.
      setSignedRacesAndPersist([]);
      setActiveRaceAndPersist(null);
      return undefined;
    }
    if (!isLoggedIn) return undefined; // auth check still in progress

    // Focus and visibilitychange often fire together, and right after login
    // the list is already fresh, so skip event refreshes that come too soon.
    const refreshIfStale = (reason) => {
      if (Date.now() - lastSyncRef.current < MIN_EVENT_REFRESH_INTERVAL_MS) return;
      logger.info('CONTEXT', `Refreshing races: ${reason}`);
      refreshSignedRaces();
    };
    const onFocus = () => refreshIfStale('window focus');
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refreshIfStale('tab visible');
    };

    refreshIfStale('logged in');
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    if (refreshRef.current) clearInterval(refreshRef.current);
    refreshRef.current = setInterval(() => {
      logger.info('CONTEXT', 'Periodic refresh triggered');
      refreshSignedRaces();
    }, POLL_INTERVAL_MS);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      if (refreshRef.current) clearInterval(refreshRef.current);
    };
  }, [isLoggedIn, refreshSignedRaces, setActiveRaceAndPersist, setSignedRacesAndPersist]);

  return (
    <TimeContext.Provider value={{ activeRace, setActiveRace: setActiveRaceAndPersist, timeInfo, signedRaces, setSignedRaces: setSignedRacesAndPersist, syncSignedRaces, refreshSignedRaces, selectedLanguage, setSelectedLanguage: setSelectedLanguageAndPersist }}>
      {children}
    </TimeContext.Provider>
  );
}

export function useTime() {
  const ctx = useContext(TimeContext);
  if (!ctx) throw new Error('useTime must be used within a TimeProvider');
  return ctx;
}

export default TimeContext;
