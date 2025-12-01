import React from 'react';
import Login from './components/Login';
import MainPage from './components/MainPage';
import { TimeProvider } from './contexts/TimeContext';

function App() {
  const isLoggedIn = !!localStorage.getItem('accessToken');
  // wrap the app in TimeProvider so components can access active race/time info
  return (
    <TimeProvider>
      {isLoggedIn ? <MainPage /> : <Login />}
    </TimeProvider>
  );
}

export default App;