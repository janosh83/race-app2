import React, { useState, useRef, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../LanguageSwitcher';
import { isTokenExpired, logoutAndRedirect } from '../../utils/api';
import { useTime } from '../../contexts/TimeContext';
import { logger } from '../../utils/logger';

function RaceLayout() {
  const navigate = useNavigate();
  const { t } = useTranslation();
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
    logoutAndRedirect();
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
          <span className="navbar-brand">{t('nav.brand')}</span>
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
                <button className="nav-link btn btn-link" onClick={() => navigateTo('/race')}>
                  {activeRace ? (activeRace.race_name || activeRace.name || activeRace.title || `Race #${activeRace.race_id || activeRace.id}`) : t('nav.activeRace')}
                </button>
              </li>
              {activeRace && (
                <>
                  <li className="nav-item">
                    <button className="nav-link btn btn-link" onClick={() => navigateTo(`/race/${activeRace.race_id || activeRace.id}/map`)}>{t('nav.map')}</button>
                  </li>
                  <li className="nav-item">
                    <button className="nav-link btn btn-link" onClick={() => navigateTo(`/race/${activeRace.race_id || activeRace.id}/tasks`)}>{t('nav.tasks')}</button>
                  </li>
                  <li className="nav-item">
                    <button className="nav-link btn btn-link" onClick={() => navigateTo(`/race/${activeRace.race_id || activeRace.id}/standings`)}>{t('nav.standings')}</button>
                  </li>
                </>
              )}
            </ul>
            <ul className="navbar-nav ms-auto">
              <li className="nav-item d-flex align-items-center me-2">
                <LanguageSwitcher />
              </li>
              {user && user.is_administrator && (
                <li className="nav-item">
                  <button className="nav-link btn btn-link" onClick={() => navigateTo('/admin')}>{t('nav.admin')}</button>
                </li>
              )}
              <li className="nav-item">
                <button className="nav-link btn btn-link text-white" onClick={() => { setNavOpen(false); handleLogout(); }}>{t('nav.logout')}</button>
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
