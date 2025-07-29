import React from 'react';
import Login from './components/Login';
import MainPage from './components/MainPage';

function App() {
  const isLoggedIn = !!localStorage.getItem('accessToken');
  return isLoggedIn ? <MainPage /> : <Login />;
}

export default App;