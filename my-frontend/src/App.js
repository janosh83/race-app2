import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import MainPage from './components/MainPage';
import { TimeProvider } from './contexts/TimeContext';

function App() {
  const isLoggedIn = !!localStorage.getItem('accessToken');
  
  return (
    <TimeProvider>
      <Router>
        <Routes>
          <Route path="/login" element={!isLoggedIn ? <Login /> : <Navigate to="/" />} />
          <Route path="/forgot-password" element={!isLoggedIn ? <ForgotPassword /> : <Navigate to="/" />} />
          <Route path="/reset-password" element={!isLoggedIn ? <ResetPassword /> : <Navigate to="/" />} />
          <Route path="/*" element={isLoggedIn ? <MainPage /> : <Navigate to="/login" />} />
        </Routes>
      </Router>
    </TimeProvider>
  );
}

export default App;