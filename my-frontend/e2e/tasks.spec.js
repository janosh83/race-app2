import { expect, expectImageLoaded, login, MAP_URL, test, TEST_PHOTO } from './fixtures';

// Each test completes a task and deletes the completion again, so the seeded
// data is unchanged afterwards (the database lives for the whole Playwright run).

async function openTasks(page) {
  await login(page, 'task');
  await expect(page).toHaveURL(MAP_URL);
  await page.getByRole('button', { name: 'Tasks' }).click();
}

const taskCard = (page, title) => page.locator('.tasks-card', { hasText: title });
const completionPhoto = (page) => page.getByAltText('Completion photo');

async function deleteCompletion(page, card) {
  await card.click();
  await page.getByRole('button', { name: 'Delete completion' }).click();
  await expect(page.getByText('Task completion deleted')).toBeVisible();
  await expect(card).toContainText('Not completed');
}

test('complete a task without a photo, then delete the completion', async ({ page }) => {
  await openTasks(page);
  const card = taskCard(page, 'Sing a Song');
  await expect(card).toContainText('Not completed');

  await card.click();
  await page.getByRole('button', { name: 'Mark as completed' }).click();
  await expect(page.getByText('Task completed successfully')).toBeVisible();
  await expect(card).not.toContainText('Not completed');

  // Persisted on the server, not just in UI state.
  await page.reload();
  await expect(card).toContainText('Completed');
  await expect(card).not.toContainText('Not completed');
  await expect(card).not.toContainText('Photo attached');

  await card.click();
  await expect(completionPhoto(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Close' }).click();

  await deleteCompletion(page, card);
  await page.reload();
  await expect(card).toContainText('Not completed');
});

test('complete a task with a photo, then delete the completion', async ({ page }) => {
  await openTasks(page);
  const card = taskCard(page, 'Team Photo');
  await expect(card).toContainText('Not completed');

  await card.click();
  await page.locator('input[type="file"]').setInputFiles(TEST_PHOTO);
  await expect(page.getByText('test_image.jpg')).toBeVisible();
  await page.getByRole('button', { name: 'Mark as completed' }).click();
  await expect(page.getByText('Task completed successfully')).toBeVisible();

  // The uploaded photo is stored and served by the backend.
  await page.reload();
  await expect(card).toContainText('Photo attached');
  await card.click();
  const photo = completionPhoto(page);
  await expectImageLoaded(photo);
  const photoUrl = await photo.getAttribute('src');
  await page.getByRole('button', { name: 'Close' }).click();

  await deleteCompletion(page, card);

  // Deleting the completion also removes the photo file on the server.
  expect((await page.request.get(photoUrl)).status()).toBe(404);
  await expect(card).not.toContainText('Photo attached');
  await card.click();
  await expect(completionPhoto(page)).toHaveCount(0);
});
