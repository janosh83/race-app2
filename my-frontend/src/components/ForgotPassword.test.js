import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ForgotPassword from './ForgotPassword';
import * as authApiModule from '../services/authApi';

// Mock the authApi module
jest.mock('../services/authApi');

// Ensure authApi.requestPasswordReset is a jest mock function
authApiModule.authApi.requestPasswordReset = jest.fn();

describe('ForgotPassword Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authApiModule.authApi.requestPasswordReset = jest.fn();
  });

  test('renders forgot password form', () => {
    render(<ForgotPassword />);
    
    expect(screen.getByRole('heading', { name: /forgot password/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
    expect(screen.getByText(/back to login/i)).toBeInTheDocument();
    expect(screen.getByText(/enter your email address and we'll send you a link/i)).toBeInTheDocument();
  });

  test('email input is required', () => {
    render(<ForgotPassword />);
    
    const emailInput = screen.getByLabelText(/email address/i);
    expect(emailInput).toBeRequired();
  });

  test('submits form with email and shows success message', async () => {
    const mockResponse = {
      msg: 'Password reset email has been sent'
    };
    authApiModule.authApi.requestPasswordReset.mockResolvedValue(mockResponse);

    render(<ForgotPassword />);
    
    const emailInput = screen.getByLabelText(/email address/i);
    const submitButton = screen.getByRole('button', { name: /send reset link/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(authApiModule.authApi.requestPasswordReset).toHaveBeenCalledWith('test@example.com');
      expect(screen.getByText('Password reset email has been sent')).toBeInTheDocument();
    });

    // Email should be cleared after successful submission
    expect(emailInput.value).toBe('');
  });

  test('shows default success message when API does not return msg', async () => {
    authApiModule.authApi.requestPasswordReset.mockResolvedValue({});

    render(<ForgotPassword />);
    
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'test@example.com' }
    });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByText(/if the email exists, a password reset link has been sent/i)).toBeInTheDocument();
    });
  });

  test('displays error message on submission failure', async () => {
    authApiModule.authApi.requestPasswordReset.mockRejectedValue(new Error('Network error'));

    render(<ForgotPassword />);
    
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'test@example.com' }
    });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  test('displays default error message when error has no message', async () => {
    authApiModule.authApi.requestPasswordReset.mockRejectedValue({});

    render(<ForgotPassword />);
    
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'test@example.com' }
    });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByText('Failed to send reset email')).toBeInTheDocument();
    });
  });

  test('shows loading state during submission', async () => {
    authApiModule.authApi.requestPasswordReset.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({ msg: 'Sent' }), 100))
    );

    render(<ForgotPassword />);
    
    const emailInput = screen.getByLabelText(/email address/i);
    const submitButton = screen.getByRole('button', { name: /send reset link/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.click(submitButton);

    // During loading
    expect(screen.getByRole('button', { name: /sending\.\.\./i })).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
    expect(emailInput).toBeDisabled();

    // After completion
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
    });

    expect(submitButton).not.toBeDisabled();
    expect(emailInput).not.toBeDisabled();
  });

  test('clears previous messages when submitting again', async () => {
    authApiModule.authApi.requestPasswordReset
      .mockResolvedValueOnce({ msg: 'First success' })
      .mockRejectedValueOnce(new Error('Second error'));

    render(<ForgotPassword />);
    
    const emailInput = screen.getByLabelText(/email address/i);
    const submitButton = screen.getByRole('button', { name: /send reset link/i });

    // First submission - success
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('First success')).toBeInTheDocument();
    });

    // Second submission - error
    fireEvent.change(emailInput, { target: { value: 'another@example.com' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.queryByText('First success')).not.toBeInTheDocument();
      expect(screen.getByText('Second error')).toBeInTheDocument();
    });
  });

  test('clears error message when submitting again after error', async () => {
    authApiModule.authApi.requestPasswordReset
      .mockRejectedValueOnce(new Error('First error'))
      .mockResolvedValueOnce({ msg: 'Success' });

    render(<ForgotPassword />);
    
    const emailInput = screen.getByLabelText(/email address/i);
    const submitButton = screen.getByRole('button', { name: /send reset link/i });

    // First submission - error
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('First error')).toBeInTheDocument();
    });

    // Second submission - success
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.queryByText('First error')).not.toBeInTheDocument();
      expect(screen.getByText('Success')).toBeInTheDocument();
    });
  });

  test('does not submit empty form', () => {
    render(<ForgotPassword />);
    
    const submitButton = screen.getByRole('button', { name: /send reset link/i });
    fireEvent.click(submitButton);

    // HTML5 validation should prevent submission
    expect(authApiModule.authApi.requestPasswordReset).not.toHaveBeenCalled();
  });

  test('back to login link points to correct path', () => {
    render(<ForgotPassword />);
    
    const loginLink = screen.getByText(/back to login/i);
    expect(loginLink).toHaveAttribute('href', '/login');
  });
});
