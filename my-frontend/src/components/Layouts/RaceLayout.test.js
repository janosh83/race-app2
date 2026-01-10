import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import RaceLayout from './RaceLayout';
import { isTokenExpired, logoutAndRedirect } from '../../utils/api';
import * as TimeContext from '../../contexts/TimeContext';

// Mock dependencies
jest.mock('../../utils/api');

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  Outlet: ({ context }) => <div data-testid="outlet">Outlet Content (navHeight: {context?.navHeight})</div>,
}));

// Helper function to render component with router and context
const renderWithProviders = (activeRace = null, signedRaces = [], user = null) => {
  if (user) {
    localStorage.setItem('user', JSON.stringify(user));
  } else {
    localStorage.removeItem('user');
  }

  const mockTimeContext = {
    activeRace,
    signedRaces,
    timeState: 'LOGGING',
    raceTime: new Date(),
    currentTime: new Date(),
    refreshActiveRace: jest.fn(),
  };

  jest.spyOn(TimeContext, 'useTime').mockReturnValue(mockTimeContext);

  return render(
    <MemoryRouter initialEntries={['/race']}>
      <TimeContext.TimeProvider>
        <RaceLayout />
      </TimeContext.TimeProvider>
    </MemoryRouter>
  );
};

describe('RaceLayout Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    jest.useFakeTimers();
    isTokenExpired.mockReturnValue(false);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Component rendering', () => {
    test('renders navbar with brand', () => {
      renderWithProviders();

      expect(screen.getByText('Race App')).toBeInTheDocument();
    });

    test('renders outlet for child routes', () => {
      renderWithProviders();

      expect(screen.getByTestId('outlet')).toBeInTheDocument();
    });

    test('renders navbar toggler button', () => {
      renderWithProviders();

      const toggleButton = screen.getByRole('button', { name: 'Toggle navigation' });
      expect(toggleButton).toBeInTheDocument();
      expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    });

    test('renders Active Race navigation link', () => {
      renderWithProviders();

      expect(screen.getByRole('button', { name: 'Active Race' })).toBeInTheDocument();
    });

    test('renders Standings navigation link when activeRace exists', () => {
      const activeRace = { race_id: 5, name: 'Test Race' };
      renderWithProviders(activeRace);

      expect(screen.getByRole('button', { name: 'Standings' })).toBeInTheDocument();
    });

    test('hides Standings navigation link when no activeRace', () => {
      renderWithProviders(null);

      expect(screen.queryByRole('button', { name: 'Standings' })).not.toBeInTheDocument();
    });

    test('renders Logout button', () => {
      renderWithProviders();

      expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument();
    });
  });

  describe('Navigation with active race', () => {
    test('shows Map and Tasks links when activeRace exists', () => {
      const activeRace = { race_id: 5, name: 'Test Race' };
      renderWithProviders(activeRace);

      expect(screen.getByRole('button', { name: 'Map' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Tasks' })).toBeInTheDocument();
    });

    test('hides Map and Tasks links when no activeRace', () => {
      renderWithProviders(null);

      expect(screen.queryByRole('button', { name: 'Map' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Tasks' })).not.toBeInTheDocument();
    });

    test('uses race_id property for Map navigation', () => {
      const activeRace = { race_id: 5, name: 'Test Race' };
      renderWithProviders(activeRace);

      const mapButton = screen.getByRole('button', { name: 'Map' });
      fireEvent.click(mapButton);

      expect(mockNavigate).toHaveBeenCalledWith('/race/5/map');
    });

    test('uses id property for Map navigation when race_id not available', () => {
      const activeRace = { id: 7, name: 'Test Race' };
      renderWithProviders(activeRace);

      const mapButton = screen.getByRole('button', { name: 'Map' });
      fireEvent.click(mapButton);

      expect(mockNavigate).toHaveBeenCalledWith('/race/7/map');
    });

    test('uses race_id property for Tasks navigation', () => {
      const activeRace = { race_id: 5, name: 'Test Race' };
      renderWithProviders(activeRace);

      const tasksButton = screen.getByRole('button', { name: 'Tasks' });
      fireEvent.click(tasksButton);

      expect(mockNavigate).toHaveBeenCalledWith('/race/5/tasks');
    });

    test('uses id property for Tasks navigation when race_id not available', () => {
      const activeRace = { id: 7, name: 'Test Race' };
      renderWithProviders(activeRace);

      const tasksButton = screen.getByRole('button', { name: 'Tasks' });
      fireEvent.click(tasksButton);

      expect(mockNavigate).toHaveBeenCalledWith('/race/7/tasks');
    });
  });

  describe('Navigation interactions', () => {
    test('navigates to Active Race on button click', () => {
      renderWithProviders();

      const activeRaceButton = screen.getByRole('button', { name: 'Active Race' });
      fireEvent.click(activeRaceButton);

      expect(mockNavigate).toHaveBeenCalledWith('/race');
    });

    test('navigates to Standings on button click', () => {
      const activeRace = { race_id: 5, name: 'Test Race' };
      renderWithProviders(activeRace);

      const standingsButton = screen.getByRole('button', { name: 'Standings' });
      fireEvent.click(standingsButton);

      expect(mockNavigate).toHaveBeenCalledWith('/race/5/standings');
    });

    test('closes navbar after navigation', () => {
      renderWithProviders();

      // Open navbar
      const toggleButton = screen.getByRole('button', { name: 'Toggle navigation' });
      fireEvent.click(toggleButton);
      expect(toggleButton).toHaveAttribute('aria-expanded', 'true');

      // Navigate
      const activeRaceButton = screen.getByRole('button', { name: 'Active Race' });
      fireEvent.click(activeRaceButton);

      // Navbar should close
      expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('Admin navigation', () => {
    test('shows Admin link for administrator users', () => {
      const adminUser = { username: 'admin', is_administrator: true };
      renderWithProviders(null, [], adminUser);

      expect(screen.getByRole('button', { name: 'Admin' })).toBeInTheDocument();
    });

    test('hides Admin link for non-administrator users', () => {
      const regularUser = { username: 'user', is_administrator: false };
      renderWithProviders(null, [], regularUser);

      expect(screen.queryByRole('button', { name: 'Admin' })).not.toBeInTheDocument();
    });

    test('hides Admin link when no user', () => {
      renderWithProviders();

      expect(screen.queryByRole('button', { name: 'Admin' })).not.toBeInTheDocument();
    });

    test('navigates to Admin page on button click', () => {
      const adminUser = { username: 'admin', is_administrator: true };
      renderWithProviders(null, [], adminUser);

      const adminButton = screen.getByRole('button', { name: 'Admin' });
      fireEvent.click(adminButton);

      expect(mockNavigate).toHaveBeenCalledWith('/admin');
    });
  });

  describe('Navbar toggle', () => {
    test('toggles navbar on button click', () => {
      renderWithProviders();

      const toggleButton = screen.getByRole('button', { name: 'Toggle navigation' });
      expect(toggleButton).toHaveAttribute('aria-expanded', 'false');

      // Open navbar
      fireEvent.click(toggleButton);
      expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
      const navbar = document.getElementById('mainNavbar');
      expect(navbar).toHaveClass('show');

      // Close navbar
      fireEvent.click(toggleButton);
      expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
      expect(navbar).not.toHaveClass('show');
    });
  });

  describe('Logout functionality', () => {
    test('calls logoutAndRedirect on logout', () => {
      localStorage.setItem('accessToken', 'test-token');
      localStorage.setItem('user', JSON.stringify({ username: 'test' }));
      localStorage.setItem('signedRaces', JSON.stringify([1, 2, 3]));

      // Mock window.location.replace
      delete window.location;
      window.location = { replace: jest.fn() };

      renderWithProviders();

      const logoutButton = screen.getByRole('button', { name: 'Logout' });
      fireEvent.click(logoutButton);

      expect(logoutAndRedirect).toHaveBeenCalled();
    });

    test('redirects to root on logout', () => {
      delete window.location;
      window.location = { replace: jest.fn() };

      renderWithProviders();

      const logoutButton = screen.getByRole('button', { name: 'Logout' });
      fireEvent.click(logoutButton);

      expect(logoutAndRedirect).toHaveBeenCalled();
    });

    test('closes navbar on logout', () => {
      delete window.location;
      window.location = { replace: jest.fn() };

      renderWithProviders();

      const toggleButton = screen.getByRole('button', { name: 'Toggle navigation' });
      
      // Open navbar
      fireEvent.click(toggleButton);
      expect(toggleButton).toHaveAttribute('aria-expanded', 'true');

      // Click logout
      const logoutButton = screen.getByRole('button', { name: 'Logout' });
      fireEvent.click(logoutButton);

      // Navbar should close (checked before reload is called)
      expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('Token expiry checking', () => {
    test('checks token expiry on mount', () => {
      localStorage.setItem('accessToken', 'test-token');
      renderWithProviders();

      expect(isTokenExpired).toHaveBeenCalledWith('test-token', 5);
    });

    test('logs out on expired token', () => {
      localStorage.setItem('accessToken', 'expired-token');
      isTokenExpired.mockReturnValue(true);

      renderWithProviders();

      expect(logoutAndRedirect).toHaveBeenCalled();
    });

    test('does not logout when token is valid', () => {
      localStorage.setItem('accessToken', 'valid-token');
      isTokenExpired.mockReturnValue(false);

      renderWithProviders();

      expect(logoutAndRedirect).not.toHaveBeenCalled();
    });

    test('checks token periodically every 30 seconds', () => {
      localStorage.setItem('accessToken', 'test-token');
      isTokenExpired.mockReturnValue(false);

      renderWithProviders();

      expect(isTokenExpired).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(30000);
      expect(isTokenExpired).toHaveBeenCalledTimes(2);

      jest.advanceTimersByTime(30000);
      expect(isTokenExpired).toHaveBeenCalledTimes(3);
    });

    test('does nothing when no token exists', () => {
      localStorage.removeItem('accessToken');

      renderWithProviders();

      expect(isTokenExpired).not.toHaveBeenCalled();
      expect(logoutAndRedirect).not.toHaveBeenCalled();
    });
  });

  describe('User data parsing', () => {
    test('parses valid user JSON from localStorage', () => {
      const user = { username: 'testuser', is_administrator: false };
      localStorage.setItem('user', JSON.stringify(user));

      renderWithProviders();

      // User should be parsed and no admin link shown
      expect(screen.queryByRole('button', { name: 'Admin' })).not.toBeInTheDocument();
    });

    test('handles null user gracefully', () => {
      localStorage.setItem('user', 'null');

      renderWithProviders();

      expect(screen.queryByRole('button', { name: 'Admin' })).not.toBeInTheDocument();
    });

    test('handles invalid JSON gracefully', () => {
      localStorage.setItem('user', 'invalid-json{');

      renderWithProviders();

      // Should not crash
      expect(screen.queryByRole('button', { name: 'Admin' })).not.toBeInTheDocument();
    });

    test('handles missing user in localStorage', () => {
      localStorage.removeItem('user');

      renderWithProviders();

      expect(screen.queryByRole('button', { name: 'Admin' })).not.toBeInTheDocument();
    });
  });

  describe('Navbar height measurement', () => {
    test('passes navHeight to Outlet context', () => {
      renderWithProviders();

      const outlet = screen.getByTestId('outlet');
      expect(outlet).toHaveTextContent(/navHeight:/);
    });

    test('measures navbar height on mount', () => {
      const mockGetBoundingClientRect = jest.fn(() => ({
        height: 64,
      }));

      renderWithProviders();

      const navbar = screen.getByRole('navigation');
      navbar.getBoundingClientRect = mockGetBoundingClientRect;

      // Trigger resize event
      fireEvent(window, new Event('resize'));

      expect(mockGetBoundingClientRect).toHaveBeenCalled();
    });

    test('updates height on window resize', () => {
      renderWithProviders();

      const resizeEvent = new Event('resize');
      fireEvent(window, resizeEvent);

      // Should not crash and outlet should still be rendered
      expect(screen.getByTestId('outlet')).toBeInTheDocument();
    });

    test('updates height on orientation change', () => {
      renderWithProviders();

      const orientationEvent = new Event('orientationchange');
      fireEvent(window, orientationEvent);

      // Should not crash and outlet should still be rendered
      expect(screen.getByTestId('outlet')).toBeInTheDocument();
    });

    test('measures height after navbar toggle with delay', () => {
      jest.useFakeTimers();
      renderWithProviders();

      const toggleButton = screen.getByRole('button', { name: 'Toggle navigation' });
      fireEvent.click(toggleButton);

      // Advance timers to trigger delayed measurement
      jest.advanceTimersByTime(300);

      expect(screen.getByTestId('outlet')).toBeInTheDocument();
    });
  });

  describe('Navbar styling', () => {
    test('applies correct navbar classes', () => {
      renderWithProviders();

      const navbar = screen.getByRole('navigation');
      expect(navbar).toHaveClass('navbar', 'navbar-expand-lg', 'navbar-dark', 'bg-primary');
    });

    test('applies correct positioning and z-index', () => {
      renderWithProviders();

      const navbar = screen.getByRole('navigation');
      expect(navbar).toHaveStyle({ position: 'relative', zIndex: 1040 });
    });
  });

  describe('Container rendering', () => {
    test('renders main container with correct classes', () => {
      renderWithProviders();

      const container = document.querySelector('.container.mt-4');
      expect(container).toBeInTheDocument();
      expect(container).toContainElement(screen.getByTestId('outlet'));
    });
  });
});
