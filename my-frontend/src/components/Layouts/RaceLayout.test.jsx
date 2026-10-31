import { render, screen, fireEvent, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import * as TimeContext from '../../contexts/TimeContext';
import { logoutAndRedirect } from '../../utils/api';

import RaceLayout from './RaceLayout';

// Mock dependencies
vi.mock('../../utils/api');

const mockNavigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => mockNavigate,
  Outlet: ({ context }) => <div data-testid="outlet">Outlet Content (navHeight: {context?.navHeight}, tabbarHeight: {context?.tabbarHeight})</div>,
}));

// The race section links exist twice: in the top navbar (wide screens) and in
// the bottom tab bar (phones). jsdom applies no CSS, so both are rendered.
const topNav = () => document.querySelector('nav.navbar');
const tabBar = () => screen.getByRole('navigation', { name: 'Race sections' });

// Helper function to render component with router and context
const renderWithProviders = (activeRace = null, signedRaces = [], user = null, path = '/race') => {
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
    refreshActiveRace: vi.fn(),
  };

  vi.spyOn(TimeContext, 'useTime').mockReturnValue(mockTimeContext);

  return render(
    <MemoryRouter initialEntries={[path]}>
      <TimeContext.TimeProvider>
        <RaceLayout />
      </TimeContext.TimeProvider>
    </MemoryRouter>
  );
};

