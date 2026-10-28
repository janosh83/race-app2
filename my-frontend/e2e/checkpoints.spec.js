import { expect, login, MAP_URL, test } from './fixtures';

// Logs a visit and deletes it again, so the seeded data is unchanged afterwards
// (the database lives for the whole Playwright run, e.g. with --repeat-each).
test('a team logs a checkpoint visit and deletes it again', async ({ page }) => {
  await login(page, 'checkpoint');
  await expect(page).toHaveURL(MAP_URL);

  await page.getByRole('button', { name: 'Checkpoints' }).click();
  const card = page.locator('.checkpoint-list-card', { hasText: 'Old Mill' });
  await expect(card).toContainText('Not visited');

  await card.click();
  await page.getByRole('button', { name: 'Log Visit' }).click();

  await expect(page.getByText('Visit logged successfully')).toBeVisible();
  await expect(card).not.toContainText('Not visited');
  await expect(card).toContainText('Visited');

  // Persisted on the server, not just in UI state.
  await page.reload();
  await expect(card).toContainText('Visited');
  await expect(card).not.toContainText('Not visited');

  await card.click();
  await page.getByRole('button', { name: 'Delete Visit' }).click();
  await expect(card).toContainText('Not visited');
});
