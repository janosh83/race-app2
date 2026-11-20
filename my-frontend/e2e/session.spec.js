import {
  BACKEND_URL,
  blockExternalRequests,
  expect,
  expireAccessToken,
  login,
  MAP_URL,
  storedAccessToken,
  test,
} from './fixtures';

const waitForRefresh = (page) =>
  page.waitForResponse((res) => res.url().endsWith('/auth/refresh/') && res.request().method() === 'POST');

test('an expired access token is refreshed silently instead of logging out', async ({ page }) => {
  await login(page, 'expiry');
  await expect(page).toHaveURL(MAP_URL);

  await expireAccessToken(page);
  const refresh = waitForRefresh(page);
  await page.reload();

  expect((await refresh).status()).toBe(200);
  await expect(page).toHaveURL(MAP_URL);
  expect(await storedAccessToken(page)).not.toContain('.expired');
});

test('two tabs refreshing at the same time both stay logged in', async ({ context }) => {
  const first = await context.newPage();
  await login(first, 'tabs');
  await expect(first).toHaveURL(MAP_URL);
  const second = await context.newPage();
  await second.goto('/race');
  await expect(second.getByRole('button', { name: 'Logout' })).toBeVisible();

  // Tabs share localStorage and the refresh cookie, so both see the expired
  // token and refresh at once (previously the slower one logged both out).
  await expireAccessToken(first);
  await Promise.all([first.reload(), second.reload()]);

  for (const page of [first, second]) {
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
    await expect(page).not.toHaveURL(/\/login$/);
  }
  expect(await storedAccessToken(first)).not.toContain('.expired');
});

test('logging out in one tab logs out the other and revokes the session', async ({ context }) => {
  const first = await context.newPage();
  await login(first, 'tabs');
  await expect(first).toHaveURL(MAP_URL);
  const second = await context.newPage();
  await second.goto('/race');
  await expect(second.getByRole('button', { name: 'Logout' })).toBeVisible();

  // The logout request is sent with keepalive while the page navigates away,
  // so its response isn't reported to the page; the 401 below proves it worked.
  const logoutCall = first.waitForRequest((req) => req.url().endsWith('/auth/logout/'));
  await first.getByRole('button', { name: 'Logout' }).click();
  await logoutCall;

  await expect(first).toHaveURL(/\/login$/);
  await expect(second).toHaveURL(/\/login$/);

  // The refresh cookie no longer works, so nothing can log the user back in.
  const refresh = await second.request.post(`${BACKEND_URL}/auth/refresh/`);
  expect(refresh.status()).toBe(401);
  await second.reload();
  await expect(second).toHaveURL(/\/login$/);
});

test('logging in on a second device keeps the first one logged in', async ({ browser }) => {
  const laptop = await browser.newContext();
  const phone = await browser.newContext();
  await blockExternalRequests(laptop);
  await blockExternalRequests(phone);
  const laptopPage = await laptop.newPage();
  const phonePage = await phone.newPage();

  await login(laptopPage, 'devices');
  await expect(laptopPage).toHaveURL(MAP_URL);
  await login(phonePage, 'devices');
  await expect(phonePage).toHaveURL(MAP_URL);

  // Force both devices to use their refresh cookies.
  for (const page of [laptopPage, phonePage]) {
    await expireAccessToken(page);
    const refresh = waitForRefresh(page);
    await page.reload();
    expect((await refresh).status()).toBe(200);
    await expect(page).toHaveURL(MAP_URL);
  }

  await laptop.close();
  await phone.close();
});
