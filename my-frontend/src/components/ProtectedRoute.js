import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { isTokenExpired } from '../utils/api';
import { logger } from '../utils/logger';

/**
 * ProtectedRoute wrapper for routes that require authentication
 * @param {React.ReactNode} children - The component to render if authenticated
 * @param {string} redirectTo - Path to redirect to if not authenticated (default: /login)
 */
function ProtectedRoute({ children, redirectTo = '/login' }) {
  const token = localStorage.getItem('accessToken');
  const isLoggedIn = token && !isTokenExpired(token);

  useEffect(() => {
    if (!isLoggedIn) {
      logger.warn('ROUTING', 'User not authenticated, should redirect', { redirectTo });
    }
  }, [isLoggedIn, redirectTo]);

  if (!isLoggedIn) {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
}

export default ProtectedRoute;
