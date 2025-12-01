import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

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
      return JSON.parse(localStorage.getItem('activeRace') || 'null');
    } catch { return null; }
  });
  const [timeInfo, setTimeInfo] = useState({ state: 'UNKNOWN' });

  const intervalRef = useRef(null);

  useEffect(() => {
    function compute() {
      const now = Date.now();
      setTimeInfo(timeStateForRace(now, activeRace));
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
    setActiveRace(race);
    if (race) localStorage.setItem('activeRace', JSON.stringify(race));
    else localStorage.removeItem('activeRace');
  };

  return (
    <TimeContext.Provider value={{ activeRace, setActiveRace: setActiveRaceAndPersist, timeInfo }}>
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
