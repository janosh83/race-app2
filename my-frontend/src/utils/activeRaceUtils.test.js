import { findCandidates, selectActiveRace } from './activeRaceUtils';

describe('activeRaceUtils', () => {
  describe('findCandidates', () => {
    const mockNow = new Date('2026-01-15T12:00:00Z').getTime();

    beforeEach(() => {
      jest.spyOn(Date, 'now').mockReturnValue(mockNow);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('returns empty array for empty input', () => {
      expect(findCandidates([])).toEqual([]);
    });

    test('returns empty array for undefined input', () => {
      expect(findCandidates()).toEqual([]);
    });

    test('returns empty array for null input', () => {
      expect(findCandidates(null)).toEqual([]);
    });

    test('returns race that is currently active', () => {
      const races = [
        {
          race_id: 1,
          start_showing_checkpoints_at: '2026-01-10T10:00:00Z',
          end_showing_checkpoints_at: '2026-01-20T18:00:00Z',
        }
      ];

      const result = findCandidates(races);
      expect(result).toHaveLength(1);
      expect(result[0].race_id).toBe(1);
    });

    test('filters out race that has not started yet', () => {
      const races = [
        {
          race_id: 1,
          start_showing_checkpoints_at: '2026-01-16T10:00:00Z', // tomorrow
          end_showing_checkpoints_at: '2026-01-20T18:00:00Z',
        }
      ];

      expect(findCandidates(races)).toEqual([]);
    });

    test('filters out race that has already ended', () => {
      const races = [
        {
          race_id: 1,
          start_showing_checkpoints_at: '2026-01-01T10:00:00Z',
          end_showing_checkpoints_at: '2026-01-10T18:00:00Z', // ended 5 days ago
        }
      ];

      expect(findCandidates(races)).toEqual([]);
    });

    test('includes race starting exactly now', () => {
      const races = [
        {
          race_id: 1,
          start_showing_checkpoints_at: '2026-01-15T12:00:00Z', // exactly now
          end_showing_checkpoints_at: '2026-01-20T18:00:00Z',
        }
      ];

      expect(findCandidates(races)).toHaveLength(1);
    });

    test('includes race ending exactly now', () => {
      const races = [
        {
          race_id: 1,
          start_showing_checkpoints_at: '2026-01-10T10:00:00Z',
          end_showing_checkpoints_at: '2026-01-15T12:00:00Z', // exactly now
        }
      ];

      expect(findCandidates(races)).toHaveLength(1);
    });

    test('returns multiple active races', () => {
      const races = [
        {
          race_id: 1,
          start_showing_checkpoints_at: '2026-01-10T10:00:00Z',
          end_showing_checkpoints_at: '2026-01-20T18:00:00Z',
        },
        {
          race_id: 2,
          start_showing_checkpoints_at: '2026-01-12T10:00:00Z',
          end_showing_checkpoints_at: '2026-01-18T18:00:00Z',
        }
      ];

      const result = findCandidates(races);
      expect(result).toHaveLength(2);
      expect(result.map(r => r.race_id)).toEqual([1, 2]);
    });

    test('filters mixed active and inactive races', () => {
      const races = [
        {
          race_id: 1,
          start_showing_checkpoints_at: '2026-01-10T10:00:00Z',
          end_showing_checkpoints_at: '2026-01-20T18:00:00Z', // active
        },
        {
          race_id: 2,
          start_showing_checkpoints_at: '2026-01-01T10:00:00Z',
          end_showing_checkpoints_at: '2026-01-05T18:00:00Z', // ended
        },
        {
          race_id: 3,
          start_showing_checkpoints_at: '2026-01-20T10:00:00Z',
          end_showing_checkpoints_at: '2026-01-25T18:00:00Z', // future
        }
      ];

      const result = findCandidates(races);
      expect(result).toHaveLength(1);
      expect(result[0].race_id).toBe(1);
    });

    describe('handles alternative property names', () => {
      test('uses start_showing_checkpoints if available', () => {
        const races = [
          {
            race_id: 1,
            start_showing_checkpoints: '2026-01-10T10:00:00Z',
            end_showing_checkpoints: '2026-01-20T18:00:00Z',
          }
        ];

        expect(findCandidates(races)).toHaveLength(1);
      });

      test('falls back to start_showing if _at not available', () => {
        const races = [
          {
            race_id: 1,
            start_showing: '2026-01-10T10:00:00Z',
            end_showing: '2026-01-20T18:00:00Z',
          }
        ];

        expect(findCandidates(races)).toHaveLength(1);
      });

      test('falls back to start_logging as last resort', () => {
        const races = [
          {
            race_id: 1,
            start_logging: '2026-01-10T10:00:00Z',
            end_logging: '2026-01-20T18:00:00Z',
          }
        ];

        expect(findCandidates(races)).toHaveLength(1);
      });
    });

    test('filters out race with missing start date', () => {
      const races = [
        {
          race_id: 1,
          end_showing_checkpoints_at: '2026-01-20T18:00:00Z',
        }
      ];

      expect(findCandidates(races)).toEqual([]);
    });

    test('filters out race with missing end date', () => {
      const races = [
        {
          race_id: 1,
          start_showing_checkpoints_at: '2026-01-10T10:00:00Z',
        }
      ];

      expect(findCandidates(races)).toEqual([]);
    });

    test('filters out race with invalid date format', () => {
      const races = [
        {
          race_id: 1,
          start_showing_checkpoints_at: 'invalid-date',
          end_showing_checkpoints_at: '2026-01-20T18:00:00Z',
        }
      ];

      expect(findCandidates(races)).toEqual([]);
    });

    test('filters out race with null dates', () => {
      const races = [
        {
          race_id: 1,
          start_showing_checkpoints_at: null,
          end_showing_checkpoints_at: null,
        }
      ];

      expect(findCandidates(races)).toEqual([]);
    });
  });

  describe('selectActiveRace', () => {
    const mockNow = new Date('2026-01-15T12:00:00Z').getTime();

    beforeEach(() => {
      jest.spyOn(Date, 'now').mockReturnValue(mockNow);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('returns null for empty array', () => {
      const result = selectActiveRace([]);
      expect(result).toEqual({
        activeRaceId: null,
        candidates: []
      });
    });

    test('returns null for non-array input', () => {
      const result = selectActiveRace(null);
      expect(result).toEqual({
        activeRaceId: null,
        candidates: []
      });
    });

    test('returns race ID when exactly one candidate', () => {
      const races = [
        {
          race_id: 5,
          start_showing_checkpoints_at: '2026-01-10T10:00:00Z',
          end_showing_checkpoints_at: '2026-01-20T18:00:00Z',
        }
      ];

      const result = selectActiveRace(races);
      expect(result).toEqual({
        activeRaceId: 5,
        candidates: races
      });
    });

    test('returns null when multiple candidates', () => {
      const races = [
        {
          race_id: 1,
          start_showing_checkpoints_at: '2026-01-10T10:00:00Z',
          end_showing_checkpoints_at: '2026-01-20T18:00:00Z',
        },
        {
          race_id: 2,
          start_showing_checkpoints_at: '2026-01-12T10:00:00Z',
          end_showing_checkpoints_at: '2026-01-18T18:00:00Z',
        }
      ];

      const result = selectActiveRace(races);
      expect(result).toEqual({
        activeRaceId: null,
        candidates: races
      });
    });

    test('returns null when no active races', () => {
      const races = [
        {
          race_id: 1,
          start_showing_checkpoints_at: '2026-01-01T10:00:00Z',
          end_showing_checkpoints_at: '2026-01-05T18:00:00Z', // ended
        }
      ];

      const result = selectActiveRace(races);
      expect(result).toEqual({
        activeRaceId: null,
        candidates: []
      });
    });

    test('handles race_id property', () => {
      const races = [
        {
          race_id: 42,
          start_showing_checkpoints_at: '2026-01-10T10:00:00Z',
          end_showing_checkpoints_at: '2026-01-20T18:00:00Z',
        }
      ];

      const result = selectActiveRace(races);
      expect(result.activeRaceId).toBe(42);
    });

    test('handles id property when race_id not present', () => {
      const races = [
        {
          id: 42,
          start_showing_checkpoints_at: '2026-01-10T10:00:00Z',
          end_showing_checkpoints_at: '2026-01-20T18:00:00Z',
        }
      ];

      const result = selectActiveRace(races);
      expect(result.activeRaceId).toBe(42);
    });

    test('handles raceId property as fallback', () => {
      const races = [
        {
          raceId: 42,
          start_showing_checkpoints_at: '2026-01-10T10:00:00Z',
          end_showing_checkpoints_at: '2026-01-20T18:00:00Z',
        }
      ];

      const result = selectActiveRace(races);
      expect(result.activeRaceId).toBe(42);
    });

    test('returns null when race has no ID property', () => {
      const races = [
        {
          start_showing_checkpoints_at: '2026-01-10T10:00:00Z',
          end_showing_checkpoints_at: '2026-01-20T18:00:00Z',
        }
      ];

      const result = selectActiveRace(races);
      expect(result.activeRaceId).toBeNull();
    });

    test('includes all candidates in result', () => {
      const races = [
        {
          race_id: 1,
          start_showing_checkpoints_at: '2026-01-10T10:00:00Z',
          end_showing_checkpoints_at: '2026-01-20T18:00:00Z',
        },
        {
          race_id: 2,
          start_showing_checkpoints_at: '2026-01-12T10:00:00Z',
          end_showing_checkpoints_at: '2026-01-18T18:00:00Z',
        }
      ];

      const result = selectActiveRace(races);
      expect(result.candidates).toHaveLength(2);
      expect(result.candidates).toEqual(races);
    });

    test('filters inactive races from candidates', () => {
      const races = [
        {
          race_id: 1,
          start_showing_checkpoints_at: '2026-01-10T10:00:00Z',
          end_showing_checkpoints_at: '2026-01-20T18:00:00Z', // active
        },
        {
          race_id: 2,
          start_showing_checkpoints_at: '2026-01-01T10:00:00Z',
          end_showing_checkpoints_at: '2026-01-05T18:00:00Z', // inactive
        }
      ];

      const result = selectActiveRace(races);
      expect(result.activeRaceId).toBe(1);
      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].race_id).toBe(1);
    });
  });
});
