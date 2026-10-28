import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { TimeProvider } from '../contexts/TimeContext';
import { authApi } from '../services/authApi';

import Login from './Login';

// Mock the authApi
vi.mock('../services/authApi');

// Mock react-router-dom useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const MockLogin = () => (
  <MemoryRouter initialEntries={['/login']}>
    <TimeProvider>
      <Login />
    </TimeProvider>
  </MemoryRouter>
);

describe('Login Component', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    mockNavigate.mockClear();
    vi.spyOn(window, 'dispatchEvent');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // App's /login route does the post-login redirect (PostLoginRedirect); Login
  // only announces the login, it must not navigate itself.
  const expectLoginAnnounced = () => {
    expect(window.dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'auth-update' }));
    expect(mockNavigate).not.toHaveBeenCalled();
  };

  test('renders login form with email and password fields', () => {
    render(<MockLogin />);
    
    expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
    expect(screen.getByText(/forgot password/i)).toBeInTheDocument();
  });

  test('shows validation error when submitting empty form', async () => {
    render(<MockLogin />);
    
    const submitButton = screen.getByRole('button', { name: /login/i });
    fireEvent.click(submitButton);
    
    // HTML5 validation prevents form submission
    const emailInput = screen.getByLabelText(/email address/i);
    expect(emailInput).toBeRequired();
  });

  test('handles successful login', async () => {
    const mockLoginResponse = {
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      user: { id: 1, email: 'test@example.com', name: 'Test User' },
      signed_races: [{ race_id: 1, name: 'Test Race' }]
    };
    
    authApi.login.mockResolvedValue(mockLoginResponse);
    
    render(<MockLogin />);
    
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'test@example.com' }
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' }
    });
    
    fireEvent.click(screen.getByRole('button', { name: /login/i }));
    
    await waitFor(() => {
      expect(authApi.login).toHaveBeenCalledWith('test@example.com', 'password123');
      expect(localStorage.getItem('accessToken')).toBe('mock-access-token');
      expect(localStorage.getItem('refreshToken')).toBeNull();
      expectLoginAnnounced();
    });
  });

  const submitLogin = () => {
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));
  };

  test('auto-selects the only running race', async () => {
    const hour = 60 * 60 * 1000;
    const running = {
      race_id: 5,
      race_name: 'Running Race',
      start_showing_checkpoints: new Date(Date.now() - hour).toISOString(),
      end_showing_checkpoints: new Date(Date.now() + hour).toISOString(),
    };
    const upcoming = {
      race_id: 6,
      race_name: 'Upcoming Race',
      start_showing_checkpoints: new Date(Date.now() + 24 * hour).toISOString(),
      end_showing_checkpoints: new Date(Date.now() + 48 * hour).toISOString(),
    };
    authApi.login.mockResolvedValue({ access_token: 'token', user: { id: 1 }, signed_races: [running, upcoming] });

    render(<MockLogin />);
    submitLogin();

    await waitFor(() => {
      expectLoginAnnounced();
    });
    expect(JSON.parse(localStorage.getItem('activeRace')).race_id).toBe(5);
    expect(JSON.parse(localStorage.getItem('signedRaces'))).toHaveLength(2);
  });

  test('drops a race selected in an earlier session when nothing is running', async () => {
    localStorage.setItem('activeRace', JSON.stringify({ race_id: 99, race_name: 'Old Session Race' }));
    authApi.login.mockResolvedValue({ access_token: 'token', user: { id: 1 }, signed_races: [{ race_id: 99 }] });

    render(<MockLogin />);
    submitLogin();

    await waitFor(() => {
      expectLoginAnnounced();
    });
    expect(localStorage.getItem('activeRace')).toBeNull();
  });

  // Errors as utils/api.js throws them: a 401 always says 'Unauthorized'.
  const apiError = (message, status) => Object.assign(new Error(message), { status });

  test.each([
    ['wrong email or password (401)', apiError('Unauthorized', 401), 'Invalid email or password.'],
    ['server error', apiError('INTERNAL SERVER ERROR', 500), 'Login failed'],
    ['unreachable server', new TypeError('Failed to fetch'), "Can't reach the server. Check your connection and try again."],
  ])('shows a translated message for %s', async (_, error, message) => {
    authApi.login.mockRejectedValue(error);

    render(<MockLogin />);
    submitLogin();

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.queryByText(/unauthorized|failed to fetch|internal server error/i)).not.toBeInTheDocument();
  });

  test('displays error message on login failure', async () => {
    authApi.login.mockRejectedValue(apiError('Unauthorized', 401));
    
    render(<MockLogin />);
    
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'test@example.com' }
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'wrongpassword' }
    });
    
    fireEvent.click(screen.getByRole('button', { name: /login/i }));
    
    await waitFor(() => {
      expect(screen.getByText('Invalid email or password.')).toBeInTheDocument();
    });
  });

  test('displays custom error message from API response', async () => {
    authApi.login.mockResolvedValue({
      msg: 'User account is disabled'
    });
    
    render(<MockLogin />);
    
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'test@example.com' }
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' }
    });
    
    fireEvent.click(screen.getByRole('button', { name: /login/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/user account is disabled/i)).toBeInTheDocument();
    });
  });

  test('clears error message on new submission attempt', async () => {
    authApi.login.mockRejectedValueOnce(apiError('Unauthorized', 401));
    
    render(<MockLogin />);
    
    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /login/i });
    
    // First failed attempt
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Invalid email or password.')).toBeInTheDocument();
    });
    
    // Second attempt should clear error before API call
    authApi.login.mockResolvedValue({
      access_token: 'token',
      refresh_token: 'refresh',
      user: { id: 1 },
      signed_races: []
    });
    
    fireEvent.change(passwordInput, { target: { value: 'correctpassword' } });
    fireEvent.click(submitButton);
    
    // Error should be cleared during submission
    await waitFor(() => {
      expect(screen.queryByText('Invalid email or password.')).not.toBeInTheDocument();
    });
  });
});
