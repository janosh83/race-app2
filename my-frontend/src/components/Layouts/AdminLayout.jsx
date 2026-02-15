import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../LanguageSwitcher';
import { isTokenExpired, logoutAndRedirect } from '../../utils/api';

function AdminLayout() {
  console.log('AdminLayout - Component rendering');
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [navOpen, setNavOpen] = useState(false);

  const user = React.useMemo(() => {
    try {
      const userData = JSON.parse(localStorage.getItem('user') || 'null');
      console.log('AdminLayout - User data:', userData);
      return userData;
    } catch {
      return null;
    }
  }, []);

  // Check token expiry
  useEffect(() => {
    const check = () => {
      const token = localStorage.getItem('accessToken');
      if (!token) return;
      if (isTokenExpired(token, 5)) {
        logoutAndRedirect();
      }
    };
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, []);

  // Redirect non-admins
  useEffect(() => {
    console.log('AdminLayout - Checking admin status. User:', user, 'is_administrator:', user?.is_administrator);
    if (user && user.is_administrator === false) {
      console.log('AdminLayout - Redirecting non-admin to /race');
      navigate('/race');
    }
  }, [user, navigate]);

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    localStorage.removeItem('signedRaces');
    window.location.reload();
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
