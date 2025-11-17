import React, { useState, useEffect } from 'react';
import ActiveRace from './ActiveRace';
import Map from './Map';
import Tasks from './Tasks';
import Standings from './Standings';
import { isTokenExpired, logoutAndRedirect } from '../utils/auth';

function MainPage() {
  // default to activeRace so main page shows content immediately
  const [activeSection, setActiveSection] = useState('activeRace');

  useEffect(() => {
    const stored = localStorage.getItem('activeSection');
    if (stored) {
      setActiveSection(stored);
      localStorage.removeItem('activeSection');
    }
    // keep activeRaceId in storage for ActiveRace component to read if needed
  }, []);

  // --- NEW: periodically check token expiry and redirect to login when expired ---
  useEffect(() => {
    const check = () => {
      const token = localStorage.getItem('accessToken');
      if (!token) return;
      if (isTokenExpired(token, 5)) {
        // small margin (5s) before expiry
        logoutAndRedirect();
      }
    };
    // initial quick check
    check();
    // run every 30 seconds
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, []);

  const renderSection = () => {
    switch (activeSection) {
      case 'activeRace':
        return <ActiveRace />;
      case 'map':
        return <Map />;
      case 'tasks':
        return <Tasks />;
      case 'standings':
        return <Standings />;
      default:
        return null;
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    localStorage.removeItem('signedRaces');
    window.location.reload();
  };

  return (
    <>
      <nav className="navbar navbar-expand-lg navbar-dark bg-primary">
        <div className="container-fluid">
          <span className="navbar-brand">Race App</span>
          <div className="collapse navbar-collapse">
            <ul className="navbar-nav me-auto mb-2 mb-lg-0">
              <li className="nav-item">
                <button className={`nav-link btn btn-link${activeSection === 'activeRace' ? ' active' : ''}`} onClick={() => setActiveSection('activeRace')}>Active Race</button>
              </li>
              <li className="nav-item">
                <button className={`nav-link btn btn-link${activeSection === 'map' ? ' active' : ''}`} onClick={() => setActiveSection('map')}>Map</button>
              </li>
              <li className="nav-item">
                <button className={`nav-link btn btn-link${activeSection === 'tasks' ? ' active' : ''}`} onClick={() => setActiveSection('tasks')}>Tasks</button>
              </li>
              <li className="nav-item">
                <button className={`nav-link btn btn-link${activeSection === 'standings' ? ' active' : ''}`} onClick={() => setActiveSection('standings')}>Standings</button>
              </li>
            </ul>
            <ul className="navbar-nav ms-auto">
              <li className="nav-item">
                <button className="nav-link btn btn-link text-white" onClick={handleLogout}>Logout</button>
              </li>
            </ul>
          </div>
        </div>
      </nav>
      <div className="container mt-4">
        {renderSection()}
      </div>
    </>
  );
}

export default MainPage;