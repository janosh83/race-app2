import { vi } from 'vitest';
import { apiFetch, parseJwt, isTokenExpired, logoutAndRedirect } from './api';

describe('API Utilities', () => {
  describe('parseJwt', () => {
    test('parses valid JWT token', () => {
      // This is a sample JWT with payload: {"sub":"1234567890","name":"Test User","exp":9999999999}
      const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IlRlc3QgVXNlciIsImV4cCI6OTk5OTk5OTk5OX0.N_rH8Q-mhxGw0TvLPE_RJBP5Y-4Yqd3DcJvE5xwX7jE';
      const payload = parseJwt(validToken);

      expect(payload).toEqual({
        sub: '1234567890',
        name: 'Test User',
        exp: 9999999999
      });
    });

    test('returns null for invalid token format', () => {
      expect(parseJwt('invalid-token')).toBeNull();
      expect(parseJwt('only.two')).toBeNull();
      expect(parseJwt('')).toBeNull();
    });

    test('returns null for null token', () => {
      expect(parseJwt(null)).toBeNull();
    });

    test('returns null for undefined token', () => {
      expect(parseJwt(undefined)).toBeNull();
    });
  });

  describe('isTokenExpired', () => {
    test('returns true for expired token', () => {
      const pastExp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const expiredToken = `header.${btoa(JSON.stringify({ exp: pastExp }))}.signature`;

      expect(isTokenExpired(expiredToken)).toBe(true);
    });

    test('returns false for valid non-expired token', () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const validToken = `header.${btoa(JSON.stringify({ exp: futureExp }))}.signature`;

      expect(isTokenExpired(validToken)).toBe(false);
    });

    test('respects margin parameter', () => {
      const exp = Math.floor(Date.now() / 1000) + 5; // 5 seconds from now
      const token = `header.${btoa(JSON.stringify({ exp }))}.signature`;

      // With 10 second margin, should be considered expired
      expect(isTokenExpired(token, 10)).toBe(true);

      // With 1 second margin, should not be expired
      expect(isTokenExpired(token, 1)).toBe(false);
    });

    test('returns true for token without exp claim', () => {
      const tokenNoExp = `header.${btoa(JSON.stringify({ sub: '123' }))}.signature`;
      expect(isTokenExpired(tokenNoExp)).toBe(true);
    });

    test('returns true for null token', () => {
      expect(isTokenExpired(null)).toBe(true);
    });

    test('returns true for malformed token', () => {
      expect(isTokenExpired('malformed')).toBe(true);
    });
  });

  describe('apiFetch', () => {
    beforeEach(() => {
      localStorage.clear();
      sessionStorage.clear();
      global.fetch = vi.fn();
      const futureExp = Math.floor(Date.now() / 1000) + 3600;
      const validToken = `header.${btoa(JSON.stringify({ exp: futureExp }))}.signature`;
      localStorage.setItem('accessToken', validToken);
    });

    test('retries a single 401 with refresh instead of logging out immediately', async () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600;
      const freshToken = `header.${btoa(JSON.stringify({ exp: futureExp }))}.signature`;

      const refreshResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ access_token: freshToken }),
      };
      const retryResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ ok: true }),
      };
      const unauthorizedResponse = {
        ok: false,
        status: 401,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ message: 'Unauthorized' }),
      };

      let callCount = 0;
      global.fetch.mockImplementation(() => {
        callCount += 1;
        if (callCount === 1) return Promise.resolve(unauthorizedResponse);
        if (callCount === 2) return Promise.resolve(refreshResponse);
        return Promise.resolve(retryResponse);
      });

      const result = await apiFetch('/api/test');

      expect(result).toEqual({ ok: true });
      const requestUrls = global.fetch.mock.calls.map(([url]) => String(url));
      expect(requestUrls.filter((url) => url.includes('/auth/refresh/')).length).toBe(1);
      expect(requestUrls.filter((url) => url.includes('/api/test')).length).toBeGreaterThanOrEqual(2);
      expect(localStorage.getItem('accessToken')).toBe(freshToken);
    });
  });

  describe('logoutAndRedirect', () => {
    beforeEach(() => {
      localStorage.clear();
      localStorage.setItem('accessToken', 'token');
      localStorage.setItem('refreshToken', 'refresh');
      localStorage.setItem('user', '{"id":1}');
      localStorage.setItem('signedRaces', '[]');
      localStorage.setItem('activeRace', '{"id":1}');
      localStorage.setItem('activeSection', 'map');
      sessionStorage.clear();

      delete window.location;
      window.location = {
        href: 'http://localhost/',
        pathname: '/',
      };
    });

    test('clears all localStorage items', () => {
      logoutAndRedirect();

      expect(localStorage.getItem('accessToken')).toBeNull();
      expect(localStorage.getItem('refreshToken')).toBeNull();
      expect(localStorage.getItem('user')).toBeNull();
      expect(localStorage.getItem('signedRaces')).toBeNull();
      expect(localStorage.getItem('activeRace')).toBeNull();
      expect(localStorage.getItem('activeSection')).toBeNull();
    });

    test('redirects to / by default (React Router handles /login redirect)', () => {
      logoutAndRedirect();
      expect(window.location.href).toBe('/');
    });

    test('removes any stale refresh token from localStorage during logout', () => {
      logoutAndRedirect();
      expect(localStorage.getItem('refreshToken')).toBeNull();
    });

    test('always redirects to / (ignores custom path parameter)', () => {
      logoutAndRedirect('/custom-login');
      expect(window.location.href).toBe('/');
    });

    test('does not redirect again if already on login page', () => {
      window.location = {
        href: 'http://localhost/login',
        pathname: '/login',
      };
      logoutAndRedirect();
      expect(window.location.pathname).toBe('/login');
      expect(localStorage.getItem('accessToken')).toBeNull();
    });
  });
});
