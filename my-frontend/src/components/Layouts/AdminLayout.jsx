import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useNavigate } from 'react-router-dom';

import { isTokenExpired, logoutAndRedirect } from '../../utils/api';
import LanguageSwitcher from '../LanguageSwitcher';

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
};

function AdminLayout() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [navOpen, setNavOpen] = useState(false);
  const [user, setUser] = useState(getStoredUser);

  useEffect(() => {
    const syncUser = () => setUser(getStoredUser());
    window.addEventListener('auth-update', syncUser);
    window.addEventListener('storage', syncUser);
    return () => {
      window.removeEventListener('auth-update', syncUser);
      window.removeEventListener('storage', syncUser);
    };
  }, []);

  // Check token expiry
  useEffect(() => {
    const check = () => {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        navigate('/login', { replace: true });
        return;
      }
      if (isTokenExpired(token, 5)) {
        logoutAndRedirect();
      }
    };
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [navigate]);

  // Redirect non-admins and invalid auth state.
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token || !user) {
      navigate('/login', { replace: true });
      return;
    }
    if (user.is_administrator !== true) {
      navigate('/race', { replace: true });
    }
  }, [user, navigate]);

  const handleLogout = () => {
    logoutAndRedirect();
  };

  const navigateTo = (path) => {
    navigate(path);
    setNavOpen(false);
  };

  return (
    <>
      <nav className="navbar navbar-expand-lg navbar-dark bg-dark" style={{ position: 'relative', zIndex: 1040 }}>
        <div className="container-fluid">
          <span className="navbar-brand">{t('nav.adminBrand')}</span>
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
