import { render, screen } from '@testing-library/react';
import React from 'react';

import App from './App';
import { isTokenExpired, logoutAndRedirect, refreshAccessToken } from './utils/api';

// Mock the isTokenExpired utility
// A refresh the backend rejected (revoked/expired refresh cookie).
const sessionRejected = vi.hoisted(() => () => Object.assign(new Error('Token refresh failed'), { status: 401, sessionInvalid: true }));

vi.mock('./utils/api', () => ({
  isTokenExpired: vi.fn(),
  parseJwt: vi.fn(),
  logoutAndRedirect: vi.fn(),
  refreshAccessToken: vi.fn().mockRejectedValue(sessionRejected()),
}));

// Mock child components to simplify testing
vi.mock('./components/Login', () => ({ default: () => <div>Login Component</div> }));
vi.mock('./components/ForgotPassword', () => ({ default: () => <div>ForgotPassword Component</div> }));
vi.mock('./components/ResetPassword', () => ({ default: () => <div>ResetPassword Component</div> }));
vi.mock('./components/Layouts/RaceLayout', () => ({ default: () => <div>RaceLayout Component</div> }));
vi.mock('./components/Layouts/AdminLayout', () => ({ default: () => <div>AdminLayout Component</div> }));

describe('App Component - Routing', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('When user is NOT logged in', () => {
    beforeEach(() => {
      localStorage.removeItem('accessToken');
    });

    test('renders Login component at /login route', () => {
      window.history.pushState({}, 'Login', '/login');
      render(<App />);
      expect(screen.getByText('Login Component')).toBeInTheDocument();
    });

    test('renders ForgotPassword component at /forgot-password route', () => {
      window.history.pushState({}, 'Forgot Password', '/forgot-password');
      render(<App />);
      expect(screen.getByText('ForgotPassword Component')).toBeInTheDocument();
    });

    test('renders ResetPassword component at /reset-password route', () => {
      window.history.pushState({}, 'Reset Password', '/reset-password');
      render(<App />);
      expect(screen.getByText('ResetPassword Component')).toBeInTheDocument();
    });

    test('redirects to /login when accessing /race', () => {
      window.history.pushState({}, 'Race', '/race');
      render(<App />);
      expect(screen.getByText('Login Component')).toBeInTheDocument();
    });

    test('redirects to /login when accessing /admin', () => {
      window.history.pushState({}, 'Admin', '/admin');
      render(<App />);
      expect(screen.getByText('Login Component')).toBeInTheDocument();
    });

    test('redirects unknown routes to /login', () => {
      window.history.pushState({}, 'Unknown', '/unknown-route');
      render(<App />);
      expect(screen.getByText('Login Component')).toBeInTheDocument();
    });
  });

  describe('When user IS logged in with valid token', () => {
    beforeEach(() => {
      localStorage.setItem('accessToken', 'valid-token');
      isTokenExpired.mockReturnValue(false);
    });

    test('redirects /login to /race', () => {
      window.history.pushState({}, 'Login', '/login');
      render(<App />);
      expect(screen.getByText('RaceLayout Component')).toBeInTheDocument();
    });

    test('redirects /login to the selected race map when a race is selected', () => {
      localStorage.setItem('activeRace', JSON.stringify({ race_id: 7, name: 'Selected Race' }));
      window.history.pushState({}, 'Login', '/login');
      render(<App />);
      expect(window.location.pathname).toBe('/race/7/map');
    });

    test('redirects /login to race selection when no race is selected', () => {
      window.history.pushState({}, 'Login', '/login');
      render(<App />);
      expect(window.location.pathname).toBe('/race');
    });

    test('renders RaceLayout at /race route', () => {
      window.history.pushState({}, 'Race', '/race');
      render(<App />);
      expect(screen.getByText('RaceLayout Component')).toBeInTheDocument();
    });

    test('renders AdminLayout at /admin route', () => {
      window.history.pushState({}, 'Admin', '/admin');
      render(<App />);
      expect(screen.getByText('AdminLayout Component')).toBeInTheDocument();
    });

    test('redirects unknown routes to /race', () => {
      window.history.pushState({}, 'Unknown', '/unknown-route');
      render(<App />);
      expect(screen.getByText('RaceLayout Component')).toBeInTheDocument();
    });
  });

  describe('When user has EXPIRED token', () => {
    beforeEach(() => {
      localStorage.setItem('accessToken', 'expired-token');
      isTokenExpired.mockReturnValue(true);
    });

    test('treats user as logged out and shows login page', async () => {
      window.history.pushState({}, 'Login', '/login');
      render(<App />);
      expect(await screen.findByText('Login Component')).toBeInTheDocument();
    });

    test('redirects protected routes to login', async () => {
      window.history.pushState({}, 'Race', '/race');
      render(<App />);
      expect(await screen.findByText('Login Component')).toBeInTheDocument();
    });

    test('stays logged in when the refresh fails for a non-auth reason', async () => {
      // e.g. the request was aborted by a reload or the network dropped
      refreshAccessToken.mockRejectedValueOnce(new TypeError('Failed to fetch'));
      window.history.pushState({}, 'Race', '/race');
      render(<App />);
      expect(await screen.findByText('RaceLayout Component')).toBeInTheDocument();
    });
  });

  describe('Proactive token refresh', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
      isTokenExpired.mockReset();
      refreshAccessToken.mockRejectedValue(sessionRejected());
    });

    test('refreshes instead of logging out when the token is about to expire', async () => {
      localStorage.setItem('accessToken', 'nearly-expired-token');
      // Still valid for the auth check, but within the 120s refresh margin.
      isTokenExpired.mockImplementation((_token, margin) => margin === 120);
      refreshAccessToken.mockResolvedValue('fresh-token');

      window.history.pushState({}, 'Race', '/race');
      render(<App />);
      expect(screen.getByText('RaceLayout Component')).toBeInTheDocument();
      expect(refreshAccessToken).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(30_000);

      expect(refreshAccessToken).toHaveBeenCalledTimes(1);
      expect(logoutAndRedirect).not.toHaveBeenCalled();
      expect(screen.getByText('RaceLayout Component')).toBeInTheDocument();
    });

    test('does not refresh when the token is not close to expiry', async () => {
      localStorage.setItem('accessToken', 'valid-token');
      isTokenExpired.mockReturnValue(false);

      window.history.pushState({}, 'Race', '/race');
      render(<App />);
      await vi.advanceTimersByTimeAsync(90_000);

      expect(refreshAccessToken).not.toHaveBeenCalled();
    });

    test('does not refresh when there is no token', async () => {
      isTokenExpired.mockReturnValue(true);

      window.history.pushState({}, 'Login', '/login');
      render(<App />);
      await vi.advanceTimersByTimeAsync(90_000);

      expect(refreshAccessToken).not.toHaveBeenCalled();
    });
  });

  describe('Token validation edge cases', () => {
    test('treats null token as logged out', () => {
      localStorage.removeItem('accessToken');
      isTokenExpired.mockReturnValue(true);
      window.history.pushState({}, 'Race', '/race');
      render(<App />);
      expect(screen.getByText('Login Component')).toBeInTheDocument();
    });

    test('treats empty string token as logged out', () => {
      localStorage.setItem('accessToken', '');
      window.history.pushState({}, 'Race', '/race');
      render(<App />);
      expect(screen.getByText('Login Component')).toBeInTheDocument();
    });
  });
});
