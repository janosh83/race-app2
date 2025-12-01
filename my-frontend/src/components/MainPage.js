import React, { useState, useEffect, useMemo, useRef } from 'react';
import ActiveRace from './ActiveRace';
import Map from './Map';
import Tasks from './Tasks';
import Standings from './Standings';
import AdminDashboard from './Admin/AdminDashboard';
import { isTokenExpired, logoutAndRedirect } from '../utils/api';
import { selectActiveRace } from '../utils/activeRaceUtils';
import { useTime } from '../contexts/TimeContext';

function MainPage() {
  // default to activeRace so main page shows content immediately
  const [activeSection, setActiveSection] = useState('activeRace');

  const { activeRace, setActiveRace, timeInfo, signedRaces } = useTime();
  const [userNavigated, setUserNavigated] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [navHeight, setNavHeight] = useState(56);
  const navRef = useRef(null);

  const navigateTo = (section) => {
    setActiveSection(section);
    setUserNavigated(true);
    setNavOpen(false);
  };

  // Measure navbar height to offset the map on mobile when menu expands
  const measureNav = () => {
    if (navRef.current) {
      const h = Math.ceil(navRef.current.getBoundingClientRect().height);
      if (h && h !== navHeight) setNavHeight(h);
    }
  };

  useEffect(() => {
    measureNav();
    const onResize = () => measureNav();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  useEffect(() => {
    // re-measure when nav opens/closes or section changes
    measureNav();
    // allow collapse animation to finish then re-measure
    const t = setTimeout(measureNav, 300);
    return () => clearTimeout(t);
  }, [navOpen, activeSection]);

  // read signed races and user once (safe parse)
  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  }, []);

  // signedRaces now comes from TimeContext and refreshes automatically

  // Decide initial section based on signed races / active race
  useEffect(() => {
    // Respect manual navigation: if user already navigated to a page, don't override
    if (userNavigated) return;

    const { activeRaceId, candidates } = selectActiveRace(signedRaces || []);
    if (activeRaceId && candidates.length === 1) {
      // ensure TimeContext knows the full activeRace object
      const candidate = (signedRaces || []).find(r => (r.race_id ?? r.id ?? r.raceId) === activeRaceId) || null;
      if (candidate && !activeRace) setActiveRace(candidate);
      // only switch to map immediately if the time state allows it
      const state = timeInfo?.state;
      if (state && state !== 'BEFORE_SHOW' && state !== 'AFTER_SHOW') {
        setActiveSection('map');
      }
      return;
    }

    // No active race or multiple active races -> show Active Race page
    setActiveSection('activeRace');
  // only run on mount or when signedRaces/timeInfo changes
  }, [signedRaces, activeRace, setActiveRace, userNavigated, timeInfo]);

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
        return <Map topOffset={navHeight} />;
      case 'tasks':
        return <Tasks />;
      case 'standings':
        return <Standings />;
      case 'admin':
        return <AdminDashboard />;
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
      <nav ref={navRef} className="navbar navbar-expand-lg navbar-dark bg-primary" style={{ position: 'relative', zIndex: 1040 }}>
        <div className="container-fluid">
          <span className="navbar-brand">Race App</span>
          <button
            className="navbar-toggler"
            type="button"
            aria-controls="mainNavbar"
            aria-expanded={navOpen ? 'true' : 'false'}
            aria-label="Toggle navigation"
            onClick={() => setNavOpen(o => !o)}
          >
            <span className="navbar-toggler-icon"></span>
          </button>
          <div id="mainNavbar" className={`collapse navbar-collapse ${navOpen ? 'show' : ''}`}>
            <ul className="navbar-nav me-auto mb-2 mb-lg-0">
              <li className="nav-item">
                <button className={`nav-link btn btn-link${activeSection === 'activeRace' ? ' active' : ''}`} onClick={() => navigateTo('activeRace')}>Active Race</button>
              </li>
              {activeRace && (
                <>
                  <li className="nav-item">
                    <button className={`nav-link btn btn-link${activeSection === 'map' ? ' active' : ''}`} onClick={() => navigateTo('map')}>Map</button>
                  </li>
                  <li className="nav-item">
                    <button className={`nav-link btn btn-link${activeSection === 'tasks' ? ' active' : ''}`} onClick={() => navigateTo('tasks')}>Tasks</button>
                  </li>
                </>
              )}
              <li className="nav-item">
                <button className={`nav-link btn btn-link${activeSection === 'standings' ? ' active' : ''}`} onClick={() => navigateTo('standings')}>Standings</button>
              </li>
              {user && user.is_administrator && (
                <li className="nav-item">
                  <button className={`nav-link btn btn-link${activeSection === 'admin' ? ' active' : ''}`} onClick={() => navigateTo('admin')}>Admin</button>
                </li>
              )}
            </ul>
            <ul className="navbar-nav ms-auto">
              <li className="nav-item">
                <button className="nav-link btn btn-link text-white" onClick={() => { setNavOpen(false); handleLogout(); }}>Logout</button>
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