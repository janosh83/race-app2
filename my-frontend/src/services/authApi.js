import { apiFetch } from '../utils/api';
import { logger } from '../utils/logger';

export const authApi = {
  // Login with email and password
  login: (email, password) => {
    logger.info('AUTH', 'Login attempt', { email });
    return apiFetch('/auth/login/', {
      method: 'POST',
      body: { email, password },
      noAuth: true,
      noRedirectOnAuthFailure: true,
    }).then(result => {
      logger.success('AUTH', 'Login successful', { email });
      return result;
    }).catch(err => {
      logger.error('AUTH', 'Login failed', err.message);
      throw err;
    });
  },

  // Register a new user
  register: (email, password, name, isAdministrator = false) => {
    logger.info('AUTH', 'Registration attempt', { email, name });
    return apiFetch('/auth/register/', {
      method: 'POST',
      body: { email, password, name, is_administrator: isAdministrator },
      noAuth: true,
      noRedirectOnAuthFailure: true,
    }).then(result => {
      logger.success('AUTH', 'Registration successful', { email });
      return result;
    }).catch(err => {
      logger.error('AUTH', 'Registration failed', err.message);
      throw err;
    });
  },

  // Request password reset email
  requestPasswordReset: (email) => {
    logger.info('AUTH', 'Password reset requested', { email });
    return apiFetch('/auth/request-password-reset/', {
      method: 'POST',
      body: { email },
      noAuth: true,
      noRedirectOnAuthFailure: true,
    }).then(result => {
      logger.success('AUTH', 'Password reset email sent', { email });
      return result;
    }).catch(err => {
      logger.error('AUTH', 'Password reset request failed', err.message);
      throw err;
    });
  },

  // Reset password with token
  resetPassword: (token, newPassword) => {
    logger.info('AUTH', 'Password reset with token');
    return apiFetch('/auth/reset-password/', {
      method: 'POST',
      body: { token, new_password: newPassword },
      noAuth: true,
      noRedirectOnAuthFailure: true,
    }).then(result => {
      logger.success('AUTH', 'Password reset successful');
      return result;
    }).catch(err => {
      logger.error('AUTH', 'Password reset failed', err.message);
      throw err;
    });
  },

  // Get signed races for current user
  getSignedRaces: () => {
    logger.info('AUTH', 'Fetching signed races');
    return apiFetch('/api/user/signed-races/').then(result => {
      logger.success('AUTH', 'Signed races fetched', { count: result?.length || 0 });
      return result;
    }).catch(err => {
      logger.error('AUTH', 'Failed to fetch signed races', err.message);
      throw err;
    });
  }
};
