import { apiFetch } from '../utils/api';

export const authApi = {
  // Login with email and password
  login: (email, password) => 
    apiFetch('/auth/login/', {
      method: 'POST',
      body: { email, password },
      noAuth: true,
      noRedirectOnAuthFailure: true,
    }),

  // Register a new user
  register: (email, password, name, isAdministrator = false) =>
    apiFetch('/auth/register/', {
      method: 'POST',
      body: { email, password, name, is_administrator: isAdministrator },
      noAuth: true,
      noRedirectOnAuthFailure: true,
    }),

  // Request password reset email
  requestPasswordReset: (email) =>
    apiFetch('/auth/request-password-reset/', {
      method: 'POST',
      body: { email },
      noAuth: true,
      noRedirectOnAuthFailure: true,
    }),

  // Reset password with token
  resetPassword: (token, newPassword) =>
    apiFetch('/auth/reset-password/', {
      method: 'POST',
      body: { token, new_password: newPassword },
      noAuth: true,
      noRedirectOnAuthFailure: true,
    }),

  // Get signed races for current user
  getSignedRaces: () => apiFetch('/api/user/signed-races/')
};
