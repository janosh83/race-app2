import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import ActiveRacePage from './ActiveRacePage';
import { selectActiveRace } from '../../utils/activeRaceUtils';
import { TimeProvider } from '../../contexts/TimeContext';

// Mock dependencies
jest.mock('../../utils/activeRaceUtils');
jest.mock('../ActiveRace', () => {
  return function MockActiveRace() {
    return <div data-testid="active-race">Active Race Component</div>;
  };
});

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
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

  const mockSetActiveRace = jest.fn();
  const mockTimeContext = {
    activeRace,
    setActiveRace: mockSetActiveRace,
    timeInfo,
    signedRaces,
    timeState: timeInfo.state,
    raceTime: new Date(),
    currentTime: new Date(),
    refreshActiveRace: jest.fn(),
  };

  const result = render(
    <MemoryRouter initialEntries={['/race']}>
      <TimeProvider value={mockTimeContext}>
        <ActiveRacePage />
      </TimeProvider>
    </MemoryRouter>
  );

  return { ...result, mockSetActiveRace };
};

describe('ActiveRacePage Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    selectActiveRace.mockReturnValue({ activeRaceId: null, candidates: [] });
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

    test('does not redirect when time state is BEFORE_SHOW', () => {
      const signedRaces = [{ race_id: 1, name: 'Race 1' }];
      selectActiveRace.mockReturnValue({ activeRaceId: 1, candidates: [signedRaces[0]] });

      renderWithProviders(signedRaces, null, { state: 'BEFORE_SHOW' }, true);

      expect(mockNavigate).not.toHaveBeenCalled();
    });

    test('does not redirect when time state is AFTER_SHOW', () => {
      const signedRaces = [{ race_id: 1, name: 'Race 1' }];
      selectActiveRace.mockReturnValue({ activeRaceId: 1, candidates: [signedRaces[0]] });

      renderWithProviders(signedRaces, null, { state: 'AFTER_SHOW' }, true);

      expect(mockNavigate).not.toHaveBeenCalled();
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

    test('does not redirect when timeInfo is null', () => {
      const signedRaces = [{ race_id: 1, name: 'Race 1' }];
      selectActiveRace.mockReturnValue({ activeRaceId: 1, candidates: [signedRaces[0]] });

      renderWithProviders(signedRaces, null, null, true);

      expect(mockNavigate).not.toHaveBeenCalled();
    });

    test('does not redirect when timeInfo.state is undefined', () => {
      const signedRaces = [{ race_id: 1, name: 'Race 1' }];
      selectActiveRace.mockReturnValue({ activeRaceId: 1, candidates: [signedRaces[0]] });

      renderWithProviders(signedRaces, null, {}, true);

      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('Active race selection', () => {
    test('calls selectActiveRace with signedRaces', () => {
      const signedRaces = [
        { race_id: 1, name: 'Race 1' },
        { race_id: 2, name: 'Race 2' },
      ];
      selectActiveRace.mockReturnValue({ activeRaceId: null, candidates: [] });

      renderWithProviders(signedRaces, null, { state: 'LOGGING' }, true);

      expect(selectActiveRace).toHaveBeenCalledWith(signedRaces);
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

      expect(mockSetActiveRace).toHaveBeenCalledWith(signedRaces[0]);
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

      expect(mockSetActiveRace).toHaveBeenCalledWith(signedRaces[1]);
    });

    test('finds race using id property when race_id not available', () => {
      const signedRaces = [{ id: 7, name: 'Race 7' }];
      selectActiveRace.mockReturnValue({ activeRaceId: 7, candidates: [signedRaces[0]] });

      const { mockSetActiveRace } = renderWithProviders(signedRaces, null, { state: 'LOGGING' }, true);

      expect(mockSetActiveRace).toHaveBeenCalledWith(signedRaces[0]);
    });

    test('finds race using raceId property as fallback', () => {
      const signedRaces = [{ raceId: 9, name: 'Race 9' }];
      selectActiveRace.mockReturnValue({ activeRaceId: 9, candidates: [signedRaces[0]] });

      const { mockSetActiveRace } = renderWithProviders(signedRaces, null, { state: 'LOGGING' }, true);

      expect(mockSetActiveRace).toHaveBeenCalledWith(signedRaces[0]);
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

    test('does not redirect when candidate exists but no signedRaces', () => {
      const candidate = { race_id: 1, name: 'Race 1' };
      selectActiveRace.mockReturnValue({ 
        activeRaceId: 1, 
        candidates: [candidate] 
      });

      renderWithProviders(null, null, { state: 'LOGGING' }, true);

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
});
