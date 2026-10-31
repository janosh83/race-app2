import { apiFetch } from './api';
import { isLoggingWindowOpen, MAX_ACCURACY_M, reportPosition } from './positionReporting';

vi.mock('./api');

const HOUR = 3_600_000;

function raceWithWindow(startOffsetMs, endOffsetMs) {
  const now = Date.now();
  return {
    race_id: 7,
    start_logging: new Date(now + startOffsetMs).toISOString(),
    end_logging: new Date(now + endOffsetMs).toISOString(),
  };
}

function mockGeolocation({ accuracy = 10, permission = 'granted' } = {}) {
  const getCurrentPosition = vi.fn(success => success({
    coords: { latitude: 50.1, longitude: 14.2, accuracy },
    timestamp: Date.parse('2026-05-01T10:00:00Z'),
  }));
  Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition }, configurable: true });
  Object.defineProperty(navigator, 'permissions', {
    value: { query: vi.fn().mockResolvedValue({ state: permission }) },
    configurable: true,
  });
  return getCurrentPosition;
}

describe('positionReporting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiFetch.mockResolvedValue({ stored: true });
  });

  afterEach(() => {
    delete navigator.geolocation;
    delete navigator.permissions;
  });

  test('isLoggingWindowOpen respects the race logging window', () => {
    expect(isLoggingWindowOpen(raceWithWindow(-HOUR, HOUR))).toBe(true);
    expect(isLoggingWindowOpen(raceWithWindow(HOUR, 2 * HOUR))).toBe(false);
    expect(isLoggingWindowOpen(raceWithWindow(-2 * HOUR, -HOUR))).toBe(false);
    expect(isLoggingWindowOpen({ race_id: 1 })).toBe(false);
  });

  test('sends the position during the logging window', async () => {
    mockGeolocation();

    await expect(reportPosition(raceWithWindow(-HOUR, HOUR))).resolves.toBe(true);

    expect(apiFetch).toHaveBeenCalledWith('/api/race/7/positions/', {
      method: 'POST',
      body: { latitude: 50.1, longitude: 14.2, accuracy: 10, recorded_at: '2026-05-01T10:00:00.000Z' },
    });
  });

  test('does nothing while the race is only being planned', async () => {
    const getCurrentPosition = mockGeolocation();

    await expect(reportPosition(raceWithWindow(HOUR, 2 * HOUR))).resolves.toBe(false);

    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  test('never prompts for location permission', async () => {
    const getCurrentPosition = mockGeolocation({ permission: 'prompt' });

    await expect(reportPosition(raceWithWindow(-HOUR, HOUR))).resolves.toBe(false);

    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  test('skips inaccurate fixes', async () => {
    mockGeolocation({ accuracy: MAX_ACCURACY_M + 1 });

    await expect(reportPosition(raceWithWindow(-HOUR, HOUR))).resolves.toBe(false);

    expect(apiFetch).not.toHaveBeenCalled();
  });

  test('swallows request errors', async () => {
    mockGeolocation();
    apiFetch.mockRejectedValue(new Error('offline'));

    await expect(reportPosition(raceWithWindow(-HOUR, HOUR))).resolves.toBe(false);
  });

  test('does nothing without an active race', async () => {
    mockGeolocation();
    await expect(reportPosition(null)).resolves.toBe(false);
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
