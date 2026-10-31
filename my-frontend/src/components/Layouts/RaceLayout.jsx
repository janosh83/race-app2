import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { useTime } from '../../contexts/TimeContext';
import { findCandidates } from '../../utils/activeRaceUtils';
import { logoutAndRedirect } from '../../utils/api';
import { initialsOf, readStoredUser } from '../../utils/currentUser';
import { logger } from '../../utils/logger';
import LanguageSwitcher from '../LanguageSwitcher';

import './BrandNavbar.css';
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
  const { activeRace, signedRaces } = useTime();
  const location = useLocation();
  const activeRaceId = activeRace ? (activeRace.race_id || activeRace.id) : null;
  const activeRaceName = activeRace
    ? (activeRace.race_name || activeRace.name || activeRace.title || `Race #${activeRaceId}`)
    : null;
  // Several races at once (e.g. a family and a sport category): remind that
  // the one shown can be switched. Not on the race list itself.
  const runningCount = React.useMemo(() => findCandidates(signedRaces || []).length, [signedRaces]);
  const showRunningNotice = runningCount >= 2 && location.pathname !== '/race';

  const user = React.useMemo(() => readStoredUser(), []);
  // Team and category belong to the selected race (they can differ per race).
  const teamLine = [activeRace?.team_name, activeRace?.race_category].filter(Boolean).join(' · ');

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
  }, [navOpen, activeRaceId, showRunningNotice, measureNav]);

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
      <nav ref={navRef} className="navbar navbar-expand-lg navbar-dark brand-navbar race-navbar" style={{ position: 'relative', zIndex: 1040 }}>
        <div className="container-fluid">
          {activeRace ? (
            // The selected race's name is the race switcher: tap = My races.
            <button
              type="button"
              className="navbar-brand brand-navbar-brand race-navbar-switcher btn btn-link"
              onClick={() => navigateTo('/race')}
              title={t('nav.switchRace')}
              aria-label={t('nav.switchRaceNamed', { name: activeRaceName })}
            >
              <img src="/logo192.png" alt="" width="28" height="28" className="brand-navbar-logo" />
              <span className="race-navbar-switcher-name">{activeRaceName}</span>
              <span className="race-navbar-switcher-caret" aria-hidden="true">▾</span>
            </button>
          ) : (
            <span className="navbar-brand brand-navbar-brand">
              <img src="/logo192.png" alt="" width="28" height="28" className="brand-navbar-logo" />
              {t('nav.brand')}
            </span>
          )}
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
            {user?.name && (
              // Phones: who is logged in, on top of the menu.
              <div className="race-navbar-account d-lg-none" data-testid="account-menu">
                <span className="race-navbar-avatar" aria-hidden="true">{initialsOf(user.name)}</span>
                <div className="race-navbar-account-text">
                  <div className="race-navbar-account-name">{user.name}</div>
                  {teamLine && <div className="race-navbar-account-team">{teamLine}</div>}
                </div>
              </div>
            )}
            <ul className="navbar-nav me-auto mb-2 mb-lg-0">
              <li className="nav-item">
                <button
                  className={`nav-link btn btn-link ${location.pathname === '/race' ? 'active' : ''}`}
                  aria-current={location.pathname === '/race' ? 'page' : undefined}
                  onClick={() => navigateTo('/race')}
                >
                  {t('nav.myRaces')}
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
              <li className="nav-item d-flex align-items-center me-lg-2 py-1 py-lg-0">
                <LanguageSwitcher variant="dark" />
              </li>
              {user && user.is_administrator && (
                <li className="nav-item">
                  <button className="nav-link btn btn-link" onClick={() => navigateTo('/admin')}>{t('nav.admin')}</button>
                </li>
              )}
              {user?.name && (
                // Wide screens: a compact chip; the team is in the tooltip.
                <li className="nav-item d-none d-lg-flex align-items-center me-1">
                  <span
                    className="race-navbar-account race-navbar-account-compact"
                    title={teamLine ? `${user.name} · ${teamLine}` : user.name}
                    data-testid="account-chip"
                  >
                    <span className="race-navbar-avatar" aria-hidden="true">{initialsOf(user.name)}</span>
                    <span className="race-navbar-account-name">{user.name}</span>
                  </span>
                </li>
              )}
              <li className="nav-item">
                <button className="nav-link btn btn-link text-white" onClick={() => { setNavOpen(false); handleLogout(); }}>{t('nav.logout')}</button>
              </li>
            </ul>
          </div>
        </div>
        {showRunningNotice && (
          <div className="race-navbar-notice" role="status">
            <span>{t('nav.racesRunning', { count: runningCount })}</span>
            <button type="button" className="btn btn-link btn-sm race-navbar-notice-link" onClick={() => navigateTo('/race')}>
              {t('nav.switch')}
            </button>
          </div>
        )}
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
