import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import ForgotPassword from './components/ForgotPassword';
import AdminLayout from './components/Layouts/AdminLayout';
import RaceLayout from './components/Layouts/RaceLayout';
import Login from './components/Login';
import ActiveRacePage from './components/Pages/ActiveRacePage';
import AdminPage from './components/Pages/AdminPage';
import CheckpointsPage from './components/Pages/CheckpointsPage';
import MapPage from './components/Pages/MapPage';
import PublicRegistrationPage from './components/Pages/PublicRegistrationPage';
import StandingsPage from './components/Pages/StandingsPage';
import TasksPage from './components/Pages/TasksPage';
import ResetPassword from './components/ResetPassword';
import { TimeProvider, useTime } from './contexts/TimeContext';
import { isTokenExpired, refreshAccessToken } from './utils/api';
import { logger } from './utils/logger';

// Logs once on mount to avoid side effects during render
const LogOnce = ({ message, data, children }) => {
  useEffect(() => {
    logger.info('ROUTING', message, data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return children;
};

// Where a logged-in user lands from /login (right after logging in, or when
// opening /login while logged in): the selected race's map, e.g. a race that
// was auto-selected at login, otherwise race selection. This is the only
// post-login redirect, so nothing competes with it.
function PostLoginRedirect() {
  const { activeRace } = useTime();
  const raceId = activeRace?.race_id ?? activeRace?.id ?? activeRace?.raceId;
  const target = raceId !== null && raceId !== undefined ? `/race/${raceId}/map` : '/race';
  return <Navigate to={target} replace />;
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(null); // null = checking, true/false = determined

  useEffect(() => {
    const syncAuth = async () => {
      logger.info('ROUTING', 'Starting auth check');

      const token = localStorage.getItem('accessToken');
      logger.info('ROUTING', 'Token retrieved', { hasToken: !!token });

      const isExpired = token ? isTokenExpired(token) : true;
      logger.info('ROUTING', 'Token expiry check', { isExpired });

      // A stale/expired access token doesn't mean the session is gone: the
      // HttpOnly refresh cookie may still be valid, so try a silent refresh
      // before declaring the user logged out (this previously caused
      // spurious logouts every time the access token's ~30min lifetime
      // elapsed while the tab regained focus).
      if (token && isExpired) {
        try {
          await refreshAccessToken();
          logger.info('ROUTING', 'Auth check complete after silent refresh', { isLoggedIn: true });
          setIsLoggedIn(true);
          return;
        } catch (err) {
          // Only a rejected refresh cookie means logged out (refreshAccessToken
          // has then already cleared the session). A network error or an
          // aborted request leaves the session intact; the next request,
          // focus or keep-fresh tick retries the refresh.
          const loggedIn = !err?.sessionInvalid;
          logger.info('ROUTING', 'Silent refresh failed', { sessionInvalid: !!err?.sessionInvalid });
          setIsLoggedIn(loggedIn);
          return;
        }
      }

      const loggedIn = !!(token && !isExpired);
      logger.info('ROUTING', 'Auth check complete', { isLoggedIn: loggedIn, hasToken: !!token, isExpired });

      setIsLoggedIn(loggedIn);
    };

    // Refresh the access token shortly before it expires so an idle tab (one
    // making no API calls) stays logged in. This is the only token watcher:
    // refreshAccessToken() logs out only if the refresh cookie is rejected.
    const keepTokenFresh = () => {
      const token = localStorage.getItem('accessToken');
      if (token && isTokenExpired(token, 120)) {
        refreshAccessToken().catch(() => undefined);
      }
    };

    // Run immediately on mount
    syncAuth();

    // Sync when auth changes in-page or across tabs
    window.addEventListener('auth-update', syncAuth);
    window.addEventListener('storage', syncAuth);
    window.addEventListener('focus', syncAuth);
    const keepFreshId = setInterval(keepTokenFresh, 30_000);

    return () => {
      window.removeEventListener('auth-update', syncAuth);
      window.removeEventListener('storage', syncAuth);
      window.removeEventListener('focus', syncAuth);
      clearInterval(keepFreshId);
    };
  }, []);

  // Show loading state while checking auth
  if (isLoggedIn === null) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column' }}>
        <p>Loading...</p>
        <p style={{ fontSize: '12px', color: '#999' }}>Checking authentication status...</p>
      </div>
    );
  }

  return (
    <TimeProvider isLoggedIn={isLoggedIn}>
      <Router>
        <Routes>
          {/* Auth routes - accessible when NOT logged in, redirect to /race if logged in */}
          <Route path="/login" element={
            isLoggedIn ? (
              <PostLoginRedirect />
            ) : (
              <LogOnce message="User accessing login route" data={{ isLoggedIn }}>
                <Login />
              </LogOnce>
            )
          } />

          <Route path="/forgot-password" element={
            isLoggedIn ? (
              <Navigate to="/race" replace />
            ) : (
              <LogOnce message="User accessing forgot-password route" data={{ isLoggedIn }}>
                <ForgotPassword />
              </LogOnce>
            )
          } />

          <Route path="/reset-password" element={
            isLoggedIn ? (
              <Navigate to="/race" replace />
            ) : (
              <LogOnce message="User accessing reset-password route" data={{ isLoggedIn }}>
                <ResetPassword />
              </LogOnce>
            )
          } />

          <Route path="/register/:slug" element={
            <LogOnce message="User accessing public registration route" data={{ isLoggedIn }}>
              <PublicRegistrationPage />
            </LogOnce>
          } />

          {/* Race routes - requires authentication */}
          <Route path="/race" element={
            isLoggedIn ? (
              <LogOnce message="User accessing protected race routes" data={{ isLoggedIn }}>
                <RaceLayout />
              </LogOnce>
            ) : (
              <Navigate to="/login" replace />
            )
          }>
            <Route index element={<ActiveRacePage />} />
            <Route path=":raceId/map" element={
              <LogOnce message="User accessing map page" data={{ isLoggedIn }}>
                <MapPage />
              </LogOnce>
            } />
            <Route path=":raceId/checkpoints" element={
              <LogOnce message="User accessing checkpoints list page" data={{ isLoggedIn }}>
                <CheckpointsPage />
              </LogOnce>
            } />
            <Route path=":raceId/tasks" element={
              <LogOnce message="User accessing tasks page" data={{ isLoggedIn }}>
                <TasksPage />
              </LogOnce>
            } />
            <Route path=":raceId/standings" element={
              <LogOnce message="User accessing standings page" data={{ isLoggedIn }}>
                <StandingsPage />
              </LogOnce>
            } />
          </Route>

          {/* Admin routes - requires authentication */}
          <Route path="/admin" element={
            isLoggedIn ? (
              <LogOnce message="User accessing protected admin routes" data={{ isLoggedIn }}>
                <AdminLayout />
              </LogOnce>
            ) : (
              <Navigate to="/login" replace />
            )
          }>
            <Route index element={<AdminPage />} />
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={
            <LogOnce message="User accessing unknown route, redirecting" data={{ isLoggedIn, redirectTo: isLoggedIn ? "/race" : "/login" }}>
              <Navigate to={isLoggedIn ? "/race" : "/login"} replace />
            </LogOnce>
          } />
        </Routes>
      </Router>
    </TimeProvider>
  );
}

export default App;
