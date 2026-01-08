import React from 'react';
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

function App() {
  const token = localStorage.getItem('accessToken');
  const isLoggedIn = token && !isTokenExpired(token);
  
  logger.info('ROUTING', 'App initialized', { isLoggedIn, hasToken: !!token, tokenExpired: token ? isTokenExpired(token) : 'no-token' });
  
  return (
    <TimeProvider>
      <Router>
        <Routes>
          {/* Auth routes (public) */}
          <Route path="/login" element={!isLoggedIn ? (
            <>
              {logger.info('ROUTING', 'User accessing login route', { isLoggedIn })}
              <Login />
            </>
          ) : (
            <>
              {logger.info('ROUTING', 'User already logged in, redirecting from login to /race')}
              <Navigate to="/race" />
            </>
          )} />
          <Route path="/forgot-password" element={!isLoggedIn ? (
            <>
              {logger.info('ROUTING', 'User accessing forgot-password route', { isLoggedIn })}
              <ForgotPassword />
            </>
          ) : (
            <>
              {logger.info('ROUTING', 'User already logged in, redirecting from forgot-password to /race')}
              <Navigate to="/race" />
            </>
          )} />
          <Route path="/reset-password" element={!isLoggedIn ? (
            <>
              {logger.info('ROUTING', 'User accessing reset-password route', { isLoggedIn })}
              <ResetPassword />
            </>
          ) : (
            <>
              {logger.info('ROUTING', 'User already logged in, redirecting from reset-password to /race')}
              <Navigate to="/race" />
            </>
          )} />

          {/* Race routes (protected) */}
          <Route path="/race" element={isLoggedIn ? (
            <>
              {logger.info('ROUTING', 'User accessing protected race routes', { isLoggedIn })}
              <RaceLayout />
            </>
          ) : (
            <>
              {logger.info('ROUTING', 'User not logged in, redirecting to login')}
              <Navigate to="/login" />
            </>
          )}>
            <Route index element={<ActiveRacePage />} />
            <Route path=":raceId/map" element={
              <>
                {logger.info('ROUTING', 'User accessing map page')}
                <MapPage />
              </>
            } />
            <Route path=":raceId/tasks" element={
              <>
                {logger.info('ROUTING', 'User accessing tasks page')}
                <TasksPage />
              </>
            } />
            <Route path=":raceId/standings" element={
              <>
                {logger.info('ROUTING', 'User accessing standings page')}
                <StandingsPage />
              </>
            } />
          </Route>

          {/* Admin routes (protected) */}
          <Route path="/admin" element={isLoggedIn ? (
            <>
              {logger.info('ROUTING', 'User accessing protected admin routes', { isLoggedIn })}
              <AdminLayout />
            </>
          ) : (
            <>
              {logger.info('ROUTING', 'User not logged in, redirecting to login')}
              <Navigate to="/login" />
            </>
          )}>
            <Route index element={<AdminPage />} />
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={
            <>
              {logger.info('ROUTING', 'User accessing unknown route, redirecting', { isLoggedIn, redirectTo: isLoggedIn ? "/race" : "/login" })}
              <Navigate to={isLoggedIn ? "/race" : "/login"} />
            </>
          } />
        </Routes>
      </Router>
    </TimeProvider>
  );
}

export default App;
