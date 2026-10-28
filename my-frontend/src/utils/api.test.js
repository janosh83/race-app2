import { vi } from 'vitest';
import { apiFetch, fetchRaw, parseJwt, isTokenExpired, logoutAndRedirect, refreshAccessToken } from './api';

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

    test('returns 403 to the caller without refreshing or logging out', async () => {
      const token = localStorage.getItem('accessToken');
      global.fetch.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ message: 'Logging for this race is not allowed at this time.' }),
      });

      await expect(apiFetch('/api/race/1/checkpoints/log/', { method: 'POST', body: {} })).rejects.toMatchObject({
        status: 403,
        message: 'Logging for this race is not allowed at this time.',
      });

      const requestUrls = global.fetch.mock.calls.map(([url]) => String(url));
      expect(requestUrls.filter((url) => url.includes('/auth/refresh/')).length).toBe(0);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem('accessToken')).toBe(token);
    });
  });

  describe('refreshAccessToken failures', () => {
    const logoutCalls = () => global.fetch.mock.calls.filter(([url]) => String(url).includes('/auth/logout/'));

    beforeEach(() => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('accessToken', 'header.e30.sig');
      global.fetch = vi.fn();
      delete window.location;
      window.location = { href: 'http://localhost/race', pathname: '/race' };
    });

    test.each([401, 422])('logs out when the backend rejects the refresh cookie (%i)', async (status) => {
      global.fetch.mockImplementation((url) => Promise.resolve(
        String(url).includes('/auth/refresh/') ? { ok: false, status } : { ok: true, status: 200 }
      ));

      await expect(refreshAccessToken()).rejects.toMatchObject({ status, sessionInvalid: true });

      expect(logoutCalls()).toHaveLength(1);
      expect(localStorage.getItem('accessToken')).toBeNull();
    });

    test('keeps the session on a server error', async () => {
      global.fetch.mockResolvedValue({ ok: false, status: 503 });

      await expect(refreshAccessToken()).rejects.toMatchObject({ status: 503, sessionInvalid: false });

      expect(logoutCalls()).toHaveLength(0);
      expect(localStorage.getItem('accessToken')).toBe('header.e30.sig');
    });

    test('keeps the session when the request fails or is aborted (e.g. tab reload)', async () => {
      global.fetch.mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(refreshAccessToken()).rejects.toThrow('Failed to fetch');

      expect(logoutCalls()).toHaveLength(0);
      expect(localStorage.getItem('accessToken')).toBe('header.e30.sig');
    });

    test('fetchRaw passes a network failure during refresh to the caller without logging out', async () => {
      const expired = `header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) - 60 }))}.signature`;
      localStorage.setItem('accessToken', expired);
      global.fetch.mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(fetchRaw('/api/race/1/checkpoints/log/', { method: 'POST', body: new FormData() }))
        .rejects.toThrow('Failed to fetch');

      expect(logoutCalls()).toHaveLength(0);
      expect(localStorage.getItem('accessToken')).toBe(expired);
    });
  });

  describe('refreshAccessToken cross-tab lock', () => {
    const makeToken = (expOffsetSeconds) =>
      `header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expOffsetSeconds }))}.signature`;
    const refreshResponse = (accessToken) => ({
      ok: true,
      status: 200,
      json: async () => ({ access_token: accessToken }),
    });

    beforeEach(() => {
      localStorage.clear();
      sessionStorage.clear();
      global.fetch = vi.fn();
    });

    afterEach(() => {
      delete navigator.locks;
    });

    test('refreshes under a named Web Lock', async () => {
      const request = vi.fn((_name, callback) => callback());
      Object.defineProperty(navigator, 'locks', { value: { request }, configurable: true });
      localStorage.setItem('accessToken', makeToken(30));
      const fresh = makeToken(1800);
      global.fetch.mockResolvedValue(refreshResponse(fresh));

      await expect(refreshAccessToken()).resolves.toBe(fresh);

      expect(request).toHaveBeenCalledWith('race-app-token-refresh', expect.any(Function));
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem('accessToken')).toBe(fresh);
    });

    test('reuses a token another tab refreshed while waiting for the lock', async () => {
      const refreshedByOtherTab = makeToken(1800);
      const request = vi.fn((_name, callback) => {
        // Simulate the other tab finishing its refresh before we get the lock.
        localStorage.setItem('accessToken', refreshedByOtherTab);
        return callback();
      });
      Object.defineProperty(navigator, 'locks', { value: { request }, configurable: true });
      localStorage.setItem('accessToken', makeToken(30));

      await expect(refreshAccessToken()).resolves.toBe(refreshedByOtherTab);
      expect(global.fetch).not.toHaveBeenCalled();

      // The in-flight promise must be cleared so a later refresh hits the server.
      const later = makeToken(3600);
      localStorage.setItem('accessToken', makeToken(30));
      Object.defineProperty(navigator, 'locks', { value: { request: (_n, cb) => cb() }, configurable: true });
      global.fetch.mockResolvedValue(refreshResponse(later));
      await expect(refreshAccessToken()).resolves.toBe(later);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    test('refreshes again when the token in storage is unchanged', async () => {
      const request = vi.fn((_name, callback) => callback());
      Object.defineProperty(navigator, 'locks', { value: { request }, configurable: true });
      localStorage.setItem('accessToken', makeToken(1800)); // e.g. rejected by the server despite not being expired
      const fresh = makeToken(3600);
      global.fetch.mockResolvedValue(refreshResponse(fresh));

      await expect(refreshAccessToken()).resolves.toBe(fresh);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    test('falls back to an unlocked refresh without Web Locks support', async () => {
      localStorage.setItem('accessToken', makeToken(30));
      const fresh = makeToken(1800);
      global.fetch.mockResolvedValue(refreshResponse(fresh));

      const [a, b] = await Promise.all([refreshAccessToken(), refreshAccessToken()]);

      expect(a).toBe(fresh);
      expect(b).toBe(fresh);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('fetchRaw', () => {
    beforeEach(() => {
      localStorage.clear();
      sessionStorage.clear();
      global.fetch = vi.fn();
      const futureExp = Math.floor(Date.now() / 1000) + 3600;
      localStorage.setItem('accessToken', `header.${btoa(JSON.stringify({ exp: futureExp }))}.signature`);
    });

    test('returns a 403 response without refreshing, retrying or logging out', async () => {
      const token = localStorage.getItem('accessToken');
      const forbidden = { ok: false, status: 403, headers: new Headers() };
      global.fetch.mockResolvedValue(forbidden);

      const res = await fetchRaw('/api/race/1/checkpoints/log/', { method: 'POST', body: new FormData() });

      expect(res).toBe(forbidden);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem('accessToken')).toBe(token);
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
      global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });

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

    test('revokes the server session so the refresh cookie is cleared', () => {
      logoutAndRedirect();

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [url, init] = global.fetch.mock.calls[0];
      expect(String(url)).toContain('/auth/logout/');
      expect(init).toMatchObject({ method: 'POST', credentials: 'include', keepalive: true });
    });

    test('revokes the server session even when already on an auth screen', () => {
      window.location = {
        href: 'http://localhost/login',
        pathname: '/login',
      };
      logoutAndRedirect();

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(String(global.fetch.mock.calls[0][0])).toContain('/auth/logout/');
    });

    test('still clears local state when the server logout request fails', () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('offline'));
      logoutAndRedirect();

      expect(localStorage.getItem('accessToken')).toBeNull();
      expect(window.location.href).toBe('/');
    });

    test('clears stale redirect locks so a new logout can proceed', () => {
      sessionStorage.setItem('auth_redirect_in_progress', JSON.stringify({ timestamp: Date.now() - 60000 }));
      logoutAndRedirect();

      const lock = sessionStorage.getItem('auth_redirect_in_progress');
      expect(lock).not.toBeNull();
      expect(() => JSON.parse(lock)).not.toThrow();
      const parsed = JSON.parse(lock);
      expect(parsed.timestamp).toBeGreaterThan(Date.now() - 15000);
    });
  });
});
