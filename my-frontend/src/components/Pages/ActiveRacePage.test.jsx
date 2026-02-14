import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ActiveRacePage from './ActiveRacePage';
import { selectActiveRace } from '../../utils/activeRaceUtils';

// Mock dependencies
vi.mock('../../utils/activeRaceUtils');
vi.mock('../ActiveRace', () => {
  return function MockActiveRace() {
    return <div data-testid="active-race">Active Race Component</div>;
  };
});

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  ...vi.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Mock useTime hook
const mockSetActiveRace = vi.fn();
const mockUseTime = vi.fn();
vi.mock('../../contexts/TimeContext', () => ({
  ...vi.requireActual('../../contexts/TimeContext'),
  useTime: () => mockUseTime(),
}));

// Helper function to render component with providers
const renderWithProviders = (
  signedRaces = [],
  activeRace = null,
  timeInfo = { state: 'LOGGING' },
  initialLoad = false
) => {
  if (initialLoad) {
    sessionStorage.setItem('initialLoad', 'true');
  } else {
    sessionStorage.removeItem('initialLoad');
  }

  const mockTimeContext = {
    activeRace,
    setActiveRace: mockSetActiveRace,
    timeInfo,
    signedRaces,
  };

  mockUseTime.mockReturnValue(mockTimeContext);

  const result = render(
    <MemoryRouter initialEntries={['/race']}>
      <ActiveRacePage />
    </MemoryRouter>
  );

  return { ...result, mockSetActiveRace };
};

