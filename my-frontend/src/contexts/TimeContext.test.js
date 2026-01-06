import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { TimeProvider, useTime, formatDate } from './TimeContext';
import { apiFetch } from '../utils/api';

// Mock apiFetch
jest.mock('../utils/api');

// Helper component to test the context
function TestComponent() {
  const { activeRace, setActiveRace, timeInfo, signedRaces, setSignedRaces, refreshSignedRaces } = useTime();
  
  return (
    <div>
      <div data-testid="active-race">{activeRace ? JSON.stringify(activeRace) : 'null'}</div>
      <div data-testid="time-state">{timeInfo.state}</div>
      <div data-testid="signed-races">{JSON.stringify(signedRaces)}</div>
      <button onClick={() => setActiveRace({ race_id: 1, name: 'Test Race' })}>Set Active Race</button>
      <button onClick={() => setActiveRace(null)}>Clear Active Race</button>
      <button onClick={() => setSignedRaces([{ race_id: 1 }, { race_id: 2 }])}>Set Signed Races</button>
      <button onClick={refreshSignedRaces}>Refresh Races</button>
    </div>
  );
}

describe('TimeContext', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('TimeProvider initialization', () => {
    test('loads activeRace from localStorage on mount', () => {
      const storedRace = { race_id: 5, name: 'Stored Race' };
      localStorage.setItem('activeRace', JSON.stringify(storedRace));

      render(
        <TimeProvider>
          <TestComponent />
        </TimeProvider>
      );

      expect(screen.getByTestId('active-race')).toHaveTextContent(JSON.stringify(storedRace));
    });

    test('loads signedRaces from localStorage on mount', () => {
      const storedRaces = [{ race_id: 1 }, { race_id: 2 }];
      localStorage.setItem('signedRaces', JSON.stringify(storedRaces));

      render(
        <TimeProvider>
          <TestComponent />
        </TimeProvider>
      );

      expect(screen.getByTestId('signed-races')).toHaveTextContent(JSON.stringify(storedRaces));
    });

    test('initializes with null activeRace when localStorage is empty', () => {
      render(
        <TimeProvider>
          <TestComponent />
        </TimeProvider>
      );

      expect(screen.getByTestId('active-race')).toHaveTextContent('null');
    });

    test('initializes with empty array for signedRaces when localStorage is empty', () => {
      render(
        <TimeProvider>
          <TestComponent />
        </TimeProvider>
      );

      expect(screen.getByTestId('signed-races')).toHaveTextContent('[]');
    });

    test('handles corrupted localStorage data gracefully', () => {
      localStorage.setItem('activeRace', 'invalid-json');
      localStorage.setItem('signedRaces', 'invalid-json');

      render(
        <TimeProvider>
          <TestComponent />
        </TimeProvider>
      );

      expect(screen.getByTestId('active-race')).toHaveTextContent('null');
      expect(screen.getByTestId('signed-races')).toHaveTextContent('[]');
    });
  });

  describe('setActiveRace', () => {
    test('updates activeRace state', () => {
      render(
        <TimeProvider>
          <TestComponent />
        </TimeProvider>
      );

      const button = screen.getByText('Set Active Race');
      act(() => {
        button.click();
      });

      expect(screen.getByTestId('active-race')).toHaveTextContent('race_id');
    });

    test('persists activeRace to localStorage', () => {
      render(
        <TimeProvider>
          <TestComponent />
        </TimeProvider>
      );

      const button = screen.getByText('Set Active Race');
      act(() => {
        button.click();
      });

      const stored = JSON.parse(localStorage.getItem('activeRace'));
      expect(stored).toEqual({ race_id: 1, name: 'Test Race' });
    });

    test('removes activeRace from localStorage when set to null', () => {
      localStorage.setItem('activeRace', JSON.stringify({ race_id: 1 }));

      render(
        <TimeProvider>
          <TestComponent />
        </TimeProvider>
      );

      const button = screen.getByText('Clear Active Race');
      act(() => {
        button.click();
      });

      expect(localStorage.getItem('activeRace')).toBeNull();
      expect(screen.getByTestId('active-race')).toHaveTextContent('null');
    });
  });

  describe('setSignedRaces', () => {
    test('updates signedRaces state', () => {
      render(
        <TimeProvider>
          <TestComponent />
        </TimeProvider>
      );

      const button = screen.getByText('Set Signed Races');
      act(() => {
        button.click();
      });

      expect(screen.getByTestId('signed-races')).toHaveTextContent('[{"race_id":1},{"race_id":2}]');
    });

    test('persists signedRaces to localStorage', () => {
      render(
        <TimeProvider>
          <TestComponent />
        </TimeProvider>
      );

      const button = screen.getByText('Set Signed Races');
      act(() => {
        button.click();
      });

      const stored = JSON.parse(localStorage.getItem('signedRaces'));
      expect(stored).toEqual([{ race_id: 1 }, { race_id: 2 }]);
    });

    test('handles null input by storing empty array', () => {
      const TestSetter = () => {
        const { setSignedRaces } = useTime();
        return <button onClick={() => setSignedRaces(null)}>Set Null</button>;
      };

      render(
        <TimeProvider>
          <TestSetter />
        </TimeProvider>
      );

      const button = screen.getByText('Set Null');
      act(() => {
        button.click();
      });

      const stored = JSON.parse(localStorage.getItem('signedRaces'));
      expect(stored).toEqual([]);
    });
  });

  describe('time state calculation', () => {
    test('calculates BEFORE_SHOW state correctly', () => {
      const futureRace = {
        race_id: 1,
        start_showing_checkpoints_at: new Date(Date.now() + 86400000).toISOString(), // tomorrow
        end_showing_checkpoints_at: new Date(Date.now() + 172800000).toISOString(),
        start_logging_at: new Date(Date.now() + 90000000).toISOString(),
        end_logging_at: new Date(Date.now() + 100000000).toISOString(),
      };

      localStorage.setItem('activeRace', JSON.stringify(futureRace));

      render(
        <TimeProvider>
          <TestComponent />
        </TimeProvider>
      );

      expect(screen.getByTestId('time-state')).toHaveTextContent('BEFORE_SHOW');
    });

    test('calculates SHOW_ONLY state correctly', () => {
      const now = Date.now();
      const showOnlyRace = {
        race_id: 1,
        start_showing_checkpoints_at: new Date(now - 3600000).toISOString(), // 1 hour ago
        end_showing_checkpoints_at: new Date(now + 86400000).toISOString(),
        start_logging_at: new Date(now + 3600000).toISOString(), // 1 hour from now
        end_logging_at: new Date(now + 7200000).toISOString(),
      };

      localStorage.setItem('activeRace', JSON.stringify(showOnlyRace));

      render(
        <TimeProvider>
          <TestComponent />
        </TimeProvider>
      );

      expect(screen.getByTestId('time-state')).toHaveTextContent('SHOW_ONLY');
    });

    test('calculates LOGGING state correctly', () => {
      const now = Date.now();
      const loggingRace = {
        race_id: 1,
        start_showing_checkpoints_at: new Date(now - 7200000).toISOString(),
        end_showing_checkpoints_at: new Date(now + 86400000).toISOString(),
        start_logging_at: new Date(now - 3600000).toISOString(), // started 1 hour ago
        end_logging_at: new Date(now + 3600000).toISOString(), // ends in 1 hour
      };

      localStorage.setItem('activeRace', JSON.stringify(loggingRace));

      render(
        <TimeProvider>
          <TestComponent />
        </TimeProvider>
      );

      expect(screen.getByTestId('time-state')).toHaveTextContent('LOGGING');
    });

    test('calculates POST_LOG_SHOW state correctly', () => {
      const now = Date.now();
      const postLogRace = {
        race_id: 1,
        start_showing_checkpoints_at: new Date(now - 86400000).toISOString(),
        end_showing_checkpoints_at: new Date(now + 3600000).toISOString(), // ends in 1 hour
        start_logging_at: new Date(now - 7200000).toISOString(),
        end_logging_at: new Date(now - 3600000).toISOString(), // ended 1 hour ago
      };

      localStorage.setItem('activeRace', JSON.stringify(postLogRace));

      render(
        <TimeProvider>
          <TestComponent />
        </TimeProvider>
      );

      expect(screen.getByTestId('time-state')).toHaveTextContent('POST_LOG_SHOW');
    });

    test('calculates AFTER_SHOW state correctly', () => {
      const now = Date.now();
      const afterShowRace = {
        race_id: 1,
        start_showing_checkpoints_at: new Date(now - 172800000).toISOString(),
        end_showing_checkpoints_at: new Date(now - 3600000).toISOString(), // ended 1 hour ago
        start_logging_at: new Date(now - 86400000).toISOString(),
        end_logging_at: new Date(now - 7200000).toISOString(),
      };

      localStorage.setItem('activeRace', JSON.stringify(afterShowRace));

      render(
        <TimeProvider>
          <TestComponent />
        </TimeProvider>
      );

      expect(screen.getByTestId('time-state')).toHaveTextContent('AFTER_SHOW');
    });

    test('returns UNKNOWN state when race times are missing', () => {
      const incompleteRace = {
        race_id: 1,
        name: 'Incomplete Race',
      };

      localStorage.setItem('activeRace', JSON.stringify(incompleteRace));

      render(
        <TimeProvider>
          <TestComponent />
        </TimeProvider>
      );

      expect(screen.getByTestId('time-state')).toHaveTextContent('UNKNOWN');
    });
  });

  describe('time state updates', () => {
    test('recalculates time state every 15 seconds', () => {
      const now = Date.now();
      const race = {
        race_id: 1,
        start_showing_checkpoints_at: new Date(now - 3600000).toISOString(),
        end_showing_checkpoints_at: new Date(now + 86400000).toISOString(),
        start_logging_at: new Date(now + 100).toISOString(), // very soon
        end_logging_at: new Date(now + 3600000).toISOString(),
      };

      localStorage.setItem('activeRace', JSON.stringify(race));

      render(
        <TimeProvider>
          <TestComponent />
        </TimeProvider>
      );

      expect(screen.getByTestId('time-state')).toHaveTextContent('SHOW_ONLY');

      // Advance time by 15 seconds
      act(() => {
        jest.advanceTimersByTime(15000);
      });

      // State should be recalculated and now be LOGGING
      expect(screen.getByTestId('time-state')).toHaveTextContent('LOGGING');
    });
  });

  describe('refreshSignedRaces', () => {
    test('fetches signed races from API', async () => {
      const mockRaces = [
        { race_id: 1, name: 'Race 1' },
        { race_id: 2, name: 'Race 2' },
      ];
      
      apiFetch.mockResolvedValue({ signed_races: mockRaces });

      render(
        <TimeProvider>
          <TestComponent />
        </TimeProvider>
      );

      const button = screen.getByText('Refresh Races');
      
      act(() => {
        button.click();
      });

      await waitFor(() => {
        expect(apiFetch).toHaveBeenCalledWith('/api/user/signed-races/');
        expect(screen.getByTestId('signed-races')).toHaveTextContent(JSON.stringify(mockRaces));
      });
    });

    test('updates activeRace if it exists in refreshed data', async () => {
      const oldRaceData = { race_id: 1, name: 'Old Name', team_id: 10 };
      const newRaceData = { race_id: 1, name: 'Updated Name', team_id: 10 };
      
      localStorage.setItem('activeRace', JSON.stringify(oldRaceData));
      apiFetch.mockResolvedValue({ signed_races: [newRaceData] });

      render(
        <TimeProvider>
          <TestComponent />
        </TimeProvider>
      );

      const button = screen.getByText('Refresh Races');
      
      act(() => {
        button.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('active-race')).toHaveTextContent('Updated Name');
      });
    });

    test('handles API errors gracefully', async () => {
      apiFetch.mockRejectedValue(new Error('Network error'));

      render(
        <TimeProvider>
          <TestComponent />
        </TimeProvider>
      );

      const button = screen.getByText('Refresh Races');
      
      await act(async () => {
        button.click();
      });

      // Should not crash and state should remain unchanged
      expect(screen.getByTestId('signed-races')).toHaveTextContent('[]');
    });

    test('refreshes on window focus', async () => {
      apiFetch.mockResolvedValue({ signed_races: [{ race_id: 1 }] });

      render(
        <TimeProvider>
          <TestComponent />
        </TimeProvider>
      );

      await act(async () => {
        window.dispatchEvent(new Event('focus'));
      });

      await waitFor(() => {
        expect(apiFetch).toHaveBeenCalled();
      });
    });

    test('refreshes when tab becomes visible', async () => {
      apiFetch.mockResolvedValue({ signed_races: [{ race_id: 1 }] });

      render(
        <TimeProvider>
          <TestComponent />
        </TimeProvider>
      );

      Object.defineProperty(document, 'visibilityState', {
        writable: true,
        value: 'visible',
      });

      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      await waitFor(() => {
        expect(apiFetch).toHaveBeenCalled();
      });
    });
  });

  describe('useTime hook', () => {
    test('throws error when used outside TimeProvider', () => {
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => {
        render(<TestComponent />);
      }).toThrow('useTime must be used within a TimeProvider');

      consoleSpy.mockRestore();
    });
  });
});

describe('formatDate utility', () => {
  test('formats timestamp as locale string', () => {
    const timestamp = new Date('2026-01-15T12:00:00Z').getTime();
    const result = formatDate(timestamp);
    
    expect(result).toContain('2026');
    expect(result).not.toBe('—');
  });

  test('formats ISO string as locale string', () => {
    const isoString = '2026-01-15T12:00:00Z';
    const result = formatDate(isoString);
    
    expect(result).toContain('2026');
    expect(result).not.toBe('—');
  });

  test('returns dash for null input', () => {
    expect(formatDate(null)).toBe('—');
  });

  test('returns dash for undefined input', () => {
    expect(formatDate(undefined)).toBe('—');
  });

  test('returns dash for empty string', () => {
    expect(formatDate('')).toBe('—');
  });

  test('returns dash for 0', () => {
    expect(formatDate(0)).toBe('—');
  });
});
