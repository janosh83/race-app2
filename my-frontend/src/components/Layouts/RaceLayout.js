import React, { useState, useRef, useEffect } from 'react';
import { Outlet, useNavigate, useParams } from 'react-router-dom';
import { isTokenExpired, logoutAndRedirect } from '../../utils/api';
import { useTime } from '../../contexts/TimeContext';
import { logger } from '../../utils/logger';

function RaceLayout() {
  const navigate = useNavigate();
  const { raceId } = useParams();
  const [navOpen, setNavOpen] = useState(false);
  const [navHeight, setNavHeight] = useState(56);
  const navRef = useRef(null);
  const { activeRace, signedRaces } = useTime();

  const user = React.useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  }, []);

  // Measure navbar height for map offset
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
    measureNav();
    const t = setTimeout(measureNav, 300);
    return () => clearTimeout(t);
  }, [navOpen]);

  // Check token expiry
  useEffect(() => {
    const check = () => {
      const token = localStorage.getItem('accessToken');
      if (!token) return;
      if (isTokenExpired(token, 5)) {
        logger.warn('TOKEN', 'Token expiry detected, logging out');
        logoutAndRedirect();
      }
    };
    check();
    const id = setInterval(check, 30_000);
    logger.info('COMPONENT', 'Token expiry check started', { intervalMs: 30000 });
    return () => clearInterval(id);
  }, []);

  const handleLogout = () => {
    logger.info('AUTH', 'Logout initiated from RaceLayout');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    localStorage.removeItem('signedRaces');
    window.location.reload();
  };

  const navigateTo = (path) => {
    logger.info('NAV', 'Navigation', { path });
    navigate(path);
    setNavOpen(false);
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
                <button className="nav-link btn btn-link" onClick={() => navigateTo('/race')}>Active Race</button>
              </li>
              {activeRace && (
                <>
                  <li className="nav-item">
                    <button className="nav-link btn btn-link" onClick={() => navigateTo(`/race/${activeRace.race_id || activeRace.id}/map`)}>Map</button>
                  </li>
                  <li className="nav-item">
                    <button className="nav-link btn btn-link" onClick={() => navigateTo(`/race/${activeRace.race_id || activeRace.id}/tasks`)}>Tasks</button>
                  </li>
                </>
              )}
              <li className="nav-item">
                <button className="nav-link btn btn-link" onClick={() => navigateTo('/race/standings')}>Standings</button>
              </li>
            </ul>
            <ul className="navbar-nav ms-auto">
              {user && user.is_administrator && (
                <li className="nav-item">
                  <button className="nav-link btn btn-link" onClick={() => navigateTo('/admin')}>Admin</button>
                </li>
              )}
              <li className="nav-item">
                <button className="nav-link btn btn-link text-white" onClick={() => { setNavOpen(false); handleLogout(); }}>Logout</button>
              </li>
            </ul>
          </div>
        </div>
      </nav>
      <div className="container mt-4">
        <Outlet context={{ navHeight }} />
      </div>
    </>
  );
}

export default RaceLayout;
