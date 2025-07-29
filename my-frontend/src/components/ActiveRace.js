import React, { useState } from 'react';

function ActiveRace() {
  const signedRaces = JSON.parse(localStorage.getItem('signedRaces')) || [];
  const [selectedRace, setSelectedRace] = useState(null);

  const handleSelect = (race) => {
    setSelectedRace(race);
    localStorage.setItem('activeRace', JSON.stringify(race));
  };

  return (
    <div className="container mt-5">
      <h2>Active Races</h2>
      {signedRaces.length === 0 ? (
        <p>You are not signed up for any races.</p>
      ) : (
        <ul className="list-group">
          {signedRaces.map((race) => (
            <li
              key={race.race_id}
              className={`list-group-item d-flex justify-content-between align-items-center${selectedRace && selectedRace.race_id === race.race_id ? ' active' : ''}`}
              style={{ cursor: 'pointer' }}
              onClick={() => handleSelect(race)}
            >
              <span>
                <strong>{race.name}</strong> (Team ID: {race.team_id})
              </span>
              {selectedRace && selectedRace.race_id === race.race_id && (
                <span className="badge bg-success">Selected</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {selectedRace && (
        <div className="alert alert-info mt-4">
          <strong>Selected Race:</strong> {selectedRace.name}
        </div>
      )}
    </div>
  );
}

export default ActiveRace;