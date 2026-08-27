import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import * as TimeContext from '../contexts/TimeContext';
import { raceApi } from '../services/raceApi';
import { isTokenExpired, logoutAndRedirect } from '../utils/api';

import CheckpointsList from './CheckpointsList';

vi.mock('../services/raceApi');
vi.mock('../utils/api');
vi.mock('../utils/image', () => ({
  resizeImageWithExif: vi.fn(async (file) => ({
    resizedFile: file,
    previewDataUrl: 'data:image/jpeg;base64,preview',
  })),
}));
vi.mock('../utils/navigation', () => ({
  copyCoordinatesToClipboard: vi.fn(async () => true),
  getNavigationTarget: vi.fn(({ latitude, longitude }) => (
    latitude !== null && latitude !== undefined && latitude !== ''
    && longitude !== null && longitude !== undefined && longitude !== ''
      ? { latitude, longitude }
      : null
  )),
  openNavigationTarget: vi.fn(),
}));

vi.mock('piexifjs', () => ({
  load: vi.fn(() => ({})),
  dump: vi.fn(() => ''),
  insert: vi.fn((exif, dataUrl) => dataUrl),
}));

describe('CheckpointsList Component', () => {
  const mockGeolocation = {
    getCurrentPosition: vi.fn(),
    watchPosition: vi.fn(() => 1),
    clearWatch: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    raceApi.getCheckpointsStatus.mockReset();
    raceApi.getCheckpointsStatus.mockResolvedValue([]);

    vi.spyOn(TimeContext, 'useTime').mockReturnValue({
      activeRace: { race_id: 1, team_id: 10 },
      timeInfo: { state: 'SHOW_ONLY' },
      selectedLanguage: 'en',
    });

    vi.spyOn(TimeContext, 'formatDate').mockImplementation((date) => date || 'N/A');
    isTokenExpired.mockReturnValue(false);
    vi.stubEnv('VITE_API_URL', 'http://test-api.com');
    global.navigator.geolocation = mockGeolocation;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const renderList = (timeInfo = { state: 'SHOW_ONLY' }) => {
    vi.spyOn(TimeContext, 'useTime').mockReturnValue({
      activeRace: { race_id: 1, team_id: 10 },
      timeInfo,
      selectedLanguage: 'en',
    });
    return render(<CheckpointsList />);
  };

  const renderWithCheckpoint = async (checkpoint, timeInfo = { state: 'LOGGING' }, responses = [[checkpoint]]) => {
    responses.forEach((response) => raceApi.getCheckpointsStatus.mockResolvedValueOnce(response));
    renderList(timeInfo);
    await waitFor(() => expect(screen.getByText(checkpoint.title)).toBeInTheDocument());
    fireEvent.click(screen.getByText(checkpoint.title));
  };

  describe('Token management', () => {
    test('checks token expiry on mount', () => {
      localStorage.setItem('accessToken', 'valid-token');
      isTokenExpired.mockReturnValue(false);

      renderList();

      expect(isTokenExpired).toHaveBeenCalledWith('valid-token', 5);
      expect(logoutAndRedirect).not.toHaveBeenCalled();
    });

    test('redirects on expired token', () => {
      localStorage.setItem('accessToken', 'expired-token');
      isTokenExpired.mockReturnValue(true);

      renderList();

      expect(logoutAndRedirect).toHaveBeenCalled();
    });

    test('checks token periodically every 30 seconds', () => {
      vi.useFakeTimers();
      localStorage.setItem('accessToken', 'valid-token');
      isTokenExpired.mockReturnValue(false);

      renderList();
      expect(isTokenExpired).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(30000);
      expect(isTokenExpired).toHaveBeenCalledTimes(2);
    });
  });

  describe('Checkpoint fetching and status', () => {
    test('fetches checkpoints for the active race and team', async () => {
      raceApi.getCheckpointsStatus.mockResolvedValue([]);

      renderList();

      await waitFor(() => {
        expect(raceApi.getCheckpointsStatus).toHaveBeenCalledWith(1, 10, 'en');
      });
    });

    test('does not fetch checkpoints without an active race', () => {
      vi.spyOn(TimeContext, 'useTime').mockReturnValue({
        activeRace: null,
        timeInfo: { state: 'SHOW_ONLY' },
        selectedLanguage: 'en',
      });

      render(<CheckpointsList />);

      expect(raceApi.getCheckpointsStatus).not.toHaveBeenCalled();
    });

    test('does not fetch checkpoints without a team', () => {
      vi.spyOn(TimeContext, 'useTime').mockReturnValue({
        activeRace: { race_id: 1 },
        timeInfo: { state: 'SHOW_ONLY' },
        selectedLanguage: 'en',
      });

      render(<CheckpointsList />);

      expect(raceApi.getCheckpointsStatus).not.toHaveBeenCalled();
    });

    test('shows logging open and read-only status for the current time state', () => {
      renderList({ state: 'LOGGING' });
      expect(screen.getByText('Logging open')).toBeInTheDocument();

      cleanup();
      renderList({ state: 'SHOW_ONLY' });
      expect(screen.getByText('Read-only')).toBeInTheDocument();
    });

    test('shows the coming message before checkpoints are visible', () => {
      renderList({ state: 'BEFORE_SHOW', startShow: '2026-08-27T10:00:00Z' });

      expect(screen.getByText(/Coming/)).toBeInTheDocument();
      expect(screen.queryByText('Checkpoints')).toBeInTheDocument();
    });
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
    expect(screen.getByText('Copy')).toBeInTheDocument();
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
    expect(screen.queryByText('Copy')).not.toBeInTheDocument();
  });

  describe('Visit actions', () => {
    test('shows logging controls and translated file picker for an unvisited checkpoint', async () => {
      await renderWithCheckpoint({ id: 3, title: 'Loggable Checkpoint', latitude: 50.1, longitude: 14.1, visited: false });

      expect(screen.getByText('Attach Photo (optional)')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Choose file' })).toBeInTheDocument();
      expect(screen.getByText('No file chosen')).toBeInTheDocument();
      expect(screen.getByText('Log Visit')).toBeInTheDocument();
    });

    test('logs a checkpoint with the latest user location', async () => {
      const position = { coords: { latitude: 50.123, longitude: 14.456 } };
      mockGeolocation.getCurrentPosition.mockImplementationOnce((success) => success(position));
      raceApi.logVisitWithImage.mockResolvedValue({});
      await renderWithCheckpoint(
        { id: 4, title: 'Log Me', latitude: 50.1, longitude: 14.1, visited: false },
        { state: 'LOGGING' },
        [[{ id: 4, title: 'Log Me', latitude: 50.1, longitude: 14.1, visited: false }], []]
      );
      fireEvent.click(screen.getByText('Log Visit'));

      await waitFor(() => expect(raceApi.logVisitWithImage).toHaveBeenCalled());
      const formData = raceApi.logVisitWithImage.mock.calls[0][1];
      expect(formData.get('checkpoint_id')).toBe('4');
      expect(formData.get('team_id')).toBe('10');
      expect(formData.get('user_latitude')).toBe('50.123');
      expect(formData.get('user_longitude')).toBe('14.456');
      expect(raceApi.getCheckpointsStatus).toHaveBeenCalledTimes(2);
    });

    test('allows logging without location when geolocation is unavailable', async () => {
      mockGeolocation.getCurrentPosition.mockImplementationOnce((_success, error) => error({ message: 'Denied' }));
      raceApi.logVisitWithImage.mockResolvedValue({});
      await renderWithCheckpoint(
        { id: 5, title: 'No Location', latitude: 50.1, longitude: 14.1, visited: false },
        { state: 'LOGGING' },
        [[{ id: 5, title: 'No Location', latitude: 50.1, longitude: 14.1, visited: false }], []]
      );
      fireEvent.click(screen.getByText('Log Visit'));

      await waitFor(() => expect(raceApi.logVisitWithImage).toHaveBeenCalled());
      const formData = raceApi.logVisitWithImage.mock.calls[0][1];
      expect(formData.get('user_latitude')).toBeNull();
      expect(formData.get('user_longitude')).toBeNull();
    });

    test('deletes a visited checkpoint and refreshes the list', async () => {
      raceApi.deleteVisit.mockResolvedValue({});
      await renderWithCheckpoint(
        { id: 6, title: 'Delete Visit', latitude: 50.1, longitude: 14.1, visited: true },
        { state: 'LOGGING' },
        [[{ id: 6, title: 'Delete Visit', latitude: 50.1, longitude: 14.1, visited: true }], []]
      );
      fireEvent.click(screen.getByRole('button', { name: 'Delete Visit' }));

      await waitFor(() => {
        expect(raceApi.deleteVisit).toHaveBeenCalledWith(1, { checkpoint_id: 6, team_id: 10 });
        expect(raceApi.getCheckpointsStatus).toHaveBeenCalledTimes(2);
      });
    });

    test('shows an error toast when checkpoint logging fails', async () => {
      await renderWithCheckpoint({ id: 7, title: 'Failed Visit', latitude: 50.1, longitude: 14.1, visited: false });
      raceApi.logVisitWithImage.mockRejectedValue(new Error('Network error'));

      fireEvent.click(screen.getByText('Log Visit'));

      await waitFor(() => expect(screen.getByText(/Failed to log visit: Network error/i)).toBeInTheDocument());
    });
  });

  describe('Image, retry, cleanup, and layout', () => {
    test('shows the selected image filename and preview', async () => {
      await renderWithCheckpoint({ id: 8, title: 'Image Checkpoint', latitude: 50.1, longitude: 14.1, visited: false });
      const file = new File(['image'], 'checkpoint.jpg', { type: 'image/jpeg' });
      const input = document.querySelector('input[type="file"]');

      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText('checkpoint.jpg')).toBeInTheDocument();
        expect(screen.getByAltText('Preview')).toBeInTheDocument();
      });
    });

    test('shows the retry control after loading fails and retries successfully', async () => {
      raceApi.getCheckpointsStatus
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce([]);
      renderList();

      await waitFor(() => expect(screen.getByText('Retry')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Retry'));

      await waitFor(() => {
        expect(raceApi.getCheckpointsStatus).toHaveBeenCalledTimes(2);
        expect(screen.getByText('Checkpoints loaded successfully')).toBeInTheDocument();
      });
    });

    test('clears the geolocation watch on unmount', () => {
      const { unmount } = renderList();

      unmount();

      expect(mockGeolocation.clearWatch).toHaveBeenCalledWith(1);
    });

    test('uses the default and custom top offsets', () => {
      renderList({ state: 'LOGGING' });
      expect(screen.getByText('Logging open').closest('div')).toHaveStyle({ top: '64px' });

      cleanup();
      vi.spyOn(TimeContext, 'useTime').mockReturnValue({
        activeRace: { race_id: 1, team_id: 10 },
        timeInfo: { state: 'SHOW_ONLY' },
        selectedLanguage: 'en',
      });
      render(<CheckpointsList topOffset={100} />);
      expect(screen.getByText('Read-only').closest('div')).toHaveStyle({ top: '108px' });
    });
  });
});