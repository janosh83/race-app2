import { render, screen, fireEvent, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';

import * as TimeContext from '../contexts/TimeContext';
import * as activeRaceUtils from '../utils/activeRaceUtils';

import ActiveRace from './ActiveRace';


// Mock utilities
vi.mock('../utils/api');
vi.mock('../utils/activeRaceUtils');

function LocationProbe() {
  return <div data-testid="location">{useLocation().pathname}</div>;
}

describe('ActiveRace Component', () => {
  const mockSetActiveRace = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.useFakeTimers();
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
        <MemoryRouter>
          <ActiveRace />
          <LocationProbe />
        </MemoryRouter>
      </TimeContext.TimeProvider>
    );
  };

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
      expect(screen.getByText('Multiple races are currently active - please choose one from the list below.')).toBeInTheDocument();
    });
  });

  describe('Auto-selection behavior', () => {
    // Auto-selection lives in TimeContext.syncSignedRaces; the page only renders it.
    test('does not select a race itself when exactly one candidate exists', () => {
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

      expect(mockSetActiveRace).not.toHaveBeenCalled();
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
      expect(screen.getByRole('link', { name: 'Map' })).toHaveAttribute('href', '/race/1/map');
      expect(screen.getByRole('link', { name: 'Checkpoints' })).toHaveAttribute('href', '/race/1/checkpoints');
      expect(screen.getByRole('link', { name: 'Tasks' })).toHaveAttribute('href', '/race/1/tasks');
    });

    test('shows the team, category and members with the user first', () => {
      localStorage.setItem('user', JSON.stringify({ id: 2, name: 'Eva Nováková' }));
      const activeRace = {
        race_id: 1,
        name: 'Current Race',
        team_name: 'Rychlé šípy',
        race_category: 'Rodiny',
        team_members: [{ id: 1, name: 'Jan Novák' }, { id: 2, name: 'Eva Nováková' }],
      };

      renderWithContext({
        activeRace,
        setActiveRace: mockSetActiveRace,
        signedRaces: [activeRace],
      });

      expect(screen.getByText('Your team')).toBeInTheDocument();
      expect(screen.getByText('Rychlé šípy')).toBeInTheDocument();
      expect(screen.getByText('Rodiny')).toBeInTheDocument();
      const members = within(screen.getByRole('list', { name: 'Team members' })).getAllByRole('listitem');
      expect(members.map(li => li.textContent)).toEqual(['Eva Nováková (you)', 'Jan Novák']);
    });

    test('shows no team section when the race has no team data', () => {
      const activeRace = { race_id: 1, name: 'Current Race' };

      renderWithContext({
        activeRace,
        setActiveRace: mockSetActiveRace,
        signedRaces: [activeRace],
      });

      expect(screen.queryByText('Your team')).not.toBeInTheDocument();
    });

    test('shows team and category on other races', () => {
      const activeRace = { race_id: 1, name: 'Current Race' };
      const otherRace = { race_id: 2, name: 'Other Race', team_name: 'Old Team', race_category: 'Sport' };

      renderWithContext({
        activeRace,
        setActiveRace: mockSetActiveRace,
        signedRaces: [activeRace, otherRace],
      });

      expect(screen.getByText('Old Team · Sport')).toBeInTheDocument();
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

    test('groups other races into running now, upcoming and past', () => {
      vi.setSystemTime(new Date('2026-05-01T12:00:00Z'));
      const activeRace = { race_id: 1, name: 'Active Race' };
      const runningRace = { race_id: 2, name: 'Running Race' };
      const upcomingRace = {
        race_id: 3,
        name: 'Upcoming Race',
        start_showing_checkpoints: '2026-06-01T08:00:00Z',
        end_showing_checkpoints: '2026-06-01T18:00:00Z',
      };
      const pastRace = {
        race_id: 4,
        name: 'Past Race',
        start_showing_checkpoints: '2025-06-01T08:00:00Z',
        end_showing_checkpoints: '2025-06-01T18:00:00Z',
      };
      activeRaceUtils.findCandidates.mockReturnValue([activeRace, runningRace]);

      renderWithContext({
        activeRace,
        setActiveRace: mockSetActiveRace,
        signedRaces: [activeRace, runningRace, upcomingRace, pastRace],
      });

      const group = (name) => screen.getByRole('region', { name: new RegExp(name) });
      expect(within(group('Running now')).getByText('Running Race')).toBeInTheDocument();
      expect(within(group('Upcoming')).getByText('Upcoming Race')).toBeInTheDocument();
      expect(within(group('Past races')).getByText('Past Race')).toBeInTheDocument();
      expect(within(group('Past races')).getByRole('button', { name: 'Open' })).toBeInTheDocument();
      // The selected race is shown on top, not repeated in a group.
      expect(within(group('Running now')).queryByText('Active Race')).not.toBeInTheDocument();
    });

    test('opens the map after selecting a running race', () => {
      const activeRace = { race_id: 1, name: 'Active Race' };
      const runningRace = { race_id: 2, name: 'Running Race' };
      activeRaceUtils.findCandidates.mockReturnValue([activeRace, runningRace]);

      renderWithContext({
        activeRace,
        setActiveRace: mockSetActiveRace,
        signedRaces: [activeRace, runningRace],
      });

      fireEvent.click(screen.getByRole('button', { name: 'Select' }));

      expect(mockSetActiveRace).toHaveBeenCalledWith(runningRace);
      expect(screen.getByTestId('location')).toHaveTextContent('/race/2/map');
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
