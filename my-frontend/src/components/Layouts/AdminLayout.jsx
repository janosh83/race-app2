import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useNavigate } from 'react-router-dom';

import { logoutAndRedirect } from '../../utils/api';
import LanguageSwitcher from '../LanguageSwitcher';

import './BrandNavbar.css';

function AdminLayout() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [navOpen, setNavOpen] = useState(false);

  const user = React.useMemo(() => {
    try {
      const userData = JSON.parse(localStorage.getItem('user') || 'null');
      return userData;
    } catch {
      return null;
    }
  }, []);

  // Redirect non-admins
  useEffect(() => {
    if (user && user.is_administrator === false) {
      navigate('/race');
    }
  }, [user, navigate]);

  // Same logout as the race view: also ends the session on the server, so the
  // refresh cookie can't log the next person on this computer back in.
  const handleLogout = () => {
    logoutAndRedirect();
  };

  const navigateTo = (path) => {
    navigate(path);
    setNavOpen(false);
  };

  return (
    <>
      <nav className="navbar navbar-expand-lg navbar-dark brand-navbar brand-navbar-admin" style={{ position: 'relative', zIndex: 1040 }}>
        <div className="container-fluid">
          <span className="navbar-brand brand-navbar-brand">
            <img src="/logo192.png" alt="" width="28" height="28" className="brand-navbar-logo" />
            {t('nav.brand')}
            <span className="brand-navbar-admin-label">{t('nav.admin')}</span>
          </span>
          <button
            className="navbar-toggler"
            type="button"
            aria-controls="adminNavbar"
            aria-expanded={navOpen ? 'true' : 'false'}
            aria-label="Toggle navigation"
            onClick={() => setNavOpen(o => !o)}
          >
            <span className="navbar-toggler-icon"></span>
          </button>
          <div id="adminNavbar" className={`collapse navbar-collapse ${navOpen ? 'show' : ''}`}>
            <ul className="navbar-nav ms-auto">
              <li className="nav-item d-flex align-items-center me-2">
                <LanguageSwitcher />
              </li>
              <li className="nav-item">
                <button className="nav-link btn btn-link" onClick={() => navigateTo('/race')}>{t('nav.backToRace')}</button>
              </li>
              <li className="nav-item">
                <button className="nav-link btn btn-link text-white" onClick={() => { setNavOpen(false); handleLogout(); }}>{t('nav.logout')}</button>
              </li>
            </ul>
          </div>
        </div>
      </nav>
      <div className="container mt-4">
        <Outlet />
      </div>
    </>
  );
}

export default AdminLayout;
