import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TimeProvider } from '../contexts/TimeContext';
import Login from './Login';
import { authApi } from '../services/authApi';

// Mock the authApi
jest.mock('../services/authApi');

// Mock window.location.reload
delete window.location;
window.location = { reload: jest.fn() };

const MockLogin = () => (
  <TimeProvider>
    <Login />
  </TimeProvider>
);

describe('Login Component', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    jest.clearAllMocks();
  });

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
      expect(localStorage.getItem('refreshToken')).toBe('mock-refresh-token');
      expect(sessionStorage.getItem('initialLoad')).toBe('true');
      expect(window.location.reload).toHaveBeenCalled();
    });
  });

  test('displays error message on login failure', async () => {
    authApi.login.mockRejectedValue(new Error('Invalid credentials'));
    
    render(<MockLogin />);
    
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'test@example.com' }
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'wrongpassword' }
    });
    
    fireEvent.click(screen.getByRole('button', { name: /login/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
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
    authApi.login.mockRejectedValueOnce(new Error('Invalid credentials'));
    
    render(<MockLogin />);
    
    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /login/i });
    
    // First failed attempt
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
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
      expect(screen.queryByText(/invalid credentials/i)).not.toBeInTheDocument();
    });
  });
});
