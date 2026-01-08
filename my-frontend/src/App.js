import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ActiveRacePage from './components/Pages/ActiveRacePage';
import AdminLayout from './components/Layouts/AdminLayout';
import AdminPage from './components/Pages/AdminPage';
import ForgotPassword from './components/ForgotPassword';
import Login from './components/Login';
import MapPage from './components/Pages/MapPage';
import RaceLayout from './components/Layouts/RaceLayout';
import ResetPassword from './components/ResetPassword';
import StandingsPage from './components/Pages/StandingsPage';
import TasksPage from './components/Pages/TasksPage';
import { TimeProvider } from './contexts/TimeContext';
import { isTokenExpired } from './utils/api';
import { logger } from './utils/logger';

// Logs once on mount to avoid side effects during render
const LogOnce = ({ message, data, children }) => {
  useEffect(() => {
    logger.info('ROUTING', message, data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return children;
};

function App() {
  const token = localStorage.getItem('accessToken');
  const isLoggedIn = token && !isTokenExpired(token);

  useEffect(() => {
    logger.info('ROUTING', 'App initialized', { isLoggedIn, hasToken: !!token, tokenExpired: token ? isTokenExpired(token) : 'no-token' });
  }, [isLoggedIn, token]);
  
  return (
    <TimeProvider>
      <Router>
        <Routes>
          {/* Auth routes (public) */}
          <Route path="/login" element={!isLoggedIn ? (
            <LogOnce message="User accessing login route" data={{ isLoggedIn }}>
              <Login />
            </LogOnce>
          ) : (
            <LogOnce message="User already logged in, redirecting from login to /race" data={{ isLoggedIn }}>
              <Navigate to="/race" />
            </LogOnce>
          )} />
          <Route path="/forgot-password" element={!isLoggedIn ? (
            <LogOnce message="User accessing forgot-password route" data={{ isLoggedIn }}>
              <ForgotPassword />
            </LogOnce>
          ) : (
            <LogOnce message="User already logged in, redirecting from forgot-password to /race" data={{ isLoggedIn }}>
              <Navigate to="/race" />
            </LogOnce>
          )} />
          <Route path="/reset-password" element={!isLoggedIn ? (
            <LogOnce message="User accessing reset-password route" data={{ isLoggedIn }}>
              <ResetPassword />
            </LogOnce>
          ) : (
            <LogOnce message="User already logged in, redirecting from reset-password to /race" data={{ isLoggedIn }}>
              <Navigate to="/race" />
            </LogOnce>
          )} />

          {/* Race routes (protected) */}
          <Route path="/race" element={isLoggedIn ? (
            <LogOnce message="User accessing protected race routes" data={{ isLoggedIn }}>
              <RaceLayout />
            </LogOnce>
          ) : (
            <LogOnce message="User not logged in, redirecting to login" data={{ isLoggedIn }}>
              <Navigate to="/login" />
            </LogOnce>
          )}>
            <Route index element={<ActiveRacePage />} />
            <Route path=":raceId/map" element={
              <LogOnce message="User accessing map page" data={{ isLoggedIn }}>
                <MapPage />
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

          {/* Admin routes (protected) */}
          <Route path="/admin" element={isLoggedIn ? (
            <LogOnce message="User accessing protected admin routes" data={{ isLoggedIn }}>
              <AdminLayout />
            </LogOnce>
          ) : (
            <LogOnce message="User not logged in, redirecting to login" data={{ isLoggedIn }}>
              <Navigate to="/login" />
            </LogOnce>
          )}>
            <Route index element={<AdminPage />} />
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={
            <LogOnce message="User accessing unknown route, redirecting" data={{ isLoggedIn, redirectTo: isLoggedIn ? "/race" : "/login" }}>
              <Navigate to={isLoggedIn ? "/race" : "/login"} />
            </LogOnce>
          } />
        </Routes>
      </Router>
    </TimeProvider>
  );
}

export default App;
