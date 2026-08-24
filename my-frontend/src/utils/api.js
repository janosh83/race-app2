/**
 * Merged auth + api helpers:
 * - parseJwt, isTokenExpired, logoutAndRedirect (from auth.js)
 * - fetchRaw (low-level wrapper that returns Response, similar to old auth.apiFetch)
 * - apiFetch (high-level wrapper that returns parsed JSON and throws on non-ok)
 */

import { logger } from './logger';

const BASE = import.meta.env.VITE_API_URL || '';

/* ---------- auth helpers ---------- */
export function parseJwt(token) {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload;
  } catch {
    return null;
  }
}

export function isTokenExpired(token, marginSeconds = 10) {
  const payload = parseJwt(token);
  if (!payload || !payload.exp) return true;
  const expMs = payload.exp * 1000;
  return Date.now() > (expMs - marginSeconds * 1000);
}

export function logoutAndRedirect(_loginPath = '/login') {
  const safeAuthPaths = new Set(['/login', '/forgot-password', '/reset-password']);
  const finalTarget = '/';

  let currentPath = '/';
  try {
    if (window.location) {
      if (typeof window.location.pathname === 'string' && window.location.pathname) {
        currentPath = window.location.pathname;
      } else if (typeof window.location.href === 'string' && window.location.href) {
        currentPath = new URL(window.location.href, 'http://localhost').pathname;
      }
    }
  } catch {
    currentPath = '/';
  }

  try {
    if (safeAuthPaths.has(currentPath)) {
      logger.info('AUTH', 'Skipping logout redirect because user is already on an auth screen', { currentPath, targetPath: finalTarget });
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      localStorage.removeItem('signedRaces');
      localStorage.removeItem('activeRace');
      localStorage.removeItem('activeSection');
      try {
        sessionStorage.removeItem('auth_redirect_in_progress');
        sessionStorage.removeItem('initialLoad');
      } catch {
        void 0;
      }
      try {
        window.dispatchEvent(new Event('auth-update'));
      } catch {
        void 0;
      }
      return;
    }

    const redirectKey = 'auth_redirect_in_progress';
    const redirectLockTtlMs = 15000;
    const rawLock = sessionStorage.getItem(redirectKey);

    if (rawLock) {
      try {
        const parsedLock = rawLock === '1' ? { timestamp: Date.now() } : JSON.parse(rawLock);
        const ageMs = Date.now() - Number(parsedLock?.timestamp || Date.now());
        if (ageMs < redirectLockTtlMs) {
          logger.info('AUTH', 'Skipping duplicate logout redirect', { currentPath, targetPath: finalTarget, ageMs });
          return;
        }
      } catch {
        void 0;
      }
      sessionStorage.removeItem(redirectKey);
    }

    sessionStorage.setItem(redirectKey, JSON.stringify({ timestamp: Date.now() }));
  } catch {
    void 0;
  }

  logger.info('AUTH', 'Logging out and redirecting to login', { targetPath: finalTarget });
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  localStorage.removeItem('signedRaces');
  localStorage.removeItem('activeRace');
  localStorage.removeItem('activeSection');
  try {
    sessionStorage.removeItem('initialLoad');
  } catch {
    void 0;
  }
  try {
    window.dispatchEvent(new Event('auth-update'));
  } catch {
    void 0;
  }

  try {
    if (window.location && typeof window.location.href === 'string') {
      window.location.href = finalTarget;
    }
  } catch {
    void 0;
  }
}

/* ---------- token refresh ---------- */
let refreshPromise = null;

