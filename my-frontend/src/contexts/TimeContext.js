import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../utils/api';
import { logger } from '../utils/logger';

const TimeContext = createContext(null);

function parseRaceTimeField(race, ...keys) {
  for (const k of keys) {
    if (race && race[k]) return Date.parse(race[k]);
  }
  return null;
}

function timeStateForRace(nowMs, race) {
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

export function formatDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString();
}

export function TimeProvider({ children }) {
  const [activeRace, setActiveRace] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('activeRace') || 'null');
      logger.info('CONTEXT', 'Initialized activeRace from localStorage', { race: stored?.name || 'none' });
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

  const setActiveRaceAndPersist = (race) => {
    if (!race) {
      logger.info('CONTEXT', 'Clearing active race');
      localStorage.removeItem('activeRace');
    } else {
      logger.info('CONTEXT', 'Setting active race', { race: race.name || race.race_id });
      localStorage.setItem('activeRace', JSON.stringify(race));
    }
    setActiveRace(race);
  };

  const setSignedRacesAndPersist = (races) => {
    const safeRaces = races || [];
    logger.info('CONTEXT', 'Updating signed races', { count: safeRaces.length });
    setSignedRaces(safeRaces);
    localStorage.setItem('signedRaces', JSON.stringify(safeRaces));
  };

  async function refreshSignedRaces() {
    logger.info('CONTEXT', 'Refreshing signed races from server');
    try {
      const data = await apiFetch('/api/user/signed-races/');
      if (data && Array.isArray(data.signed_races)) {
        setSignedRacesAndPersist(data.signed_races);
        // if our activeRace refers to an outdated object, refresh it by id
        if (activeRace) {
          const idA = activeRace.race_id ?? activeRace.id ?? activeRace.raceId;
          const updated = data.signed_races.find(r => (r.race_id ?? r.id ?? r.raceId) === idA);
          if (updated) {
            logger.info('CONTEXT', 'Updated active race from refresh', { race: updated.name || updated.race_id });
            setActiveRaceAndPersist(updated);
          }
        }
        logger.success('CONTEXT', 'Signed races refreshed successfully');
      }
    } catch (e) {
      logger.error('CONTEXT', 'Failed to refresh signed races', e.message);
      // ignore errors; next refresh will try again
    }
  }

  useEffect(() => {
    // Only set up refresh if user is logged in (has signed races)
    if (!signedRaces || signedRaces.length === 0) {
      if (refreshRef.current) clearInterval(refreshRef.current);
      return;
    }

    // refresh on window focus or when tab becomes visible
    const onFocus = () => {
      logger.info('CONTEXT', 'Window focus detected, refreshing races');
      refreshSignedRaces();
    };
    const onVisibility = () => { 
      if (document.visibilityState === 'visible') {
        logger.info('CONTEXT', 'Tab became visible, refreshing races');
        refreshSignedRaces();
      }
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    // periodic light polling (1 min)
    if (refreshRef.current) clearInterval(refreshRef.current);
    refreshRef.current = setInterval(() => {
      logger.info('CONTEXT', 'Periodic refresh triggered');
      refreshSignedRaces();
    }, 60_000);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      if (refreshRef.current) clearInterval(refreshRef.current);
    };
  }, [activeRace, signedRaces]);

  return (
    <TimeContext.Provider value={{ activeRace, setActiveRace: setActiveRaceAndPersist, timeInfo, signedRaces, setSignedRaces: setSignedRacesAndPersist, refreshSignedRaces }}>
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
