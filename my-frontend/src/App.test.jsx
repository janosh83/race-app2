import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';
import { isTokenExpired } from './utils/api';

// Mock the isTokenExpired utility
vi.mock('./utils/api', () => ({
  isTokenExpired: vi.fn(),
  parseJwt: vi.fn(),
  logoutAndRedirect: vi.fn(),
}));

// Mock child components to simplify testing
vi.mock('./components/Login', () => () => <div>Login Component</div>);
vi.mock('./components/ForgotPassword', () => () => <div>ForgotPassword Component</div>);
vi.mock('./components/ResetPassword', () => () => <div>ResetPassword Component</div>);
vi.mock('./components/Layouts/RaceLayout', () => () => <div>RaceLayout Component</div>);
vi.mock('./components/Layouts/AdminLayout', () => () => <div>AdminLayout Component</div>);

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

    test('treats user as logged out and shows login page', () => {
      window.history.pushState({}, 'Login', '/login');
      render(<App />);
      expect(screen.getByText('Login Component')).toBeInTheDocument();
    });

    test('redirects protected routes to login', () => {
      window.history.pushState({}, 'Race', '/race');
      render(<App />);
      expect(screen.getByText('Login Component')).toBeInTheDocument();
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