async function refreshAccessToken() {
  // If already refreshing, return the existing promise
  if (refreshPromise) return refreshPromise;

  logger.info('TOKEN', 'Starting token refresh');

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${BASE}/auth/refresh/`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!res.ok) {
        logger.error('TOKEN', 'Token refresh failed', { status: res.status });
        logoutAndRedirect();
        throw new Error('Token refresh failed');
      }

      const data = await res.json();
      if (!data.access_token) {
        throw new Error('Refresh response missing access token');
      }

      localStorage.setItem('accessToken', data.access_token);
      logger.success('TOKEN', 'Token refreshed successfully');
      return data.access_token;
    } catch (err) {
      logger.error('TOKEN', 'Token refresh error', err.message);
      logoutAndRedirect();
      throw err;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/* ---------- low-level fetch (returns Response) ---------- */
export async function fetchRaw(path, init = {}) {
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  const method = init.method || 'GET';
  const requestBody = init.body && !(init.body instanceof FormData) ? JSON.stringify(init.body) : init.body;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let token = localStorage.getItem('accessToken');
    if (token && isTokenExpired(token, 120)) {
      try {
        token = await refreshAccessToken();
      } catch {
        logoutAndRedirect();
        throw new Error('Unauthorized');
      }
    }

    const headers = new Headers(init.headers || {});
    headers.set('Accept', 'application/json');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (requestBody && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');

    const res = await fetch(url, {
      ...init,
      method,
      body: requestBody,
      headers,
      credentials: 'include',
    });

    if ((res.status === 401 || res.status === 403) && attempt === 0) {
      try {
        await refreshAccessToken();
        continue;
      } catch {
        logoutAndRedirect();
        throw new Error('Unauthorized');
      }
    }

    if (!res.ok && (res.status === 401 || res.status === 403)) {
      logoutAndRedirect();
      throw new Error('Unauthorized');
    }

    return res;
  }

  logoutAndRedirect();
  throw new Error('Unauthorized');
}

/* ---------- high-level fetch (returns parsed payload) ---------- */
async function handleResponse(res, { noRedirectOnAuthFailure = false } = {}) {
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      if (!noRedirectOnAuthFailure) {
        // The caller decides whether to retry before forcing logout.
      }
      const err = new Error('Unauthorized');
      err.status = res.status;
      err.payload = payload;
      throw err;
    }
    const msg = payload?.message || payload?.error || res.statusText || 'Request failed';
    const err = new Error(msg);
    err.status = res.status;
    err.payload = payload;
    throw err;
  }
  return payload;
}

/**
 * apiFetch(path, opts) -> returns parsed payload (object/array/null)
 * If you need the raw Response (to call .blob() / .arrayBuffer() / stream), use fetchRaw(...)
 * Automatically refreshes token if it's about to expire
 */
export async function apiFetch(path, opts = {}) {
  const { noAuth = false, noRedirectOnAuthFailure = false } = opts;
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  const method = opts.method || 'GET';

  logger.apiRequest(method, path, opts.body);

  const request = async () => {
    let token = localStorage.getItem('accessToken');

    if (token && !noAuth && isTokenExpired(token, 120)) {
      try {
        token = await refreshAccessToken();
      } catch (err) {
        logger.error('API', `Token refresh failed for ${method} ${path}`, err?.message || String(err));
      }
    }

    const headers = new Headers(opts.headers || {});
    headers.set('Accept', 'application/json');
    if (token && !noAuth) headers.set('Authorization', `Bearer ${token}`);

    const body = opts.body && !(opts.body instanceof FormData) ? JSON.stringify(opts.body) : opts.body;
    if (body && !(opts.body instanceof FormData)) headers.set('Content-Type', 'application/json');

    const controller = new AbortController();
    const signal = opts.signal || controller.signal;
    const timeout = opts.timeoutMs;
    let timeoutId;
    if (timeout) timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(url, {
        method,
        headers,
        body,
        signal,
        credentials: 'include',
      });

      logger.apiResponse(method, path, res.status, res.ok ? 'Success' : 'Failed');
      return res;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  };

  try {
    const firstRes = await request();

    if ((firstRes.status === 401 || firstRes.status === 403) && !noAuth) {
      try {
        await refreshAccessToken();
        const retryRes = await request();
        if (retryRes.status === 401 || retryRes.status === 403) {
          if (!noRedirectOnAuthFailure) logoutAndRedirect();
          throw new Error('Unauthorized');
        }
        return await handleResponse(retryRes, { noRedirectOnAuthFailure });
      } catch (refreshErr) {
        if (!noRedirectOnAuthFailure && refreshErr && (refreshErr.status === 401 || refreshErr.status === 403)) {
          logoutAndRedirect();
        }
        throw refreshErr;
      }
    }

    return await handleResponse(firstRes, { noRedirectOnAuthFailure });
  } catch (err) {
    const status = err?.status || 'UNKNOWN';
    logger.apiError(method, path, status, err?.message || String(err));
    if (!noRedirectOnAuthFailure && (err?.status === 401 || err?.status === 403)) {
      logoutAndRedirect();
    }
    throw err;
  }
}