/**
 * Merged auth + api helpers:
 * - parseJwt, isTokenExpired, logoutAndRedirect (from auth.js)
 * - fetchRaw (low-level wrapper that returns Response, similar to old auth.apiFetch)
 * - apiFetch (high-level wrapper that returns parsed JSON and throws on non-ok)
 */

import { logger } from './logger';

const BASE = process.env.REACT_APP_API_URL || '';

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

export function logoutAndRedirect(loginPath = '/login') {
  logger.info('AUTH', 'Logging out and redirecting to login');
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  localStorage.removeItem('signedRaces');
  localStorage.removeItem('activeRace');
  localStorage.removeItem('activeSection');
  try {
    sessionStorage.removeItem('initialLoad');
  } catch {}
  // Notify app to sync auth state immediately
  try {
    window.dispatchEvent(new Event('auth-update'));
  } catch {}
  // Replace history entry to prevent back navigation; fall back to href in tests
  try {
    window.location.replace(loginPath);
  } catch {
    window.location.href = loginPath;
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
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        logger.error('TOKEN', 'No refresh token found');
        logoutAndRedirect();
        throw new Error('No refresh token');
      }

      const res = await fetch(`${BASE}/auth/refresh/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${refreshToken}`,
          'Accept': 'application/json',
        },
      });

      if (!res.ok) {
        logger.error('TOKEN', 'Token refresh failed', { status: res.status });
        logoutAndRedirect();
        throw new Error('Token refresh failed');
      }

      const data = await res.json();
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
  const token = localStorage.getItem('accessToken');
  const headers = new Headers(init.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  headers.set('Accept', 'application/json');

  const res = await fetch(url, { ...init, headers });
  if (res.status === 401 || res.status === 403) {
    logoutAndRedirect();
    throw new Error('Unauthorized');
  }
  return res;
}

/* ---------- high-level fetch (returns parsed payload) ---------- */
async function handleResponse(res, { noRedirectOnAuthFailure = false } = {}) {
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      if (!noRedirectOnAuthFailure) logoutAndRedirect();
      throw new Error('Unauthorized');
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
  let token = localStorage.getItem('accessToken');
  
  // Log the request
  logger.apiRequest(method, path, opts.body);
  
  // Check if token is expired or about to expire (within 2 minutes)
  if (token && !noAuth && isTokenExpired(token, 120)) {
    try {
      token = await refreshAccessToken();
    } catch (err) {
      // Refresh failed, let the request proceed and handle 401
      logger.error('API', `Token refresh failed for ${method} ${path}`, err.message);
    }
  }
  
  const headers = new Headers(opts.headers || {});
  headers.set('Accept', 'application/json');
  if (token && !noAuth) headers.set('Authorization', `Bearer ${token}`);
  // if body provided and not FormData, ensure JSON content-type
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
    });
    
    // Log the response
    logger.apiResponse(method, path, res.status, res.ok ? 'Success' : 'Failed');
    
    const result = await handleResponse(res, { noRedirectOnAuthFailure });
    return result;
  } catch (err) {
    // Log the error
    const status = err.status || 'UNKNOWN';
    logger.apiError(method, path, status, err.message);
    throw err;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}