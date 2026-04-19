import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import * as TimeContext from '../contexts/TimeContext';
import { raceApi } from '../services/raceApi';
import { isTokenExpired, logoutAndRedirect } from '../utils/api';

import CheckpointsList from './CheckpointsList';

vi.mock('../services/raceApi');
vi.mock('../utils/api');

vi.mock('piexifjs', () => ({
  load: vi.fn(() => ({})),
  dump: vi.fn(() => ''),
  insert: vi.fn((exif, dataUrl) => dataUrl),
}));

describe('CheckpointsList Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    vi.spyOn(TimeContext, 'useTime').mockReturnValue({
      activeRace: { race_id: 1, team_id: 10 },
      timeInfo: { state: 'SHOW_ONLY' },
      selectedLanguage: 'en',
    });

    vi.spyOn(TimeContext, 'formatDate').mockImplementation((date) => date || 'N/A');
    isTokenExpired.mockReturnValue(false);
    vi.stubEnv('VITE_API_URL', 'http://test-api.com');
  });

  test('shows the same read-only status message as the map for a visited checkpoint', async () => {
    raceApi.getCheckpointsStatus.mockResolvedValue([
      {
        id: 1,
        title: 'Visited Checkpoint',
        description: 'Already logged',
        latitude: 50.1,
        longitude: 14.1,
        visited: true,
      },
    ]);

    render(<CheckpointsList />);

    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(screen.getByText('Visited Checkpoint'));

    expect(screen.getByText('Navigate')).toBeInTheDocument();
    expect(screen.getByText('Visit logged (read-only mode)')).toBeInTheDocument();
    expect(screen.queryByText('Logging is not open yet')).not.toBeInTheDocument();
    expect(logoutAndRedirect).not.toHaveBeenCalled();
  });

  test('hides navigation action when checkpoint coordinates are incomplete', async () => {
    raceApi.getCheckpointsStatus.mockResolvedValue([
      {
        id: 2,
        title: 'Broken Checkpoint',
        description: 'Missing longitude',
        latitude: 50.1,
        longitude: '',
        visited: false,
      },
    ]);

    render(<CheckpointsList />);

    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(screen.getByText('Broken Checkpoint'));

    expect(screen.queryByText('Navigate')).not.toBeInTheDocument();
  });
});