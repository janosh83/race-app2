import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { useTime } from '../../contexts/TimeContext';
import { logoutAndRedirect } from '../../utils/api';
import { logger } from '../../utils/logger';
import LanguageSwitcher from '../LanguageSwitcher';

import './RaceLayout.css';

const iconProps = {
  width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
};

const TAB_ICONS = {
  map: (
    <svg {...iconProps}>
      <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  ),
  checkpoints: (
    <svg {...iconProps}>
      <path d="M5 21V4" />
      <path d="M5 4h11l-2 4 2 4H5" />
    </svg>
  ),
  tasks: (
    <svg {...iconProps}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8.5 12l2.5 2.5 4.5-5" />
    </svg>
  ),
  standings: (
    <svg {...iconProps}>
      <path d="M5 20v-6M12 20V6M19 20v-9" />
    </svg>
  ),
};

const RACE_TABS = ['map', 'checkpoints', 'tasks', 'standings'];

function RaceLayout() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [navOpen, setNavOpen] = useState(false);
  const [navHeight, setNavHeight] = useState(56);
  const navRef = useRef(null);
  const [tabbarHeight, setTabbarHeight] = useState(0);
  const tabbarRef = useRef(null);
  const { activeRace } = useTime();
  const location = useLocation();
  const activeRaceId = activeRace ? (activeRace.race_id || activeRace.id) : null;

  const user = React.useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  }, []);

  // Measure navbar height for map offset
  const measureNav = useCallback(() => {
    if (navRef.current) {
      const h = Math.ceil(navRef.current.getBoundingClientRect().height);
      if (h && h !== navHeight) setNavHeight(h);
    }
    // The tab bar is hidden (height 0) on wide screens and without a race.
    const tabbarH = tabbarRef.current ? Math.ceil(tabbarRef.current.getBoundingClientRect().height) : 0;
    setTabbarHeight(tabbarH);
  }, [navHeight]);

  useEffect(() => {
    measureNav();
    const onResize = () => measureNav();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, [measureNav]);

  useEffect(() => {
    measureNav();
    const t = setTimeout(measureNav, 300);
    return () => clearTimeout(t);
  }, [navOpen, activeRaceId, measureNav]);

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
      <nav ref={navRef} className="navbar navbar-expand-lg navbar-dark race-navbar" style={{ position: 'relative', zIndex: 1040 }}>
        <div className="container-fluid">
          <span className="navbar-brand race-navbar-brand">
            <img src="/logo192.png" alt="" width="32" height="32" className="race-navbar-logo" />
            {t('nav.brand')}
          </span>
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
                  <li className="nav-item d-none d-lg-block">
                    <button className="nav-link btn btn-link" onClick={() => navigateTo(`/race/${activeRace.race_id || activeRace.id}/map`)}>{t('nav.map')}</button>
                  </li>
                  <li className="nav-item d-none d-lg-block">
                    <button className="nav-link btn btn-link" onClick={() => navigateTo(`/race/${activeRace.race_id || activeRace.id}/checkpoints`)}>{t('nav.checkpoints')}</button>
                  </li>
                  <li className="nav-item d-none d-lg-block">
                    <button className="nav-link btn btn-link" onClick={() => navigateTo(`/race/${activeRace.race_id || activeRace.id}/tasks`)}>{t('nav.tasks')}</button>
                  </li>
                  <li className="nav-item d-none d-lg-block">
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
      <div
        className="container mt-4"
        style={tabbarHeight ? { paddingBottom: tabbarHeight + 16, '--race-tabbar-height': `${tabbarHeight}px` } : undefined}
      >
        <Outlet context={{ navHeight, tabbarHeight }} />
      </div>
      {activeRaceId && (
        <nav ref={tabbarRef} className="race-tabbar d-lg-none" aria-label={t('nav.raceSections')}>
          {RACE_TABS.map((tab) => {
            const path = `/race/${activeRaceId}/${tab}`;
            const isActive = location.pathname === path;
            return (
              <button
                key={tab}
                type="button"
                className={`race-tabbar-item ${isActive ? 'is-active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => navigateTo(path)}
              >
                {TAB_ICONS[tab]}
                <span className="race-tabbar-label">{t(`nav.${tab}`)}</span>
              </button>
            );
          })}
        </nav>
      )}
    </>
  );
}

export default RaceLayout;
