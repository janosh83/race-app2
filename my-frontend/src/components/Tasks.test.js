import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Tasks from './Tasks';
import { raceApi } from '../services/raceApi';
import { isTokenExpired, logoutAndRedirect } from '../utils/api';
import * as TimeContext from '../contexts/TimeContext';

// Mock dependencies
jest.mock('../services/raceApi');
jest.mock('../utils/api');
jest.mock('piexifjs', () => ({
  load: jest.fn(() => ({})),
  dump: jest.fn(() => ''),
  insert: jest.fn((exif, dataUrl) => dataUrl),
}));

describe('Tasks Component', () => {
  const mockTasks = [
    {
      id: 1,
      title: 'Task 1',
      description: 'Description 1',
      numOfPoints: 10,
      completed: false,
    },
    {
      id: 2,
      title: 'Task 2',
      description: 'Description 2',
      numOfPoints: 20,
      completed: true,
      image_filename: 'task2.jpg',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    jest.useFakeTimers();

    // Mock TimeContext
    jest.spyOn(TimeContext, 'useTime').mockReturnValue({
      activeRace: { race_id: 1, team_id: 10 },
      timeInfo: { state: 'LOGGING' },
    });

    jest.spyOn(TimeContext, 'formatDate').mockImplementation((date) => date || 'N/A');

    // Mock environment variables
    process.env.REACT_APP_API_URL = 'http://test-api.com';
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Token management', () => {
    test('checks token expiry on mount', () => {
      localStorage.setItem('accessToken', 'test-token');
      isTokenExpired.mockReturnValue(false);
      raceApi.getTasksStatus.mockResolvedValue([]);

      render(<Tasks />);

      expect(isTokenExpired).toHaveBeenCalledWith('test-token', 5);
      expect(logoutAndRedirect).not.toHaveBeenCalled();
    });

    test('redirects on expired token', () => {
      localStorage.setItem('accessToken', 'expired-token');
      isTokenExpired.mockReturnValue(true);
      raceApi.getTasksStatus.mockResolvedValue([]);

      render(<Tasks />);

      expect(logoutAndRedirect).toHaveBeenCalled();
    });

    test('checks token periodically every 30 seconds', () => {
      localStorage.setItem('accessToken', 'test-token');
      isTokenExpired.mockReturnValue(false);
      raceApi.getTasksStatus.mockResolvedValue([]);

      render(<Tasks />);

      expect(isTokenExpired).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(30000);
      expect(isTokenExpired).toHaveBeenCalledTimes(2);
    });
  });

  describe('Tasks fetching', () => {
    test('fetches tasks when activeRace is set', async () => {
      raceApi.getTasksStatus.mockResolvedValue(mockTasks);

      render(<Tasks />);

      await waitFor(() => {
        expect(raceApi.getTasksStatus).toHaveBeenCalledWith(1, 10);
      });
    });

    test('does not fetch tasks when no activeRace', () => {
      jest.spyOn(TimeContext, 'useTime').mockReturnValue({
        activeRace: null,
        timeInfo: { state: 'LOGGING' },
      });

      render(<Tasks />);

      expect(raceApi.getTasksStatus).not.toHaveBeenCalled();
    });

    test('does not fetch tasks when no team_id', () => {
      jest.spyOn(TimeContext, 'useTime').mockReturnValue({
        activeRace: { race_id: 1 },
        timeInfo: { state: 'LOGGING' },
      });

      render(<Tasks />);

      expect(raceApi.getTasksStatus).not.toHaveBeenCalled();
    });
  });

  describe('UI rendering', () => {
    test('displays tasks list', async () => {
      raceApi.getTasksStatus.mockResolvedValue(mockTasks);

      render(<Tasks />);

      await waitFor(() => {
        expect(screen.getByText('Task 1')).toBeInTheDocument();
        expect(screen.getByText('Task 2')).toBeInTheDocument();
      });
    });

    test('displays task details correctly', async () => {
      raceApi.getTasksStatus.mockResolvedValue(mockTasks);

      render(<Tasks />);

      await waitFor(() => {
        expect(screen.getByText('Description 1')).toBeInTheDocument();
        expect(screen.getByText('10 pts')).toBeInTheDocument();
        expect(screen.getByText('20 pts')).toBeInTheDocument();
      });
    });

    test('shows completed badge for completed tasks', async () => {
      raceApi.getTasksStatus.mockResolvedValue(mockTasks);

      render(<Tasks />);

      await waitFor(() => {
        expect(screen.getByText('Completed')).toBeInTheDocument();
        expect(screen.getByText('Pending')).toBeInTheDocument();
      });
    });

    test('shows photo attached indicator for completed tasks with images', async () => {
      raceApi.getTasksStatus.mockResolvedValue(mockTasks);

      render(<Tasks />);

      await waitFor(() => {
        expect(screen.getByText('📷 Photo attached')).toBeInTheDocument();
      });
    });

    test('displays message when no tasks available', async () => {
      raceApi.getTasksStatus.mockResolvedValue([]);

      render(<Tasks />);

      await waitFor(() => {
        expect(screen.getByText('No tasks available for this race.')).toBeInTheDocument();
      });
    });
  });

  describe('Logging state badge', () => {
    test('shows "Logging open" badge when logging is allowed', async () => {
      raceApi.getTasksStatus.mockResolvedValue([]);

      render(<Tasks />);

      expect(screen.getByText('Logging open')).toBeInTheDocument();
    });

    test('shows "Read-only" badge when logging is not allowed', async () => {
      jest.spyOn(TimeContext, 'useTime').mockReturnValue({
        activeRace: { race_id: 1, team_id: 10 },
        timeInfo: { state: 'SHOW_ONLY' },
      });
      raceApi.getTasksStatus.mockResolvedValue([]);

      render(<Tasks />);

      expect(screen.getByText('Read-only')).toBeInTheDocument();
    });
  });

  describe('Task overlay', () => {
    test('opens task overlay when task card is clicked', async () => {
      raceApi.getTasksStatus.mockResolvedValue(mockTasks);

      render(<Tasks />);

      await waitFor(() => {
        expect(screen.getByText('Task 1')).toBeInTheDocument();
      });

      const taskCard = screen.getByText('Task 1').closest('.card');
      fireEvent.click(taskCard);

      expect(screen.getByText('✕ Close')).toBeInTheDocument();
    });

    test('displays task details in overlay', async () => {
      raceApi.getTasksStatus.mockResolvedValue(mockTasks);

      render(<Tasks />);

      await waitFor(() => {
        expect(screen.getByText('Task 1')).toBeInTheDocument();
      });

      const taskCard = screen.getByText('Task 1').closest('.card');
      fireEvent.click(taskCard);

      // Should have heading with task title
      const headings = screen.getAllByText('Task 1');
      expect(headings.length).toBeGreaterThan(1); // one in list, one in overlay
    });

    test('closes overlay when close button is clicked', async () => {
      raceApi.getTasksStatus.mockResolvedValue(mockTasks);

      render(<Tasks />);

      await waitFor(() => {
        expect(screen.getByText('Task 1')).toBeInTheDocument();
      });

      const taskCard = screen.getByText('Task 1').closest('.card');
      fireEvent.click(taskCard);

      const closeButton = screen.getByText('✕ Close');
      fireEvent.click(closeButton);

      expect(screen.queryByText('✕ Close')).not.toBeInTheDocument();
    });

    test('shows completion photo in overlay for completed tasks', async () => {
      raceApi.getTasksStatus.mockResolvedValue(mockTasks);

      render(<Tasks />);

      await waitFor(() => {
        expect(screen.getByText('Task 2')).toBeInTheDocument();
      });

      const taskCard = screen.getByText('Task 2').closest('.card');
      fireEvent.click(taskCard);

      expect(screen.getByText('Completion Photo:')).toBeInTheDocument();
      const img = screen.getByAltText('Completion photo');
      expect(img).toHaveAttribute('src', 'http://test-api.com/static/images/task2.jpg');
    });

    test('shows warning message when logging is closed', async () => {
      jest.spyOn(TimeContext, 'useTime').mockReturnValue({
        activeRace: { race_id: 1, team_id: 10 },
        timeInfo: { state: 'SHOW_ONLY' },
      });
      raceApi.getTasksStatus.mockResolvedValue(mockTasks);

      render(<Tasks />);

      await waitFor(() => {
        expect(screen.getByText('Task 1')).toBeInTheDocument();
      });

      const taskCard = screen.getByText('Task 1').closest('.card');
      fireEvent.click(taskCard);

      expect(screen.getByText('Logging window is closed. You can only view tasks.')).toBeInTheDocument();
    });
  });

  describe('Task logging', () => {
    test('shows "Mark as completed" button for pending tasks', async () => {
      raceApi.getTasksStatus.mockResolvedValue(mockTasks);

      render(<Tasks />);

      await waitFor(() => {
        expect(screen.getByText('Task 1')).toBeInTheDocument();
      });

      const taskCard = screen.getByText('Task 1').closest('.card');
      fireEvent.click(taskCard);

      expect(screen.getByText('Mark as completed')).toBeInTheDocument();
    });

    test('shows "Re-upload / Update" button for completed tasks', async () => {
      raceApi.getTasksStatus.mockResolvedValue(mockTasks);

      render(<Tasks />);

      await waitFor(() => {
        expect(screen.getByText('Task 2')).toBeInTheDocument();
      });

      const taskCard = screen.getByText('Task 2').closest('.card');
      fireEvent.click(taskCard);

      expect(screen.getByText('Re-upload / Update')).toBeInTheDocument();
    });

    test('shows "Delete completion" button for completed tasks', async () => {
      raceApi.getTasksStatus.mockResolvedValue(mockTasks);

      render(<Tasks />);

      await waitFor(() => {
        expect(screen.getByText('Task 2')).toBeInTheDocument();
      });

      const taskCard = screen.getByText('Task 2').closest('.card');
      fireEvent.click(taskCard);

      expect(screen.getByText('Delete completion')).toBeInTheDocument();
    });

    test('disables buttons when logging is not allowed', async () => {
      jest.spyOn(TimeContext, 'useTime').mockReturnValue({
        activeRace: { race_id: 1, team_id: 10 },
        timeInfo: { state: 'SHOW_ONLY' },
      });
      raceApi.getTasksStatus.mockResolvedValue(mockTasks);

      render(<Tasks />);

      await waitFor(() => {
        expect(screen.getByText('Task 1')).toBeInTheDocument();
      });

      const taskCard = screen.getByText('Task 1').closest('.card');
      fireEvent.click(taskCard);

      const completeButton = screen.getByText('Mark as completed');
      expect(completeButton).toBeDisabled();
    });

    test('logs task completion successfully', async () => {
      raceApi.getTasksStatus.mockResolvedValue(mockTasks);
      raceApi.logTaskWithImage.mockResolvedValue({});

      render(<Tasks />);

      await waitFor(() => {
        expect(screen.getByText('Task 1')).toBeInTheDocument();
      });

      const taskCard = screen.getByText('Task 1').closest('.card');
      fireEvent.click(taskCard);

      const completeButton = screen.getByText('Mark as completed');
      fireEvent.click(completeButton);

      await waitFor(() => {
        expect(raceApi.logTaskWithImage).toHaveBeenCalled();
        expect(raceApi.getTasksStatus).toHaveBeenCalledTimes(2); // initial + refresh
      });
    });

    test('deletes task completion successfully', async () => {
      raceApi.getTasksStatus.mockResolvedValue(mockTasks);
      raceApi.deleteTaskCompletion.mockResolvedValue({});

      render(<Tasks />);

      await waitFor(() => {
        expect(screen.getByText('Task 2')).toBeInTheDocument();
      });

      const taskCard = screen.getByText('Task 2').closest('.card');
      fireEvent.click(taskCard);

      const deleteButton = screen.getByText('Delete completion');
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(raceApi.deleteTaskCompletion).toHaveBeenCalledWith(1, {
          task_id: 2,
          team_id: 10,
        });
        expect(raceApi.getTasksStatus).toHaveBeenCalledTimes(2); // initial + refresh
      });
    });

    test('shows error alert when task logging fails', async () => {
      raceApi.getTasksStatus.mockResolvedValue(mockTasks);
      raceApi.logTaskWithImage.mockRejectedValue(new Error('Network error'));
      
      // Mock window.alert
      const alertMock = jest.spyOn(window, 'alert').mockImplementation(() => {});

      render(<Tasks />);

      await waitFor(() => {
        expect(screen.getByText('Task 1')).toBeInTheDocument();
      });

      const taskCard = screen.getByText('Task 1').closest('.card');
      fireEvent.click(taskCard);

      const completeButton = screen.getByText('Mark as completed');
      fireEvent.click(completeButton);

      await waitFor(() => {
        expect(alertMock).toHaveBeenCalledWith('Network error');
      });

      alertMock.mockRestore();
    });
  });

  describe('Image handling', () => {
    test('shows file input for image upload', async () => {
      raceApi.getTasksStatus.mockResolvedValue(mockTasks);

      render(<Tasks />);

      await waitFor(() => {
        expect(screen.getByText('Task 1')).toBeInTheDocument();
      });

      const taskCard = screen.getByText('Task 1').closest('.card');
      fireEvent.click(taskCard);

      const fileInput = screen.getByLabelText('Upload photo (optional)');
      expect(fileInput).toBeInTheDocument();
      expect(fileInput).toHaveAttribute('type', 'file');
      expect(fileInput).toHaveAttribute('accept', 'image/*');
    });

    test('shows help text about image resizing', async () => {
      raceApi.getTasksStatus.mockResolvedValue(mockTasks);

      render(<Tasks />);

      await waitFor(() => {
        expect(screen.getByText('Task 1')).toBeInTheDocument();
      });

      const taskCard = screen.getByText('Task 1').closest('.card');
      fireEvent.click(taskCard);

      expect(screen.getByText('Images are resized to max 1000px, EXIF preserved for JPEG.')).toBeInTheDocument();
    });
  });

  describe('Upload overlay', () => {
    test('does not show upload overlay initially', async () => {
      raceApi.getTasksStatus.mockResolvedValue([]);

      render(<Tasks />);

      expect(screen.queryByText('Uploading...')).not.toBeInTheDocument();
    });

    test('shows upload overlay during task logging', async () => {
      raceApi.getTasksStatus.mockResolvedValue(mockTasks);
      raceApi.logTaskWithImage.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({}), 100))
      );

      render(<Tasks />);

      await waitFor(() => {
        expect(screen.getByText('Task 1')).toBeInTheDocument();
      });

      const taskCard = screen.getByText('Task 1').closest('.card');
      fireEvent.click(taskCard);

      const completeButton = screen.getByText('Mark as completed');
      fireEvent.click(completeButton);

      await waitFor(() => {
        expect(screen.getByText('Uploading...')).toBeInTheDocument();
      });
    });
  });

  describe('Custom topOffset prop', () => {
    test('uses default topOffset of 56', async () => {
      raceApi.getTasksStatus.mockResolvedValue([]);

      render(<Tasks />);

      const badge = screen.getByText('Logging open').closest('div');
      expect(badge).toHaveStyle({ top: '64px' }); // 56 + 8
    });

    test('uses custom topOffset when provided', async () => {
      raceApi.getTasksStatus.mockResolvedValue([]);

      render(<Tasks topOffset={100} />);

      const badge = screen.getByText('Logging open').closest('div');
      expect(badge).toHaveStyle({ top: '108px' }); // 100 + 8
    });
  });
});
