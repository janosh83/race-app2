import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import * as TimeContext from '../contexts/TimeContext';
import ActiveRace from './ActiveRace';
import { isTokenExpired, logoutAndRedirect } from '../utils/api';
import * as activeRaceUtils from '../utils/activeRaceUtils';

// Mock utilities
jest.mock('../utils/api');
jest.mock('../utils/activeRaceUtils');

describe('ActiveRace Component', () => {
  const mockSetActiveRace = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    jest.useFakeTimers();
    isTokenExpired.mockReturnValue(false);
    activeRaceUtils.findCandidates.mockReturnValue([]);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  const renderWithContext = (timeValue) => {
    jest.spyOn(TimeContext, 'useTime').mockReturnValue(timeValue);
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

      jest.advanceTimersByTime(30000);
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
