import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import Standings from './Standings';
import { raceApi } from '../services/raceApi';
import { isTokenExpired, logoutAndRedirect } from '../utils/api';

// Mock dependencies
jest.mock('../services/raceApi');
jest.mock('../utils/api');

describe('Standings Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Token management', () => {
    test('checks token expiry on mount', async () => {
      localStorage.setItem('accessToken', 'test-token');
      localStorage.setItem('activeRace', JSON.stringify({ race_id: 1 }));
      isTokenExpired.mockReturnValue(false);
      raceApi.getResults.mockResolvedValue([]);

      render(<Standings />);

      expect(isTokenExpired).toHaveBeenCalledWith('test-token', 5);
      expect(logoutAndRedirect).not.toHaveBeenCalled();
    });

    test('redirects on expired token', async () => {
      localStorage.setItem('accessToken', 'expired-token');
      localStorage.setItem('activeRace', JSON.stringify({ race_id: 1 }));
      isTokenExpired.mockReturnValue(true);
      raceApi.getResults.mockResolvedValue([]);

      render(<Standings />);

      expect(logoutAndRedirect).toHaveBeenCalled();
    });

    test('checks token periodically every 30 seconds', async () => {
      localStorage.setItem('accessToken', 'test-token');
      localStorage.setItem('activeRace', JSON.stringify({ race_id: 1 }));
      isTokenExpired.mockReturnValue(false);
      raceApi.getResults.mockResolvedValue([]);

      render(<Standings />);

      expect(isTokenExpired).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(30000);
      expect(isTokenExpired).toHaveBeenCalledTimes(2);
    });
  });

  describe('Loading state', () => {
    test('shows loading message while fetching', () => {
      localStorage.setItem('activeRace', JSON.stringify({ race_id: 1 }));
      raceApi.getResults.mockImplementation(() => new Promise(() => {})); // never resolves

      render(<Standings />);

      expect(screen.getByText('Loading results...')).toBeInTheDocument();
    });
  });

  describe('Active race detection', () => {
    test('shows error when no active race is set', async () => {
      localStorage.removeItem('activeRace');

      render(<Standings />);

      await waitFor(() => {
        expect(screen.getByText('No active race found.')).toBeInTheDocument();
      });
    });

    test('fetches results using race_id property', async () => {
      localStorage.setItem('activeRace', JSON.stringify({ race_id: 5 }));
      raceApi.getResults.mockResolvedValue([]);

      render(<Standings />);

      await waitFor(() => {
        expect(raceApi.getResults).toHaveBeenCalledWith(5);
      });
    });

    test('fetches results using id property when race_id not available', async () => {
      localStorage.setItem('activeRace', JSON.stringify({ id: 7 }));
      raceApi.getResults.mockResolvedValue([]);

      render(<Standings />);

      await waitFor(() => {
        expect(raceApi.getResults).toHaveBeenCalledWith(7);
      });
    });

    test('fetches results using raceId property as fallback', async () => {
      localStorage.setItem('activeRace', JSON.stringify({ raceId: 9 }));
      raceApi.getResults.mockResolvedValue([]);

      render(<Standings />);

      await waitFor(() => {
        expect(raceApi.getResults).toHaveBeenCalledWith(9);
      });
    });
  });

  describe('Results display', () => {
    test('displays results table with correct data', async () => {
      localStorage.setItem('activeRace', JSON.stringify({ race_id: 1 }));
      const mockResults = [
        {
          team: 'Team A',
          category: 'Category 1',
          points_for_checkpoints: 50,
          points_for_tasks: 30,
          total_points: 80,
        },
        {
          team: 'Team B',
          category: 'Category 2',
          points_for_checkpoints: 40,
          points_for_tasks: 20,
          total_points: 60,
        },
      ];
      raceApi.getResults.mockResolvedValue(mockResults);

      render(<Standings />);

      await waitFor(() => {
        expect(screen.getByText('Team A')).toBeInTheDocument();
        expect(screen.getByText('Team B')).toBeInTheDocument();
        expect(screen.getByText('Category 1')).toBeInTheDocument();
        expect(screen.getByText('Category 2')).toBeInTheDocument();
      });
    });

    test('displays correct column headers', async () => {
      localStorage.setItem('activeRace', JSON.stringify({ race_id: 1 }));
      const mockResults = [
        { team: 'Team A', total_points: 80, points_for_checkpoints: 50, points_for_tasks: 30, category: 'Cat 1' },
      ];
      raceApi.getResults.mockResolvedValue(mockResults);

      render(<Standings />);

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText('Loading results...')).not.toBeInTheDocument();
      });

      expect(screen.getByText('#')).toBeInTheDocument();
      expect(screen.getByText('Team')).toBeInTheDocument();
      expect(screen.getByText('Category')).toBeInTheDocument();
      expect(screen.getByText('Points for Checkpoints')).toBeInTheDocument();
      expect(screen.getByText('Points for Tasks')).toBeInTheDocument();
      expect(screen.getByText('Total Points')).toBeInTheDocument();
    });

    test('shows message when no results available', async () => {
      localStorage.setItem('activeRace', JSON.stringify({ race_id: 1 }));
      raceApi.getResults.mockResolvedValue([]);

      render(<Standings />);

      await waitFor(() => {
        expect(screen.getByText('No results available for this race.')).toBeInTheDocument();
      });
    });
  });

  describe('Ranking calculation', () => {
    test('ranks teams by total points descending', async () => {
      localStorage.setItem('activeRace', JSON.stringify({ race_id: 1 }));
      const mockResults = [
        {
          team: 'Team C',
          total_points: 50,
          points_for_checkpoints: 30,
          points_for_tasks: 20,
        },
        {
          team: 'Team A',
          total_points: 80,
          points_for_checkpoints: 50,
          points_for_tasks: 30,
        },
        {
          team: 'Team B',
          total_points: 60,
          points_for_checkpoints: 40,
          points_for_tasks: 20,
        },
      ];
      raceApi.getResults.mockResolvedValue(mockResults);

      render(<Standings />);

      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        // Skip header row, check data rows
        expect(rows[1]).toHaveTextContent('1'); // Rank
        expect(rows[1]).toHaveTextContent('Team A'); // Highest points
        expect(rows[2]).toHaveTextContent('2');
        expect(rows[2]).toHaveTextContent('Team B');
        expect(rows[3]).toHaveTextContent('3');
        expect(rows[3]).toHaveTextContent('Team C'); // Lowest points
      });
    });

    test('uses checkpoint points as tiebreaker', async () => {
      localStorage.setItem('activeRace', JSON.stringify({ race_id: 1 }));
      const mockResults = [
        {
          team: 'Team A',
          total_points: 80,
          points_for_checkpoints: 60, // More checkpoint points
          points_for_tasks: 20,
        },
        {
          team: 'Team B',
          total_points: 80,
          points_for_checkpoints: 50, // Fewer checkpoint points
          points_for_tasks: 30,
        },
      ];
      raceApi.getResults.mockResolvedValue(mockResults);

      render(<Standings />);

      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        expect(rows[1]).toHaveTextContent('Team A'); // Team A should be first
        expect(rows[2]).toHaveTextContent('Team B');
      });
    });

    test('uses alphabetical team name as final tiebreaker', async () => {
      localStorage.setItem('activeRace', JSON.stringify({ race_id: 1 }));
      const mockResults = [
        {
          team: 'Team Z',
          total_points: 80,
          points_for_checkpoints: 50,
          points_for_tasks: 30,
        },
        {
          team: 'Team A',
          total_points: 80,
          points_for_checkpoints: 50,
          points_for_tasks: 30,
        },
      ];
      raceApi.getResults.mockResolvedValue(mockResults);

      render(<Standings />);

      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        expect(rows[1]).toHaveTextContent('Team A'); // Alphabetically first
        expect(rows[2]).toHaveTextContent('Team Z');
      });
    });

    test('assigns same rank to teams with identical points', async () => {
      localStorage.setItem('activeRace', JSON.stringify({ race_id: 1 }));
      const mockResults = [
        {
          team: 'Team A',
          total_points: 80,
          points_for_checkpoints: 50,
          points_for_tasks: 30,
        },
        {
          team: 'Team B',
          total_points: 80,
          points_for_checkpoints: 50,
          points_for_tasks: 30,
        },
        {
          team: 'Team C',
          total_points: 60,
          points_for_checkpoints: 40,
          points_for_tasks: 20,
        },
      ];
      raceApi.getResults.mockResolvedValue(mockResults);

      render(<Standings />);

      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        expect(rows[1]).toHaveTextContent(/^1/); // Both teams tied for 1st
        expect(rows[2]).toHaveTextContent(/^1/);
        expect(rows[3]).toHaveTextContent(/^3/); // Next team is 3rd (not 2nd)
      });
    });

    test('handles missing or null point values', async () => {
      localStorage.setItem('activeRace', JSON.stringify({ race_id: 1 }));
      const mockResults = [
        {
          team: 'Team A',
          total_points: null,
          points_for_checkpoints: null,
          points_for_tasks: null,
        },
        {
          team: 'Team B',
          total_points: 50,
          points_for_checkpoints: 30,
          points_for_tasks: 20,
        },
      ];
      raceApi.getResults.mockResolvedValue(mockResults);

      render(<Standings />);

      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        // Team B should be ranked higher due to having points
        expect(rows[1]).toHaveTextContent('Team B');
        expect(rows[2]).toHaveTextContent('Team A');
      });
    });
  });

  describe('Error handling', () => {
    test('displays error message when API call fails', async () => {
      localStorage.setItem('activeRace', JSON.stringify({ race_id: 1 }));
      raceApi.getResults.mockRejectedValue(new Error('Network error'));

      render(<Standings />);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    test('displays generic error when error has no message', async () => {
      localStorage.setItem('activeRace', JSON.stringify({ race_id: 1 }));
      raceApi.getResults.mockRejectedValue({});

      render(<Standings />);

      await waitFor(() => {
        expect(screen.getByText('Failed to fetch results')).toBeInTheDocument();
      });
    });
  });

  describe('API response normalization', () => {
    test('handles direct array response', async () => {
      localStorage.setItem('activeRace', JSON.stringify({ race_id: 1 }));
      const mockResults = [
        { team: 'Team A', total_points: 80, points_for_checkpoints: 50, points_for_tasks: 30 },
      ];
      raceApi.getResults.mockResolvedValue(mockResults);

      render(<Standings />);

      await waitFor(() => {
        expect(screen.getByText('Team A')).toBeInTheDocument();
      });
    });

    test('handles response with data property', async () => {
      localStorage.setItem('activeRace', JSON.stringify({ race_id: 1 }));
      const mockResults = {
        data: [
          { team: 'Team A', total_points: 80, points_for_checkpoints: 50, points_for_tasks: 30 },
        ],
      };
      raceApi.getResults.mockResolvedValue(mockResults);

      render(<Standings />);

      await waitFor(() => {
        expect(screen.getByText('Team A')).toBeInTheDocument();
      });
    });

    test('handles response with results property', async () => {
      localStorage.setItem('activeRace', JSON.stringify({ race_id: 1 }));
      const mockResults = {
        results: [
          { team: 'Team A', total_points: 80, points_for_checkpoints: 50, points_for_tasks: 30 },
        ],
      };
      raceApi.getResults.mockResolvedValue(mockResults);

      render(<Standings />);

      await waitFor(() => {
        expect(screen.getByText('Team A')).toBeInTheDocument();
      });
    });

    test('handles response with standings property', async () => {
      localStorage.setItem('activeRace', JSON.stringify({ race_id: 1 }));
      const mockResults = {
        standings: [
          { team: 'Team A', total_points: 80, points_for_checkpoints: 50, points_for_tasks: 30 },
        ],
      };
      raceApi.getResults.mockResolvedValue(mockResults);

      render(<Standings />);

      await waitFor(() => {
        expect(screen.getByText('Team A')).toBeInTheDocument();
      });
    });

    test('handles non-array response by defaulting to empty array', async () => {
      localStorage.setItem('activeRace', JSON.stringify({ race_id: 1 }));
      raceApi.getResults.mockResolvedValue({ someOtherProperty: 'value' });

      render(<Standings />);

      await waitFor(() => {
        expect(screen.getByText('No results available for this race.')).toBeInTheDocument();
      });
    });
  });

  describe('Component rendering', () => {
    test('renders heading', async () => {
      localStorage.setItem('activeRace', JSON.stringify({ race_id: 1 }));
      raceApi.getResults.mockResolvedValue([]);

      render(<Standings />);

      await waitFor(() => {
        expect(screen.getByText('Race Results')).toBeInTheDocument();
      });
    });

    test('renders table structure', async () => {
      localStorage.setItem('activeRace', JSON.stringify({ race_id: 1 }));
      const mockResults = [
        { team: 'Team A', total_points: 80, points_for_checkpoints: 50, points_for_tasks: 30, category: 'Cat 1' },
      ];
      raceApi.getResults.mockResolvedValue(mockResults);

      render(<Standings />);

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
        expect(screen.getByRole('row', { name: /Team A/i })).toBeInTheDocument();
      });
    });
  });
});
