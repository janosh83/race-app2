import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ActiveRacePage from './components/Pages/ActiveRacePage';
import AdminLayout from './components/Layouts/AdminLayout';
import AdminPage from './components/Pages/AdminPage';
import ForgotPassword from './components/ForgotPassword';
import Login from './components/Login';
import MapPage from './components/Pages/MapPage';
import ProtectedRoute from './components/ProtectedRoute';
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
  const [isLoggedIn, setIsLoggedIn] = useState(null); // null = checking, true/false = determined

  useEffect(() => {
    // Check authentication status
    console.log('[AUTH] Starting auth check...');
    logger.info('ROUTING', 'Starting auth check');
    
    const token = localStorage.getItem('accessToken');
    console.log('[AUTH] Token retrieved:', { hasToken: !!token, tokenLength: token?.length });
    logger.info('ROUTING', 'Token retrieved', { hasToken: !!token });
    
    const isExpired = token ? isTokenExpired(token) : true;
    console.log('[AUTH] Token expiry check:', { isExpired, hasToken: !!token });
    logger.info('ROUTING', 'Token expiry check', { isExpired });
    
    const loggedIn = token && !isExpired;
    console.log('[AUTH] Auth check complete:', { isLoggedIn: loggedIn, hasToken: !!token, isExpired });
    logger.info('ROUTING', 'Auth check complete', { isLoggedIn: loggedIn, hasToken: !!token, isExpired });
    
    setIsLoggedIn(loggedIn);
    console.log('[AUTH] isLoggedIn state updated to:', loggedIn);
  }, []);
  
  // Show loading state while checking auth
  if (isLoggedIn === null) {
    console.log('[APP] Rendering loading state - auth check not complete yet');
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column' }}>
        <p>Loading...</p>
        <p style={{ fontSize: '12px', color: '#999' }}>Checking authentication status...</p>
      </div>
    );
  }
  
  console.log('[APP] Auth check complete, rendering routes with isLoggedIn:', isLoggedIn);
  
  return (
    <TimeProvider>
      <Router>
        <Routes>
          {/* Auth routes - accessible when NOT logged in, redirect to /race if logged in */}
          <Route path="/login" element={
            isLoggedIn ? (
              <Navigate to="/race" replace />
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