describe('RaceLayout Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('Component rendering', () => {
    test('renders navbar with brand', () => {
      renderWithProviders();

      expect(screen.getByText('Race App')).toBeInTheDocument();
    });

    test('shows the logo next to the brand', () => {
      renderWithProviders();

      const logo = screen.getByText('Race App').querySelector('img');
      expect(logo).toHaveAttribute('src', '/logo192.png');
      expect(logo).toHaveAttribute('alt', '');
    });

    test('shows the selected race name as the race switcher', () => {
      renderWithProviders({ race_id: 5, name: 'City Challenge' });

      expect(screen.queryByText('Race App')).not.toBeInTheDocument();
      const switcher = screen.getByRole('button', { name: 'City Challenge – switch race' });
      expect(switcher).toHaveTextContent('City Challenge');
      expect(switcher.querySelector('img')).toHaveAttribute('src', '/logo192.png');

      fireEvent.click(switcher);
      expect(mockNavigate).toHaveBeenCalledWith('/race');
    });

    describe('races running at the same time', () => {
      const now = new Date('2026-05-01T12:00:00Z');
      const running = (id) => ({
        race_id: id,
        name: `Race ${id}`,
        start_showing_checkpoints: '2026-05-01T08:00:00Z',
        end_showing_checkpoints: '2026-05-01T18:00:00Z',
      });

      test('shows a notice with a switch link when two races run', () => {
        vi.setSystemTime(now);
        renderWithProviders(running(1), [running(1), running(2)], null, '/race/1/map');

        expect(screen.getByRole('status')).toHaveTextContent('2 races are running now');
        fireEvent.click(within(screen.getByRole('status')).getByRole('button', { name: 'Switch' }));
        expect(mockNavigate).toHaveBeenCalledWith('/race');
      });

      test('shows no notice with a single running race', () => {
        vi.setSystemTime(now);
        renderWithProviders(running(1), [running(1)], null, '/race/1/map');

        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      });

      test('shows no notice on the race list itself', () => {
        vi.setSystemTime(now);
        renderWithProviders(running(1), [running(1), running(2)], null, '/race');

        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      });
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

    test('renders My races navigation link', () => {
      renderWithProviders();

      expect(screen.getByRole('button', { name: 'My races' })).toBeInTheDocument();
    });

    test('renders Standings navigation link when activeRace exists', () => {
      const activeRace = { race_id: 5, name: 'Test Race' };
      renderWithProviders(activeRace);

      expect(within(topNav()).getByRole('button', { name: 'Standings' })).toBeInTheDocument();
    });

    test('hides Standings navigation link when no activeRace', () => {
      renderWithProviders(null);

      expect(within(topNav()).queryByRole('button', { name: 'Standings' })).not.toBeInTheDocument();
    });

    test('renders Logout button', () => {
      renderWithProviders();

      expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument();
    });
  });

  describe('Navigation with active race', () => {
    test('shows Map, Checkpoints and Tasks links when activeRace exists', () => {
      const activeRace = { race_id: 5, name: 'Test Race' };
      renderWithProviders(activeRace);

      expect(within(topNav()).getByRole('button', { name: 'Map' })).toBeInTheDocument();
      expect(within(topNav()).getByRole('button', { name: 'Checkpoints' })).toBeInTheDocument();
      expect(within(topNav()).getByRole('button', { name: 'Tasks' })).toBeInTheDocument();
    });

    test('hides Map, Checkpoints and Tasks links when no activeRace', () => {
      renderWithProviders(null);

      expect(within(topNav()).queryByRole('button', { name: 'Map' })).not.toBeInTheDocument();
      expect(within(topNav()).queryByRole('button', { name: 'Checkpoints' })).not.toBeInTheDocument();
      expect(within(topNav()).queryByRole('button', { name: 'Tasks' })).not.toBeInTheDocument();
    });

    test('uses race_id property for Map navigation', () => {
      const activeRace = { race_id: 5, name: 'Test Race' };
      renderWithProviders(activeRace);

      const mapButton = within(topNav()).getByRole('button', { name: 'Map' });
      fireEvent.click(mapButton);

      expect(mockNavigate).toHaveBeenCalledWith('/race/5/map');
    });

    test('uses id property for Map navigation when race_id not available', () => {
      const activeRace = { id: 7, name: 'Test Race' };
      renderWithProviders(activeRace);

      const mapButton = within(topNav()).getByRole('button', { name: 'Map' });
      fireEvent.click(mapButton);

      expect(mockNavigate).toHaveBeenCalledWith('/race/7/map');
    });

    test('uses race_id property for Tasks navigation', () => {
      const activeRace = { race_id: 5, name: 'Test Race' };
      renderWithProviders(activeRace);

      const tasksButton = within(topNav()).getByRole('button', { name: 'Tasks' });
      fireEvent.click(tasksButton);

      expect(mockNavigate).toHaveBeenCalledWith('/race/5/tasks');
    });

    test('uses race_id property for Checkpoints navigation', () => {
      const activeRace = { race_id: 5, name: 'Test Race' };
      renderWithProviders(activeRace);

      const checkpointsButton = within(topNav()).getByRole('button', { name: 'Checkpoints' });
      fireEvent.click(checkpointsButton);

      expect(mockNavigate).toHaveBeenCalledWith('/race/5/checkpoints');
    });

    test('uses id property for Checkpoints navigation when race_id not available', () => {
      const activeRace = { id: 7, name: 'Test Race' };
      renderWithProviders(activeRace);

      const checkpointsButton = within(topNav()).getByRole('button', { name: 'Checkpoints' });
      fireEvent.click(checkpointsButton);

      expect(mockNavigate).toHaveBeenCalledWith('/race/7/checkpoints');
    });

    test('uses id property for Tasks navigation when race_id not available', () => {
      const activeRace = { id: 7, name: 'Test Race' };
      renderWithProviders(activeRace);

      const tasksButton = within(topNav()).getByRole('button', { name: 'Tasks' });
      fireEvent.click(tasksButton);

      expect(mockNavigate).toHaveBeenCalledWith('/race/7/tasks');
    });
  });

  describe('Navigation interactions', () => {
    test('navigates to My races on button click', () => {
      renderWithProviders();

      const activeRaceButton = screen.getByRole('button', { name: 'My races' });
      fireEvent.click(activeRaceButton);

      expect(mockNavigate).toHaveBeenCalledWith('/race');
    });

    test('navigates to Standings on button click', () => {
      const activeRace = { race_id: 5, name: 'Test Race' };
      renderWithProviders(activeRace);

      const standingsButton = within(topNav()).getByRole('button', { name: 'Standings' });
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
      const activeRaceButton = screen.getByRole('button', { name: 'My races' });
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
      window.location = { replace: vi.fn() };

      renderWithProviders();

      const logoutButton = screen.getByRole('button', { name: 'Logout' });
      fireEvent.click(logoutButton);

      expect(logoutAndRedirect).toHaveBeenCalled();
    });

    test('redirects to root on logout', () => {
      delete window.location;
      window.location = { replace: vi.fn() };

      renderWithProviders();

      const logoutButton = screen.getByRole('button', { name: 'Logout' });
      fireEvent.click(logoutButton);

      expect(logoutAndRedirect).toHaveBeenCalled();
    });

    test('closes navbar on logout', () => {
      delete window.location;
      window.location = { replace: vi.fn() };

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
      const mockGetBoundingClientRect = vi.fn(() => ({
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
      vi.useFakeTimers();
      renderWithProviders();

      const toggleButton = screen.getByRole('button', { name: 'Toggle navigation' });
      fireEvent.click(toggleButton);

      // Advance timers to trigger delayed measurement
      vi.advanceTimersByTime(300);

      expect(screen.getByTestId('outlet')).toBeInTheDocument();
    });
  });

  describe('Navbar styling', () => {
    test('applies correct navbar classes', () => {
      renderWithProviders();

      const navbar = screen.getByRole('navigation');
      expect(navbar).toHaveClass('navbar', 'navbar-expand-lg', 'navbar-dark', 'race-navbar');
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

  describe('Bottom tab bar', () => {
    test('is not rendered without an active race', () => {
      renderWithProviders(null);

      expect(screen.queryByRole('navigation', { name: 'Race sections' })).not.toBeInTheDocument();
    });

    test('shows the four race sections', () => {
      renderWithProviders({ race_id: 5, name: 'Test Race' });

      const buttons = within(tabBar()).getAllByRole('button');
      expect(buttons.map((b) => b.textContent)).toEqual(['Map', 'Checkpoints', 'Tasks', 'Standings']);
    });

    test('navigates to the tapped section', () => {
      renderWithProviders({ race_id: 5, name: 'Test Race' });

      fireEvent.click(within(tabBar()).getByRole('button', { name: 'Tasks' }));

      expect(mockNavigate).toHaveBeenCalledWith('/race/5/tasks');
    });

    test('marks the current section', () => {
      renderWithProviders({ race_id: 5, name: 'Test Race' }, [], null, '/race/5/checkpoints');

      expect(within(tabBar()).getByRole('button', { name: 'Checkpoints' })).toHaveAttribute('aria-current', 'page');
      expect(within(tabBar()).getByRole('button', { name: 'Map' })).not.toHaveAttribute('aria-current');
    });

    test('passes its height to the Outlet context', () => {
      renderWithProviders({ race_id: 5, name: 'Test Race' });

      expect(screen.getByTestId('outlet')).toHaveTextContent('tabbarHeight: 0');
    });
  });
});
