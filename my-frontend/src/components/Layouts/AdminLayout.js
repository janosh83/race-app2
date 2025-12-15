import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { isTokenExpired, logoutAndRedirect } from '../../utils/api';

function AdminLayout() {
  const navigate = useNavigate();
  const [navOpen, setNavOpen] = useState(false);

  const user = React.useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
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
    if (user && !user.is_administrator) {
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
          <span className="navbar-brand">Race App - Admin</span>
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
            <ul className="navbar-nav me-auto mb-2 mb-lg-0">
              <li className="nav-item">
                <button className="nav-link btn btn-link" onClick={() => navigateTo('/admin/races')}>Races</button>
              </li>
              <li className="nav-item">
                <button className="nav-link btn btn-link" onClick={() => navigateTo('/admin/categories')}>Categories</button>
              </li>
              <li className="nav-item">
                <button className="nav-link btn btn-link" onClick={() => navigateTo('/admin/checkpoints')}>Checkpoints</button>
              </li>
              <li className="nav-item">
                <button className="nav-link btn btn-link" onClick={() => navigateTo('/admin/registrations')}>Registrations</button>
              </li>
            </ul>
            <ul className="navbar-nav ms-auto">
              <li className="nav-item">
                <button className="nav-link btn btn-link" onClick={() => navigateTo('/race')}>Back to Race</button>
              </li>
              <li className="nav-item">
                <button className="nav-link btn btn-link text-white" onClick={() => { setNavOpen(false); handleLogout(); }}>Logout</button>
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
