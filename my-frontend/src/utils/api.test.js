import { parseJwt, isTokenExpired, logoutAndRedirect } from './api';

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

  describe('logoutAndRedirect', () => {
    beforeEach(() => {
      localStorage.clear();
      localStorage.setItem('accessToken', 'token');
      localStorage.setItem('refreshToken', 'refresh');
      localStorage.setItem('user', '{"id":1}');
      localStorage.setItem('signedRaces', '[]');
      localStorage.setItem('activeRace', '{"id":1}');
      localStorage.setItem('activeSection', 'map');
      
      delete window.location;
      window.location = { href: '' };
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

    test('always redirects to / (ignores custom path parameter)', () => {
      logoutAndRedirect('/custom-login');
      expect(window.location.href).toBe('/');
    });
  });
});