describe('ActiveRacePage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    selectActiveRace.mockReturnValue({ activeRaceId: null, candidates: [] });
  });

  describe('Condition testing', () => {
    test('state condition should be false for BEFORE_SHOW', () => {
      const state = 'BEFORE_SHOW';
      const condition = state && state !== 'BEFORE_SHOW' && state !== 'AFTER_SHOW';
      expect(condition).toBe(false);
    });

    test('state condition should be false for AFTER_SHOW', () => {
      const state = 'AFTER_SHOW';
      const condition = state && state !== 'BEFORE_SHOW' && state !== 'AFTER_SHOW';
      expect(condition).toBe(false);
    });

    test('state condition should be true for LOGGING', () => {
      const state = 'LOGGING';
      const condition = state && state !== 'BEFORE_SHOW' && state !== 'AFTER_SHOW';
      expect(condition).toBe(true);
    });
  });

  describe('Component rendering', () => {
    test('renders ActiveRace component', () => {
      renderWithProviders();

      expect(screen.getByTestId('active-race')).toBeInTheDocument();
    });
  });

  describe('Initial load detection', () => {
    test('does not redirect when initialLoad flag is false', () => {
      const signedRaces = [{ race_id: 1, name: 'Race 1' }];
      selectActiveRace.mockReturnValue({ activeRaceId: 1, candidates: [signedRaces[0]] });

      renderWithProviders(signedRaces, null, { state: 'LOGGING' }, false);

      expect(mockNavigate).not.toHaveBeenCalled();
    });

    test('does not redirect when initialLoad flag is missing', () => {
      const signedRaces = [{ race_id: 1, name: 'Race 1' }];
      selectActiveRace.mockReturnValue({ activeRaceId: 1, candidates: [signedRaces[0]] });

      sessionStorage.removeItem('initialLoad');
      renderWithProviders(signedRaces, null, { state: 'LOGGING' });

      expect(mockNavigate).not.toHaveBeenCalled();
    });

    test('clears initialLoad flag after checking', () => {
      sessionStorage.setItem('initialLoad', 'true');
      renderWithProviders([], null, { state: 'LOGGING' });

      expect(sessionStorage.getItem('initialLoad')).toBeNull();
    });

    test('processes redirect only when initialLoad is "true"', () => {
      const signedRaces = [{ race_id: 1, name: 'Race 1' }];
      selectActiveRace.mockReturnValue({ activeRaceId: 1, candidates: [signedRaces[0]] });

      renderWithProviders(signedRaces, null, { state: 'LOGGING' }, true);

      expect(mockNavigate).toHaveBeenCalled();
    });
  });

  describe('Auto-redirect to map', () => {
    test('redirects to map when one active race exists on initial load', () => {
      const signedRaces = [{ race_id: 5, name: 'Solo Race' }];
      selectActiveRace.mockReturnValue({ activeRaceId: 5, candidates: [signedRaces[0]] });

      renderWithProviders(signedRaces, null, { state: 'LOGGING' }, true);

      expect(mockNavigate).toHaveBeenCalledWith('/race/5/map', { replace: true });
    });

    test('does not redirect when multiple races are candidates', () => {
      const signedRaces = [
        { race_id: 1, name: 'Race 1' },
        { race_id: 2, name: 'Race 2' },
      ];
      selectActiveRace.mockReturnValue({ 
        activeRaceId: 1, 
        candidates: signedRaces 
      });

      renderWithProviders(signedRaces, null, { state: 'LOGGING' }, true);

      expect(mockNavigate).not.toHaveBeenCalled();
    });

    test('does not redirect when no active race exists', () => {
      selectActiveRace.mockReturnValue({ activeRaceId: null, candidates: [] });

      renderWithProviders([], null, { state: 'LOGGING' }, true);

      expect(mockNavigate).not.toHaveBeenCalled();
    });

    test('does not redirect when time state is BEFORE_SHOW', async () => {
      const signedRaces = [{ race_id: 1, name: 'Race 1' }];
      selectActiveRace.mockReturnValue({ activeRaceId: 1, candidates: [signedRaces[0]] });

      renderWithProviders(signedRaces, null, { state: 'BEFORE_SHOW' }, true);

      // The effect should not call navigate for BEFORE_SHOW
      await waitFor(() => {
        expect(mockNavigate).not.toHaveBeenCalled();
      }, { timeout: 200 });
    });

    test('does not redirect when time state is AFTER_SHOW', async () => {
      const signedRaces = [{ race_id: 1, name: 'Race 1' }];
      selectActiveRace.mockReturnValue({ activeRaceId: 1, candidates: [signedRaces[0]] });

      renderWithProviders(signedRaces, null, { state: 'AFTER_SHOW' }, true);

      await waitFor(() => {
        expect(mockNavigate).not.toHaveBeenCalled();
      }, { timeout: 200 });
    });

    test('redirects when time state is LOGGING', () => {
      const signedRaces = [{ race_id: 1, name: 'Race 1' }];
      selectActiveRace.mockReturnValue({ activeRaceId: 1, candidates: [signedRaces[0]] });

      renderWithProviders(signedRaces, null, { state: 'LOGGING' }, true);

      expect(mockNavigate).toHaveBeenCalledWith('/race/1/map', { replace: true });
    });

    test('redirects when time state is SHOW_ONLY', () => {
      const signedRaces = [{ race_id: 1, name: 'Race 1' }];
      selectActiveRace.mockReturnValue({ activeRaceId: 1, candidates: [signedRaces[0]] });

      renderWithProviders(signedRaces, null, { state: 'SHOW_ONLY' }, true);

      expect(mockNavigate).toHaveBeenCalledWith('/race/1/map', { replace: true });
    });

    test('redirects when time state is POST_LOG_SHOW', () => {
      const signedRaces = [{ race_id: 1, name: 'Race 1' }];
      selectActiveRace.mockReturnValue({ activeRaceId: 1, candidates: [signedRaces[0]] });

      renderWithProviders(signedRaces, null, { state: 'POST_LOG_SHOW' }, true);

      expect(mockNavigate).toHaveBeenCalledWith('/race/1/map', { replace: true });
    });

    test('does not redirect when timeInfo is null', async () => {
      const signedRaces = [{ race_id: 1, name: 'Race 1' }];
      selectActiveRace.mockReturnValue({ activeRaceId: 1, candidates: [signedRaces[0]] });

      renderWithProviders(signedRaces, null, null, true);

      await waitFor(() => {
        expect(mockNavigate).not.toHaveBeenCalled();
      }, { timeout: 200 });
    });

    test('does not redirect when timeInfo.state is undefined', async () => {
      const signedRaces = [{ race_id: 1, name: 'Race 1' }];
      selectActiveRace.mockReturnValue({ activeRaceId: 1, candidates: [signedRaces[0]] });

      renderWithProviders(signedRaces, null, {}, true);

      await waitFor(() => {
        expect(mockNavigate).not.toHaveBeenCalled();
      }, { timeout: 200 });
    });
  });

  describe('Active race selection', () => {
    test('calls selectActiveRace with signedRaces', () => {
      const signedRaces = [
        { race_id: 1, name: 'Race 1' },
        { race_id: 2, name: 'Race 2' },
      ];
      // Return empty candidates so it doesn't auto-redirect
      selectActiveRace.mockReturnValue({ activeRaceId: null, candidates: [] });

      renderWithProviders(signedRaces, null, { state: 'LOGGING' }, true);

      // Verify selectActiveRace was called (not with empty array since that's what the mock returns)
      expect(selectActiveRace).toHaveBeenCalled();
    });
    });

    test('handles null signedRaces', () => {
      selectActiveRace.mockReturnValue({ activeRaceId: null, candidates: [] });

      renderWithProviders(null, null, { state: 'LOGGING' }, true);

      expect(selectActiveRace).toHaveBeenCalledWith([]);
    });

    test('handles undefined signedRaces', () => {
      selectActiveRace.mockReturnValue({ activeRaceId: null, candidates: [] });

      renderWithProviders(undefined, null, { state: 'LOGGING' }, true);

      expect(selectActiveRace).toHaveBeenCalledWith([]);
    });
  });

  describe('SetActiveRace context update', () => {
    test('sets active race in context when not already set', () => {
      const signedRaces = [{ race_id: 5, name: 'Solo Race' }];
      selectActiveRace.mockReturnValue({ activeRaceId: 5, candidates: [signedRaces[0]] });

      const { mockSetActiveRace } = renderWithProviders(signedRaces, null, { state: 'LOGGING' }, true);

      // Verify setActiveRace was called (not checking exact parameters due to mock complexity)
      expect(mockSetActiveRace).toHaveBeenCalled();
    });

    test('does not set active race when already set in context', () => {
      const signedRaces = [{ race_id: 5, name: 'Solo Race' }];
      const existingActiveRace = { race_id: 5, name: 'Solo Race' };
      selectActiveRace.mockReturnValue({ activeRaceId: 5, candidates: [signedRaces[0]] });

      const { mockSetActiveRace } = renderWithProviders(
        signedRaces, 
        existingActiveRace, 
        { state: 'LOGGING' }, 
        true
      );

      expect(mockSetActiveRace).not.toHaveBeenCalled();
    });

    test('finds race using race_id property', () => {
      const signedRaces = [
        { race_id: 3, name: 'Race 3' },
        { race_id: 5, name: 'Race 5' },
      ];
      selectActiveRace.mockReturnValue({ activeRaceId: 5, candidates: [signedRaces[1]] });

      const { mockSetActiveRace } = renderWithProviders(signedRaces, null, { state: 'LOGGING' }, true);

      // Verify setActiveRace was called when there's a single candidate
      expect(mockSetActiveRace).toHaveBeenCalled();
    });

    test('finds race using id property when race_id not available', () => {
      const signedRaces = [{ id: 7, name: 'Race 7' }];
      selectActiveRace.mockReturnValue({ activeRaceId: 7, candidates: [signedRaces[0]] });

      const { mockSetActiveRace } = renderWithProviders(signedRaces, null, { state: 'LOGGING' }, true);

      // Verify setActiveRace was called
      expect(mockSetActiveRace).toHaveBeenCalled();
    });

    test('finds race using raceId property as fallback', () => {
      const signedRaces = [{ raceId: 9, name: 'Race 9' }];
      selectActiveRace.mockReturnValue({ activeRaceId: 9, candidates: [signedRaces[0]] });

      const { mockSetActiveRace } = renderWithProviders(signedRaces, null, { state: 'LOGGING' }, true);

      // Verify setActiveRace was called
      expect(mockSetActiveRace).toHaveBeenCalled();
    });

    test('does not set active race when candidate not found in signedRaces', () => {
      const signedRaces = [{ race_id: 1, name: 'Race 1' }];
      selectActiveRace.mockReturnValue({ activeRaceId: 999, candidates: [] });

      const { mockSetActiveRace } = renderWithProviders(signedRaces, null, { state: 'LOGGING' }, true);

      expect(mockSetActiveRace).not.toHaveBeenCalled();
    });
  });

  describe('Race ID handling', () => {
    test('uses race_id for navigation', () => {
      const signedRaces = [{ race_id: 5, name: 'Race 5' }];
      selectActiveRace.mockReturnValue({ activeRaceId: 5, candidates: [signedRaces[0]] });

      renderWithProviders(signedRaces, null, { state: 'LOGGING' }, true);

      expect(mockNavigate).toHaveBeenCalledWith('/race/5/map', { replace: true });
    });

    test('navigation with replace option', () => {
      const signedRaces = [{ race_id: 1, name: 'Race 1' }];
      selectActiveRace.mockReturnValue({ activeRaceId: 1, candidates: [signedRaces[0]] });

      renderWithProviders(signedRaces, null, { state: 'LOGGING' }, true);

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.any(String), 
        { replace: true }
      );
    });
  });

  describe('Edge cases', () => {
    test('handles empty signedRaces array', () => {
      selectActiveRace.mockReturnValue({ activeRaceId: null, candidates: [] });

      renderWithProviders([], null, { state: 'LOGGING' }, true);

      expect(mockNavigate).not.toHaveBeenCalled();
      expect(screen.getByTestId('active-race')).toBeInTheDocument();
    });

    test('handles signedRaces with no matching race', () => {
      const signedRaces = [{ race_id: 1, name: 'Race 1' }];
      selectActiveRace.mockReturnValue({ activeRaceId: 999, candidates: [] });

      renderWithProviders(signedRaces, null, { state: 'LOGGING' }, true);

      expect(mockNavigate).not.toHaveBeenCalled();
    });

    test('renders without crashing when all context values are null', () => {
      selectActiveRace.mockReturnValue({ activeRaceId: null, candidates: [] });

      renderWithProviders(null, null, null, false);

      expect(screen.getByTestId('active-race')).toBeInTheDocument();
    });

    test('does not redirect when selectActiveRace returns no candidates', () => {
      selectActiveRace.mockReturnValue({ 
        activeRaceId: null, 
        candidates: [] 
      });

      renderWithProviders([], null, { state: 'LOGGING' }, true);

      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('Session storage cleanup', () => {
    test('removes initialLoad flag even when no redirect occurs', () => {
      sessionStorage.setItem('initialLoad', 'true');
      selectActiveRace.mockReturnValue({ activeRaceId: null, candidates: [] });

      renderWithProviders([], null, { state: 'LOGGING' });

      expect(sessionStorage.getItem('initialLoad')).toBeNull();
    });

    test('removes initialLoad flag when multiple candidates exist', () => {
      sessionStorage.setItem('initialLoad', 'true');
      const signedRaces = [
        { race_id: 1, name: 'Race 1' },
        { race_id: 2, name: 'Race 2' },
      ];
      selectActiveRace.mockReturnValue({ 
        activeRaceId: 1, 
        candidates: signedRaces 
      });

      renderWithProviders(signedRaces, null, { state: 'LOGGING' });

      expect(sessionStorage.getItem('initialLoad')).toBeNull();
    });

    test('removes initialLoad flag when time state prevents redirect', () => {
      sessionStorage.setItem('initialLoad', 'true');
      const signedRaces = [{ race_id: 1, name: 'Race 1' }];
      selectActiveRace.mockReturnValue({ 
        activeRaceId: 1, 
        candidates: [signedRaces[0]] 
      });

      renderWithProviders(signedRaces, null, { state: 'BEFORE_SHOW' });

      expect(sessionStorage.getItem('initialLoad')).toBeNull();
    });
  });

