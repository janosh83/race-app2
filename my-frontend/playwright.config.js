import { defineConfig, devices } from '@playwright/test';

// End-to-end tests: a real browser against the real Vite frontend and the
// real Flask backend with a freshly seeded SQLite database
// (../scripts/e2e_server.py). Both run on 127.0.0.1 so the HttpOnly refresh
// cookie is same-site, as in a normal deployment.
const BACKEND_PORT = 5055;
const FRONTEND_PORT = 5175;
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const FRONTEND_URL = `http://127.0.0.1:${FRONTEND_PORT}`;
const PYTHON = process.env.E2E_PYTHON || 'python';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: FRONTEND_URL,
    locale: 'en-US',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: `${PYTHON} ../scripts/e2e_server.py`,
      url: `${BACKEND_URL}/apidocs/`,
      env: { E2E_BACKEND_PORT: String(BACKEND_PORT), E2E_FRONTEND_ORIGIN: FRONTEND_URL },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `npx vite --host 127.0.0.1 --port ${FRONTEND_PORT} --strictPort`,
      url: FRONTEND_URL,
      // Shell env wins over my-frontend/.env in Vite.
      env: { VITE_API_URL: BACKEND_URL, VITE_MAPY_API_KEY: 'e2e', VITE_DEBUG_MODE: 'false' },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
