import {
  apiAsAdmin,
  apiAsUser,
  expect,
  FINISHED,
  LOGGING_CLOSED,
  login,
  MAP_URL,
  NOT_STARTED,
  PREVIEW,
  test,
} from './fixtures';

// One seeded race per time phase (scripts/e2e_server.py), each with checkpoints
// 'North Gate' and 'South Gate' and task 'Phase Task'. Every window boundary is
// days away, so these tests check what each phase allows, not exact timing.

const nav = (page, name) => page.getByRole('button', { name, exact: true }).click();
const checkpointCard = (page, title) => page.locator('.checkpoint-list-card', { hasText: title });
const taskCard = (page, title) => page.locator('.tasks-card', { hasText: title });
const mapMarkers = (page) => page.locator('.leaflet-marker-icon');

// Races whose checkpoints are currently shown are auto-selected after login;
// the others must be picked on the race page.
async function openRace(page, userKey, raceName, { autoSelected }) {
  await login(page, userKey);
  if (autoSelected) {
    await expect(page).toHaveURL(MAP_URL);
  } else {
    await expect(page).toHaveURL(/\/race$/);
    await page.locator('.list-group-item', { hasText: raceName })
      .getByRole('button', { name: 'Select' }).click();
  }
  await expect(page.getByRole('button', { name: raceName })).toBeVisible();
}

const activeRace = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('activeRace')));

// Looked up as admin: users can't read checkpoints while they're hidden.
async function raceIds(page, request) {
  const race = await activeRace(page);
  const raceId = race.race_id ?? race.id;
  const checkpoints = await (await apiAsAdmin(request, 'GET', `/api/race/${raceId}/checkpoints/`)).json();
  const tasks = await (await apiAsAdmin(request, 'GET', `/api/race/${raceId}/tasks/`)).json();
  const idOf = (items, title) => items.find((item) => item.title === title).id;
  return {
    raceId,
    teamId: race.team_id,
    northGate: idOf(checkpoints, 'North Gate'),
    southGate: idOf(checkpoints, 'South Gate'),
    phaseTask: idOf(tasks, 'Phase Task'),
  };
}

// The UI only hides the logging controls; the server must refuse on its own.
// Unvisited: logging is refused. Visited: deleting the visit is refused.
async function expectLoggingRefused(page, request, { visited = false } = {}) {
  const ids = await raceIds(page, request);
  const base = `/api/race/${ids.raceId}`;
  const method = visited ? 'DELETE' : 'POST';
  const attempts = [
    [`${base}/checkpoints/log/`, { team_id: ids.teamId, checkpoint_id: visited ? ids.northGate : ids.southGate }],
    [`${base}/tasks/log/`, { team_id: ids.teamId, task_id: ids.phaseTask }],
  ];
  for (const [path, data] of attempts) {
    const response = await apiAsUser(page, method, path, data);
    expect(response.status(), `${method} ${path}`).toBe(403);
    expect((await response.json()).message).toBe('Logging for this race is not allowed at this time.');
  }
}

// Hidden checkpoints and tasks must not be readable through the API either
// (e.g. checkpoint coordinates before the race starts).
async function expectContentRefused(page) {
  const race = await activeRace(page);
  const raceId = race.race_id ?? race.id;
  for (const path of [
    `/api/race/${raceId}/checkpoints/`,
    `/api/race/${raceId}/checkpoints/${race.team_id}/status/`,
    `/api/race/${raceId}/tasks/`,
    `/api/race/${raceId}/tasks/${race.team_id}/status/`,
  ]) {
    const response = await apiAsUser(page, 'GET', path);
    expect(response.status(), path).toBe(403);
    expect((await response.json()).message).toBe('Checkpoints and tasks for this race are not shown at this time.');
  }
}

