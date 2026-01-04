import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TimeProvider } from '../contexts/TimeContext';
import ActiveRace from './ActiveRace';
import { isTokenExpired, logoutAndRedirect } from '../utils/api';
import * as activeRaceUtils from '../utils/activeRaceUtils';

// Mock utilities
jest.mock('../utils/api');
jest.mock('../utils/activeRaceUtils');

// Mock TimeContext
const mockSetActiveRace = jest.fn();
const mockSignedRaces = [];

jest.mock('../contexts/TimeContext', () => ({
  ...jest.requireActual('../contexts/TimeContext'),
  useTime: () => ({
    activeRace: null,
    setActiveRace: mockSetActiveRace,
    signedRaces: mockSignedRaces,
  }),
  formatDate: (date) => date || 'N/A',
}));

describe('ActiveRace Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Token expiry checking', () => {
    test('checks token on mount and redirects if expired', () => {
      localStorage.setItem('accessToken', 'expired-token');
      isTokenExpired.mockReturnValue(true);
      activeRaceUtils.findCandidates.mockReturnValue([]);

      render(<ActiveRace />);

      expect(isTokenExpired).toHaveBeenCalledWith('expired-token', 5);
      expect(logoutAndRedirect).toHaveBeenCalled();
    });

    test('does not redirect if token is valid', () => {
      localStorage.setItem('accessToken', 'valid-token');
      isTokenExpired.mockReturnValue(false);
      activeRaceUtils.findCandidates.mockReturnValue([]);

      render(<ActiveRace />);

      expect(isTokenExpired).toHaveBeenCalledWith('valid-token', 5);
      expect(logoutAndRedirect).not.toHaveBeenCalled();
    });

    test('checks token periodically every 30 seconds', () => {
      localStorage.setItem('accessToken', 'valid-token');
      isTokenExpired.mockReturnValue(false);
      activeRaceUtils.findCandidates.mockReturnValue([]);

      render(<ActiveRace />);

      expect(isTokenExpired).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(30000);
      expect(isTokenExpired).toHaveBeenCalledTimes(2);

      jest.advanceTimersByTime(30000);
      expect(isTokenExpired).toHaveBeenCalledTimes(3);
    });

    test('does nothing if no token exists', () => {
      localStorage.removeItem('accessToken');
      activeRaceUtils.findCandidates.mockReturnValue([]);

      render(<ActiveRace />);

      expect(isTokenExpired).not.toHaveBeenCalled();
      expect(logoutAndRedirect).not.toHaveBeenCalled();
    });
  });

  describe('Rendering with no active race', () => {
    test('displays warning when no active race and no candidates', () => {
      activeRaceUtils.findCandidates.mockReturnValue([]);
      
      render(<ActiveRace />);

      expect(screen.getByText('No active race selected.')).toBeInTheDocument();
      expect(screen.getByText('There are no races currently showing checkpoints.')).toBeInTheDocument();
    });

    test('displays message when no active race but multiple candidates exist', () => {
      const candidates = [
        { race_id: 1, name: 'Race 1' },
        { race_id: 2, name: 'Race 2' },
      ];
      activeRaceUtils.findCandidates.mockReturnValue(candidates);

      // Need to mock the hook properly for this test
      const useTimeMock = require('../contexts/TimeContext').useTime;
      useTimeMock.mockReturnValue({
        activeRace: null,
        setActiveRace: mockSetActiveRace,
        signedRaces: candidates,
      });

      render(<ActiveRace />);

      expect(screen.getByText('No active race selected.')).toBeInTheDocument();
      expect(screen.getByText('Multiple races are currently active — please choose one from the list below.')).toBeInTheDocument();
    });
  });

  describe('Auto-selection behavior', () => {
    test('auto-selects race when only one candidate exists', () => {
      const singleCandidate = {
        race_id: 1,
        name: 'Solo Race',
        description: 'Only race',
        start_showing_checkpoints_at: '2026-01-01',
        end_showing_checkpoints_at: '2026-01-31',
        start_logging_at: '2026-01-01',
        end_logging_at: '2026-01-31',
      };
      
      activeRaceUtils.findCandidates.mockReturnValue([singleCandidate]);

      const useTimeMock = require('../contexts/TimeContext').useTime;
      useTimeMock.mockReturnValue({
        activeRace: null,
        setActiveRace: mockSetActiveRace,
        signedRaces: [singleCandidate],
      });

      render(<ActiveRace />);

      expect(mockSetActiveRace).toHaveBeenCalledWith(singleCandidate);
    });

    test('does not auto-select when active race already exists', () => {
      const activeRace = { race_id: 1, name: 'Active Race' };
      const candidate = { race_id: 2, name: 'Other Race' };
      
      activeRaceUtils.findCandidates.mockReturnValue([candidate]);

      const useTimeMock = require('../contexts/TimeContext').useTime;
      useTimeMock.mockReturnValue({
        activeRace: activeRace,
        setActiveRace: mockSetActiveRace,
        signedRaces: [activeRace, candidate],
      });

      render(<ActiveRace />);

      expect(mockSetActiveRace).not.toHaveBeenCalled();
    });
  });

  describe('Active race display', () => {
    test('displays active race details correctly', () => {
      const activeRace = {
        race_id: 1,
        name: 'Test Race',
        description: 'Test Description',
        start_showing_checkpoints_at: '2026-01-01T10:00:00',
        end_showing_checkpoints_at: '2026-01-31T18:00:00',
        start_logging_at: '2026-01-01T10:00:00',
        end_logging_at: '2026-01-31T18:00:00',
      };

      activeRaceUtils.findCandidates.mockReturnValue([activeRace]);

      const useTimeMock = require('../contexts/TimeContext').useTime;
      useTimeMock.mockReturnValue({
        activeRace: activeRace,
        setActiveRace: mockSetActiveRace,
        signedRaces: [activeRace],
      });

      render(<ActiveRace />);

      expect(screen.getByText('Test Race')).toBeInTheDocument();
      expect(screen.getByText('Test Description')).toBeInTheDocument();
      expect(screen.getByText(/Start showing checkpoints:/)).toBeInTheDocument();
      expect(screen.getByText(/End showing checkpoints:/)).toBeInTheDocument();
      expect(screen.getByText(/Start logging:/)).toBeInTheDocument();
      expect(screen.getByText(/End logging:/)).toBeInTheDocument();
    });

    test('handles alternative property names for race data', () => {
      const activeRace = {
        id: 1,
        race_name: 'Alternative Name Race',
        race_description: 'Alternative Description',
        start_showing_checkpoints: '2026-01-01',
        end_showing_checkpoints: '2026-01-31',
        start_logging: '2026-01-01',
        end_logging: '2026-01-31',
      };

      activeRaceUtils.findCandidates.mockReturnValue([activeRace]);

      const useTimeMock = require('../contexts/TimeContext').useTime;
      useTimeMock.mockReturnValue({
        activeRace: activeRace,
        setActiveRace: mockSetActiveRace,
        signedRaces: [activeRace],
      });

      render(<ActiveRace />);

      expect(screen.getByText('Alternative Name Race')).toBeInTheDocument();
      expect(screen.getByText('Alternative Description')).toBeInTheDocument();
    });

    test('displays default text for unnamed races', () => {
      const activeRace = {
        race_id: 1,
        // No name or race_name
        start_showing_checkpoints_at: '2026-01-01',
        end_showing_checkpoints_at: '2026-01-31',
        start_logging_at: '2026-01-01',
        end_logging_at: '2026-01-31',
      };

      activeRaceUtils.findCandidates.mockReturnValue([activeRace]);

      const useTimeMock = require('../contexts/TimeContext').useTime;
      useTimeMock.mockReturnValue({
        activeRace: activeRace,
        setActiveRace: mockSetActiveRace,
        signedRaces: [activeRace],
      });

      render(<ActiveRace />);

      expect(screen.getByText('Unnamed race')).toBeInTheDocument();
    });
  });

  describe('Other races list', () => {
    test('displays other signed races excluding active race', () => {
      const activeRace = { race_id: 1, name: 'Active Race' };
      const otherRace1 = { race_id: 2, name: 'Other Race 1' };
      const otherRace2 = { race_id: 3, name: 'Other Race 2' };

      activeRaceUtils.findCandidates.mockReturnValue([activeRace]);

      const useTimeMock = require('../contexts/TimeContext').useTime;
      useTimeMock.mockReturnValue({
        activeRace: activeRace,
        setActiveRace: mockSetActiveRace,
        signedRaces: [activeRace, otherRace1, otherRace2],
      });

      render(<ActiveRace />);

      expect(screen.getByText('Other Race 1')).toBeInTheDocument();
      expect(screen.getByText('Other Race 2')).toBeInTheDocument();
      expect(screen.queryByText('Active Race')).toBeInTheDocument(); // In active race section
    });

    test('shows "No other races" when only active race exists', () => {
      const activeRace = { race_id: 1, name: 'Only Race' };

      activeRaceUtils.findCandidates.mockReturnValue([activeRace]);

      const useTimeMock = require('../contexts/TimeContext').useTime;
      useTimeMock.mockReturnValue({
        activeRace: activeRace,
        setActiveRace: mockSetActiveRace,
        signedRaces: [activeRace],
      });

      render(<ActiveRace />);

      expect(screen.getByText('No other races.')).toBeInTheDocument();
    });

    test('shows "Currently showing" badge for candidate races', () => {
      const activeRace = { race_id: 1, name: 'Active Race' };
      const candidateRace = { race_id: 2, name: 'Candidate Race' };

      activeRaceUtils.findCandidates.mockReturnValue([activeRace, candidateRace]);

      const useTimeMock = require('../contexts/TimeContext').useTime;
      useTimeMock.mockReturnValue({
        activeRace: activeRace,
        setActiveRace: mockSetActiveRace,
        signedRaces: [activeRace, candidateRace],
      });

      render(<ActiveRace />);

      expect(screen.getByText('Currently showing')).toBeInTheDocument();
    });
  });

  describe('Race selection', () => {
    test('allows selecting a different race from the list', () => {
      const activeRace = { race_id: 1, name: 'Active Race' };
      const otherRace = { 
        race_id: 2, 
        name: 'Other Race',
        start_showing_checkpoints_at: '2026-01-01',
        end_showing_checkpoints_at: '2026-01-31',
        start_logging_at: '2026-01-01',
        end_logging_at: '2026-01-31',
      };

      activeRaceUtils.findCandidates.mockReturnValue([activeRace, otherRace]);

      const useTimeMock = require('../contexts/TimeContext').useTime;
      useTimeMock.mockReturnValue({
        activeRace: activeRace,
        setActiveRace: mockSetActiveRace,
        signedRaces: [activeRace, otherRace],
      });

      render(<ActiveRace />);

      const selectButtons = screen.getAllByRole('button', { name: /select/i });
      fireEvent.click(selectButtons[0]);

      expect(mockSetActiveRace).toHaveBeenCalledWith(otherRace);
    });
  });
});
