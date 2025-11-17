/**
 * Small auth helpers: parse JWT, check expiry, logout+redirect and a fetch wrapper
 */

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

/**
 * Return true when token is expired (optionally with a margin in seconds).
 */
export function isTokenExpired(token, marginSeconds = 10) {
  const payload = parseJwt(token);
  if (!payload || !payload.exp) return true;
  const expMs = payload.exp * 1000;
  return Date.now() > (expMs - marginSeconds * 1000);
}

export function logoutAndRedirect(loginPath = '/login') {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('user');
  localStorage.removeItem('signedRaces');
  localStorage.removeItem('activeRace');
  localStorage.removeItem('activeSection');
  // redirect to login page (adjust path if your app uses different route)
  window.location.href = loginPath;
}

/**
 * Wrapper around fetch that automatically logs out and redirects on 401/403.
 * Usage: import { apiFetch } and use instead of fetch.
 */
export async function apiFetch(input, init = {}) {
  const token = localStorage.getItem('accessToken');
  const headers = new Headers(init.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  headers.set('Accept', 'application/json');

  const res = await fetch(input, { ...init, headers });
  if (res.status === 401 || res.status === 403) {
    // token invalid/expired or unauthorized
    logoutAndRedirect();
    // throw to stop further processing
    throw new Error('Unauthorized');
  }
  return res;
}