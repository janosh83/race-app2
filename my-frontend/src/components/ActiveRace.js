import React, { useEffect, useMemo } from 'react';
import { isTokenExpired, logoutAndRedirect } from '../utils/api';
import { findCandidates } from '../utils/activeRaceUtils';
import { formatDate, useTime } from '../contexts/TimeContext';

function normalizeName(race) {
  return race.name || race.race_name || 'Unnamed race';
}
function normalizeDescription(race) {
  return race.description || race.race_description || '';
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

  const { activeRace, setActiveRace, signedRaces } = useTime();
  const candidates = useMemo(() => findCandidates(signedRaces || []), [signedRaces]);

  useEffect(() => {
    if (!activeRace && candidates.length === 1) {
      setActiveRace(candidates[0]);
    }
  }, [activeRace, candidates, setActiveRace]);
  

  const handleSelect = (race) => {
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