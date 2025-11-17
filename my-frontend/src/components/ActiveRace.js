import React, { useState, useEffect } from 'react';
import { isTokenExpired, logoutAndRedirect } from '../utils/auth';

function formatDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString();
}

function normalizeName(race) {
  return race.name || race.race_name || 'Unnamed race';
}
function normalizeDescription(race) {
  return race.description || race.race_description || '';
}

function findCandidates(races = []) {
  const now = Date.now();
  return races.filter(r => {
    const startRaw = r.start_showing_checkpoints || r.start_showing_checkpoints_at || r.start_showing || r.start_logging;
    const endRaw = r.end_showing_checkpoints || r.end_showing_checkpoints_at || r.end_showing || r.end_logging;
    const start = startRaw ? Date.parse(startRaw) : null;
    const end = endRaw ? Date.parse(endRaw) : null;
    return start && end && start <= now && now <= end;
  });
}

function ActiveRace() {
  // token expiry watcher (redirect to login when token expires)
  useEffect(() => {
    const check = () => {
      const token = localStorage.getItem('accessToken');
      if (!token) return;
      if (isTokenExpired(token, 5)) logoutAndRedirect();
    };
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, []);

  const signedRaces = JSON.parse(localStorage.getItem('signedRaces')) || [];
  const storedActive = JSON.parse(localStorage.getItem('activeRace') || 'null');
  const [activeRace, setActiveRace] = useState(storedActive);
  const [candidates, setCandidates] = useState([]);

  useEffect(() => {
    const c = findCandidates(signedRaces);
    setCandidates(c);

    if (!activeRace) {
      if (c.length === 1) {
        setActiveRace(c[0]);
        localStorage.setItem('activeRace', JSON.stringify(c[0]));
      }
    }
    // keep activeRace in sync if stored changed elsewhere
  }, []); // run once on mount

  const handleSelect = (race) => {
    setActiveRace(race);
    localStorage.setItem('activeRace', JSON.stringify(race));
  };

  const others = signedRaces.filter(r => {
    if (!activeRace) return true;
    const idA = activeRace.race_id ?? activeRace.id ?? activeRace.raceId;
    const idB = r.race_id ?? r.id ?? r.raceId;
    return idA !== idB;
  });

  return (
    <div className="container mt-5">
      <h2>Active Race</h2>

      {activeRace ? (
        <div className="card mb-4">
          <div className="card-body">
            <h4 className="card-title">{normalizeName(activeRace)}</h4>
            <p className="card-text">{normalizeDescription(activeRace)}</p>

            <ul className="list-group list-group-flush">
              <li className="list-group-item">
                Start showing checkpoints: {formatDate(activeRace.start_showing_checkpoints || activeRace.start_showing_checkpoints_at)}
              </li>
              <li className="list-group-item">
                End showing checkpoints: {formatDate(activeRace.end_showing_checkpoints || activeRace.end_showing_checkpoints_at)}
              </li>
              <li className="list-group-item">
                Start logging: {formatDate(activeRace.start_logging || activeRace.start_logging_at)}
              </li>
              <li className="list-group-item">
                End logging: {formatDate(activeRace.end_logging || activeRace.end_logging_at)}
              </li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="alert alert-warning">
          No active race selected.
          {candidates.length === 0 ? (
            <div>There are no races currently showing checkpoints.</div>
          ) : (
            <div>
              Multiple races are currently active — please choose one from the list below.
            </div>
          )}
        </div>
      )}

      <h3>Other signed races</h3>
      {others.length === 0 ? (
        <p>No other races.</p>
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
                      Showing: {formatDate(r.start_showing_checkpoints || r.start_showing_checkpoints_at)} — {formatDate(r.end_showing_checkpoints || r.end_showing_checkpoints_at)}
                    </div>
                    <div className="small">
                      Logging: {formatDate(r.start_logging || r.start_logging_at)} — {formatDate(r.end_logging || r.end_logging_at)}
                    </div>
                  </div>
                  <div className="text-end">
                    {isCandidate && <span className="badge bg-info mb-2">Currently showing</span>}
                    <div>
                      <button className="btn btn-sm btn-outline-primary" onClick={() => handleSelect(r)}>
                        Select
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