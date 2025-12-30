/**
 * Merged auth + api helpers:
 * - parseJwt, isTokenExpired, logoutAndRedirect (from auth.js)
 * - fetchRaw (low-level wrapper that returns Response, similar to old auth.apiFetch)
 * - apiFetch (high-level wrapper that returns parsed JSON and throws on non-ok)
 */

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
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  localStorage.removeItem('signedRaces');
  localStorage.removeItem('activeRace');
  localStorage.removeItem('activeSection');
  window.location.href = loginPath;
}

/* ---------- token refresh ---------- */
let refreshPromise = null;

async function refreshAccessToken() {
  // If already refreshing, return the existing promise
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
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
        logoutAndRedirect();
        throw new Error('Token refresh failed');
      }

      const data = await res.json();
      localStorage.setItem('accessToken', data.access_token);
      return data.access_token;
    } catch (err) {
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
  let token = localStorage.getItem('accessToken');
  
  // Check if token is expired or about to expire (within 2 minutes)
  if (token && !noAuth && isTokenExpired(token, 120)) {
    try {
      token = await refreshAccessToken();
    } catch (err) {
      // Refresh failed, let the request proceed and handle 401
      console.error('Token refresh failed:', err);
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
      method: opts.method || 'GET',
      headers,
      body,
      signal,
    });
    return await handleResponse(res, { noRedirectOnAuthFailure });
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}