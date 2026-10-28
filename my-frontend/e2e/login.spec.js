import { expect, login, MAP_URL, RUNNING_A, RUNNING_B, test } from './fixtures';

test('the only running race is auto-selected and its map opens', async ({ page }) => {
  await login(page, 'solo');

  await expect(page).toHaveURL(MAP_URL);
  await expect(page.getByRole('button', { name: RUNNING_A })).toBeVisible();
});

test('with several running races the user picks one', async ({ page }) => {
  await login(page, 'multi');

  await expect(page).toHaveURL(/\/race$/);
  await expect(page.getByText('Multiple races are currently active')).toBeVisible();

  const raceB = page.locator('.list-group-item', { hasText: RUNNING_B });
  await raceB.getByRole('button', { name: 'Select' }).click();

  await expect(page.getByRole('button', { name: RUNNING_B })).toBeVisible();
  await expect(page.locator('.list-group-item', { hasText: RUNNING_A })).toBeVisible();
});

test('a wrong password shows an error and stays on the login page', async ({ page }) => {
  await login(page, 'solo', 'wrong-password');

  await expect(page.locator('.alert-danger')).toHaveText('Invalid email or password.');
  await expect(page).toHaveURL(/\/login$/);
});
