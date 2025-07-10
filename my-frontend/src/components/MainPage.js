import React, { useState } from 'react';
import ActiveRace from './ActiveRace';
import Map from './Map';
import Tasks from './Tasks';
import Standings from './Standings';

function MainPage() {
  const [activeSection, setActiveSection] = useState('activeRaces');

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