// The map only has its status badge; the list explains when/why.
// While content is hidden the app must not even request it (the API would
// refuse with 403 and the page would show a load error).
function recordContentRequests(page) {
  const urls = [];
  page.on('request', (request) => {
    if (/\/api\/race\/\d+\/(checkpoints|tasks)\/\d+\/status\//.test(request.url())) urls.push(request.url());
  });
  return urls;
}

async function expectCheckpointsHidden(page, { badge, message }) {
  await nav(page, 'Map');
  await expect(page.getByText(badge)).toBeVisible();
  await expect(mapMarkers(page)).toHaveCount(0);

  await nav(page, 'Checkpoints');
  await expect(page.getByText(message)).toBeVisible();
  await expect(checkpointCard(page, 'Gate')).toHaveCount(0);
}

async function expectTasksHidden(page, message) {
  await nav(page, 'Tasks');
  await expect(page.getByText(message)).toBeVisible();
  await expect(taskCard(page, 'Phase Task')).toHaveCount(0);
}

// Checkpoints and tasks are visible, but nothing can be logged or deleted.
async function expectReadOnly(page, { visited }) {
  await nav(page, 'Map');
  await expect(mapMarkers(page)).toHaveCount(2);

  await nav(page, 'Checkpoints');
  await expect(page.getByText('Read-only')).toBeVisible();
  for (const title of ['North Gate', 'South Gate']) {
    await checkpointCard(page, title).click();
    await expect(page.getByRole('button', { name: 'Log Visit' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Delete Visit' })).toHaveCount(0);
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
    if (visited && title === 'North Gate') {
      await expect(page.getByText('Visit logged (read-only mode)')).toBeVisible();
    }
    await page.getByRole('button', { name: /Close$/ }).click();
  }
  if (visited) {
    await expect(checkpointCard(page, 'North Gate')).not.toContainText('Not visited');
  }
  await expect(checkpointCard(page, 'South Gate')).toContainText('Not visited');

  await nav(page, 'Tasks');
  const card = taskCard(page, 'Phase Task');
  await expect(card).toContainText(visited ? 'Completed' : 'Not completed');
  await card.click();
  const button = visited ? 'Delete completion' : 'Mark as completed';
  await expect(page.getByRole('button', { name: button })).toBeDisabled();
  await page.getByRole('button', { name: /Close$/ }).click();
}

test('before showing: only the start time is shown', async ({ page, request }) => {
  const contentRequests = recordContentRequests(page);
  await openRace(page, 'before', NOT_STARTED, { autoSelected: false });
  await expect(page.getByText('Before checkpoints are shown')).toBeVisible();

  await expectCheckpointsHidden(page, { badge: /^Coming /, message: /Checkpoints will be shown at/ });
  await expectTasksHidden(page, /Tasks will be shown at/);
  expect(contentRequests).toEqual([]);
  await expectContentRefused(page);
  await expectLoggingRefused(page, request);
});

test('before logging: checkpoints and tasks are visible but read-only', async ({ page, request }) => {
  await openRace(page, 'preview', PREVIEW, { autoSelected: true });

  await expectReadOnly(page, { visited: false });
  await expectLoggingRefused(page, request);
});

test('after logging: visits stay visible but nothing can be logged or deleted', async ({ page, request }) => {
  await openRace(page, 'closed', LOGGING_CLOSED, { autoSelected: true });

  await expectReadOnly(page, { visited: true });
  await expectLoggingRefused(page, request);
  await expectLoggingRefused(page, request, { visited: true });

  // The refused deletes changed nothing.
  await page.reload();
  await nav(page, 'Checkpoints');
  await expect(checkpointCard(page, 'North Gate')).not.toContainText('Not visited');
  await nav(page, 'Tasks');
  await expect(taskCard(page, 'Phase Task')).not.toContainText('Not completed');
});

test('after showing: only the results are available', async ({ page, request }) => {
  const contentRequests = recordContentRequests(page);
  await openRace(page, 'finished', FINISHED, { autoSelected: false });
  await expect(page.getByText('Checkpoint display finished')).toBeVisible();

  await expectCheckpointsHidden(page, { badge: 'Checkpoints hidden', message: /Showing of checkpoints ended at/ });
  await expectTasksHidden(page, /Showing of tasks ended at/);
  expect(contentRequests).toEqual([]);
  await expectContentRefused(page);
  await expectLoggingRefused(page, request, { visited: true });

  // North Gate (3) + Phase Task (2), logged while the race was running.
  await nav(page, 'Standings');
  const ownRow = page.getByRole('row', { name: /Team finished/ });
  await expect(ownRow.getByRole('cell').last()).toHaveText('5');
});
