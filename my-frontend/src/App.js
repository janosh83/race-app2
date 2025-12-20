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

function App() {
  const isLoggedIn = !!localStorage.getItem('accessToken');
  
  return (
    <TimeProvider>
      <Router>
        <Routes>
          {/* Auth routes (public) */}
          <Route path="/login" element={!isLoggedIn ? <Login /> : <Navigate to="/race" />} />
          <Route path="/forgot-password" element={!isLoggedIn ? <ForgotPassword /> : <Navigate to="/race" />} />
          <Route path="/reset-password" element={!isLoggedIn ? <ResetPassword /> : <Navigate to="/race" />} />

          {/* Race routes (protected) */}
          <Route path="/race" element={isLoggedIn ? <RaceLayout /> : <Navigate to="/login" />}>
            <Route index element={<ActiveRacePage />} />
            <Route path=":raceId/map" element={<MapPage />} />
            <Route path=":raceId/tasks" element={<TasksPage />} />
            <Route path="standings" element={<StandingsPage />} />
          </Route>

          {/* Admin routes (protected) */}
          <Route path="/admin" element={isLoggedIn ? <AdminLayout /> : <Navigate to="/login" />}>
            <Route index element={<AdminPage />} />
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to={isLoggedIn ? "/race" : "/login"} />} />
        </Routes>
      </Router>
    </TimeProvider>
  );
}

export default App;
