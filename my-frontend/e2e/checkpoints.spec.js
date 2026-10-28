import { expect, expectImageLoaded, login, MAP_URL, test, TEST_PHOTO } from './fixtures';

// Each test logs a visit and deletes it again, so the seeded data is unchanged
// afterwards (the database lives for the whole Playwright run).

async function openCheckpoints(page) {
  await login(page, 'checkpoint');
  await expect(page).toHaveURL(MAP_URL);
  await page.getByRole('button', { name: 'Checkpoints' }).click();
}

const checkpointCard = (page, title) => page.locator('.checkpoint-list-card', { hasText: title });
const visitPhoto = (page) => page.getByAltText('Visit photo');

async function deleteVisit(page, card) {
  await card.click();
  await page.getByRole('button', { name: 'Delete Visit' }).click();
  await expect(card).toContainText('Not visited');
}

test('log a checkpoint visit without a photo, then delete it', async ({ page }) => {
  await openCheckpoints(page);
  const card = checkpointCard(page, 'Lookout Tower');
  await expect(card).toContainText('Not visited');

  await card.click();
  await page.getByRole('button', { name: 'Log Visit' }).click();
  await expect(page.getByText('Visit logged successfully')).toBeVisible();
  await expect(card).not.toContainText('Not visited');

  // Persisted on the server, not just in UI state.
  await page.reload();
  await expect(card).toContainText('Visited');
  await expect(card).not.toContainText('Not visited');

  await card.click();
  await expect(visitPhoto(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Close' }).click();

  await deleteVisit(page, card);
  await page.reload();
  await expect(card).toContainText('Not visited');
});

test('log a checkpoint visit with a photo, then delete it', async ({ page }) => {
  await openCheckpoints(page);
  const card = checkpointCard(page, 'Old Mill');
  await expect(card).toContainText('Not visited');

  await card.click();
  await page.locator('input[type="file"]').setInputFiles(TEST_PHOTO);
  await expect(page.getByText('test_image.jpg')).toBeVisible();
  await page.getByRole('button', { name: 'Log Visit' }).click();
  await expect(page.getByText('Visit logged successfully')).toBeVisible();

  // The uploaded photo is stored and served by the backend.
  await page.reload();
  await card.click();
  const photo = visitPhoto(page);
  await expectImageLoaded(photo);
  const photoUrl = await photo.getAttribute('src');
  await page.getByRole('button', { name: 'Close' }).click();

  await deleteVisit(page, card);

  // Deleting the visit also removes the photo file on the server.
  expect((await page.request.get(photoUrl)).status()).toBe(404);
  await card.click();
  await expect(visitPhoto(page)).toHaveCount(0);
});
