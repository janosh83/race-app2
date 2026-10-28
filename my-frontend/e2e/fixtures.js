import { test as base, expect } from '@playwright/test';

// Seeded by ../../scripts/e2e_server.py (keep USERS there in sync).
export const BACKEND_URL = 'http://127.0.0.1:5055';
export const PASSWORD = 'e2e-password';
export const RUNNING_A = 'Running Race A';
export const RUNNING_B = 'Running Race B';
export const FUTURE = 'Future Race';
export const userEmail = (key) => `${key}@e2e.test`;

// Only the app's own servers are reachable: map tiles, marker icons etc. are
// blocked so tests don't depend on the internet.
export async function blockExternalRequests(context) {
  await context.route('**/*', (route) => {
    const { hostname } = new URL(route.request().url());
    return hostname === '127.0.0.1' ? route.continue() : route.abort();
  });
}

export const test = base.extend({
  context: async ({ context }, use) => {
    await blockExternalRequests(context);
    await use(context);
  },
});

export { expect };

export async function login(page, userKey, password = PASSWORD) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(userEmail(userKey));
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
}

export const MAP_URL = /\/race\/\d+\/map$/;

// Replace the stored access token with an expired one (same shape as a JWT;
// the frontend only reads the payload's exp). The HttpOnly refresh cookie is
// untouched, so the app should silently refresh instead of logging out.
export async function expireAccessToken(page) {
  await page.evaluate(() => {
    const payload = btoa(JSON.stringify({ sub: 'e2e', exp: Math.floor(Date.now() / 1000) - 60 }));
    localStorage.setItem('accessToken', `e2e.${payload}.expired`);
  });
}

export async function storedAccessToken(page) {
  return page.evaluate(() => localStorage.getItem('accessToken'));
}
