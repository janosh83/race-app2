import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

import * as TimeContext from '../contexts/TimeContext';
import * as activeRaceUtils from '../utils/activeRaceUtils';
import { isTokenExpired, logoutAndRedirect } from '../utils/api';

import ActiveRace from './ActiveRace';


// Mock utilities
vi.mock('../utils/api');
vi.mock('../utils/activeRaceUtils');

describe('ActiveRace Component', () => {
  const mockSetActiveRace = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.useFakeTimers();
    isTokenExpired.mockReturnValue(false);
    activeRaceUtils.findCandidates.mockReturnValue([]);
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  const renderWithContext = (timeValue) => {
    vi.spyOn(TimeContext, 'useTime').mockReturnValue(timeValue);
    return render(
      <TimeContext.TimeProvider>
        <ActiveRace />
      </TimeContext.TimeProvider>
    );
  };

  describe('Token expiry checking', () => {
    test('checks token on mount and redirects if expired', () => {
      localStorage.setItem('accessToken', 'expired-token');
      isTokenExpired.mockReturnValue(true);

      renderWithContext({
        activeRace: null,
        setActiveRace: mockSetActiveRace,
        signedRaces: [],
      });

      expect(isTokenExpired).toHaveBeenCalledWith('expired-token', 5);
      expect(logoutAndRedirect).toHaveBeenCalled();
    });

    test('does not redirect if token is valid', () => {
      localStorage.setItem('accessToken', 'valid-token');
      isTokenExpired.mockReturnValue(false);

      renderWithContext({
        activeRace: null,
        setActiveRace: mockSetActiveRace,
        signedRaces: [],
      });

      expect(logoutAndRedirect).not.toHaveBeenCalled();
    });

    test('checks token periodically every 30 seconds', () => {
      localStorage.setItem('accessToken', 'test-token');
      isTokenExpired.mockReturnValue(false);

      renderWithContext({
        activeRace: null,
        setActiveRace: mockSetActiveRace,
        signedRaces: [],
      });

      expect(isTokenExpired).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(30000);
      expect(isTokenExpired).toHaveBeenCalledTimes(2);
    });

    test('does nothing if no token exists', () => {
      localStorage.removeItem('accessToken');

      renderWithContext({
        activeRace: null,
        setActiveRace: mockSetActiveRace,
        signedRaces: [],
      });

      expect(isTokenExpired).not.toHaveBeenCalled();
    });
  });

  describe('Rendering with no active race', () => {
    test('displays warning when no active race and no candidates', () => {
      activeRaceUtils.findCandidates.mockReturnValue([]);

      renderWithContext({
        activeRace: null,
        setActiveRace: mockSetActiveRace,
        signedRaces: [],
      });

      expect(screen.getByText('There are no races currently showing checkpoints.')).toBeInTheDocument();
    });

    test('displays message when no active race but multiple candidates exist', () => {
      const candidates = [
        { race_id: 1, name: 'Race 1' },
        { race_id: 2, name: 'Race 2' },
      ];
      activeRaceUtils.findCandidates.mockReturnValue(candidates);

      renderWithContext({
        activeRace: null,
        setActiveRace: mockSetActiveRace,
        signedRaces: candidates,
      });

      expect(screen.getByText('No active race selected.')).toBeInTheDocument();
      expect(screen.getByText('Multiple races are currently active — please choose one from the list below.')).toBeInTheDocument();
    });
  });

  describe('Auto-selection behavior', () => {
    test('auto-selects race when only one candidate exists', () => {
      const singleCandidate = {
        race_id: 1,
        name: 'Only Race',
        start_showing_checkpoints_at: '2026-01-01',
        end_showing_checkpoints_at: '2026-01-31',
      };

      activeRaceUtils.findCandidates.mockReturnValue([singleCandidate]);

      renderWithContext({
        activeRace: null,
        setActiveRace: mockSetActiveRace,
        signedRaces: [singleCandidate],
      });

      expect(mockSetActiveRace).toHaveBeenCalledWith(singleCandidate);
    });

    test('does not auto-select when active race already exists', () => {
      const activeRace = { race_id: 1, name: 'Active Race' };
      const candidate = { race_id: 2, name: 'Other Race' };

      activeRaceUtils.findCandidates.mockReturnValue([candidate]);

      renderWithContext({
        activeRace: activeRace,
        setActiveRace: mockSetActiveRace,
        signedRaces: [activeRace, candidate],
      });

      expect(mockSetActiveRace).not.toHaveBeenCalled();
    });
  });

  describe('Active race display', () => {
    test('displays active race details correctly', () => {
      const activeRace = { race_id: 1, name: 'Current Race' };
      activeRaceUtils.findCandidates.mockReturnValue([]);

      renderWithContext({
        activeRace: activeRace,
        setActiveRace: mockSetActiveRace,
        signedRaces: [activeRace],
      });

      expect(screen.getByText('Current Race')).toBeInTheDocument();
    });

    test('shows note that map, checkpoints, tasks, and results use the selected race', () => {
      const activeRace = { race_id: 1, name: 'Current Race' };
      activeRaceUtils.findCandidates.mockReturnValue([]);

      renderWithContext({
        activeRace,
        setActiveRace: mockSetActiveRace,
        signedRaces: [activeRace],
      });

      expect(screen.getByText('Map, checkpoints, tasks, and results are shown for the selected race.')).toBeInTheDocument();
    });

    test('shows the current phase of the selected race', () => {
      const activeRace = { race_id: 1, name: 'Current Race' };
      activeRaceUtils.findCandidates.mockReturnValue([]);

      renderWithContext({
        activeRace,
        setActiveRace: mockSetActiveRace,
        signedRaces: [activeRace],
        timeInfo: { state: 'LOGGING' },
      });

      expect(screen.getByText('Logging open')).toBeInTheDocument();
      expect(screen.getByText('Current phase')).toBeInTheDocument();
      expect(screen.getByText('Checkpoint visibility')).toBeInTheDocument();
      expect(screen.getByText('Logging window')).toBeInTheDocument();
    });

    test('handles alternative property names for race data', () => {
      const activeRace = { id: 3, name: 'Race With ID' };
      activeRaceUtils.findCandidates.mockReturnValue([]);

      renderWithContext({
        activeRace: activeRace,
        setActiveRace: mockSetActiveRace,
        signedRaces: [activeRace],
      });

      expect(screen.getByText('Race With ID')).toBeInTheDocument();
    });

    test('displays default text for unnamed races', () => {
      const activeRace = { race_id: 1 };
      activeRaceUtils.findCandidates.mockReturnValue([]);

      renderWithContext({
        activeRace: activeRace,
        setActiveRace: mockSetActiveRace,
        signedRaces: [activeRace],
      });

      expect(screen.getByText('Unnamed race')).toBeInTheDocument();
    });
  });

  describe('Other races list', () => {
    test('displays other signed races excluding active race', () => {
      const activeRace = { race_id: 1, name: 'Active Race' };
      const otherRace1 = { race_id: 2, name: 'Other Race 1' };
      const otherRace2 = { race_id: 3, name: 'Other Race 2' };
      activeRaceUtils.findCandidates.mockReturnValue([]);

      renderWithContext({
        activeRace: activeRace,
        setActiveRace: mockSetActiveRace,
        signedRaces: [activeRace, otherRace1, otherRace2],
      });

      expect(screen.getByText('Other Race 1')).toBeInTheDocument();
      expect(screen.getByText('Other Race 2')).toBeInTheDocument();
    });

    test('shows "No other races" when only active race exists', () => {
      const activeRace = { race_id: 1, name: 'Active Race' };
      activeRaceUtils.findCandidates.mockReturnValue([]);

      renderWithContext({
        activeRace: activeRace,
        setActiveRace: mockSetActiveRace,
        signedRaces: [activeRace],
      });

      expect(screen.getByText('No other races.')).toBeInTheDocument();
    });

    test('shows "Currently showing" badge for candidate races', () => {
      const activeRace = { race_id: 1, name: 'Active Race' };
      const candidateRace = { race_id: 2, name: 'Candidate Race' };
      activeRaceUtils.findCandidates.mockReturnValue([candidateRace]);

      renderWithContext({
        activeRace: activeRace,
        setActiveRace: mockSetActiveRace,
        signedRaces: [activeRace, candidateRace],
      });

      expect(screen.getByText('Currently showing')).toBeInTheDocument();
    });

    test('shows time status for non-active races', () => {
      const now = new Date('2026-04-21T12:00:00Z').getTime();
      vi.setSystemTime(now);

      const activeRace = { race_id: 1, name: 'Active Race' };
      const otherRace = {
        race_id: 2,
        name: 'Other Race',
        start_showing_checkpoints_at: '2026-04-21T10:00:00Z',
        start_logging_at: '2026-04-21T11:00:00Z',
        end_logging_at: '2026-04-21T13:00:00Z',
        end_showing_checkpoints_at: '2026-04-21T14:00:00Z',
      };
      activeRaceUtils.findCandidates.mockReturnValue([]);

      renderWithContext({
        activeRace,
        setActiveRace: mockSetActiveRace,
        signedRaces: [activeRace, otherRace],
        timeInfo: { state: 'UNKNOWN' },
      });

      expect(screen.getByText('Other Race')).toBeInTheDocument();
      expect(screen.getByText('Logging open')).toBeInTheDocument();
    });
  });

  describe('Race selection', () => {
    test('allows selecting a different race from the list', () => {
      const activeRace = { race_id: 1, name: 'Active Race' };
      const otherRace = { race_id: 2, name: 'Other Race' };
      activeRaceUtils.findCandidates.mockReturnValue([]);

      renderWithContext({
        activeRace: activeRace,
        setActiveRace: mockSetActiveRace,
        signedRaces: [activeRace, otherRace],
      });

      const selectButton = screen.getAllByRole('button', { name: 'Select' })[0];
      fireEvent.click(selectButton);

      expect(mockSetActiveRace).toHaveBeenCalledWith(otherRace);
    });
  });
});
