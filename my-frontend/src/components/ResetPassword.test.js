import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ResetPassword from './ResetPassword';
import { authApi } from '../services/authApi';

// Mock dependencies
jest.mock('../services/authApi');

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Helper function to render component with router
const renderWithRouter = (initialEntry = '/reset-password?token=valid-token') => {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPassword />} />
      </Routes>
    </MemoryRouter>
  );
};

describe('ResetPassword Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Component rendering', () => {
    test('renders reset password form with token', () => {
      renderWithRouter('/reset-password?token=valid-token');

      expect(screen.getByRole('heading', { name: 'Reset Password' })).toBeInTheDocument();
      expect(screen.getByLabelText('New Password')).toBeInTheDocument();
      expect(screen.getByLabelText('Confirm New Password')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Reset Password' })).toBeInTheDocument();
    });

    test('renders back to login link', () => {
      renderWithRouter('/reset-password?token=valid-token');

      const backLink = screen.getByRole('link', { name: 'Back to Login' });
      expect(backLink).toBeInTheDocument();
      expect(backLink).toHaveAttribute('href', '/login');
    });

    test('shows warning when token is missing', () => {
      renderWithRouter('/reset-password');

      const alerts = screen.getAllByText(/Invalid or missing reset token/i);
      expect(alerts.length).toBeGreaterThan(0);
      expect(screen.queryByLabelText('New Password')).not.toBeInTheDocument();
    });

    test('shows error alert when token is missing on mount', () => {
      renderWithRouter('/reset-password');

      const errorAlerts = screen.getAllByRole('alert');
      const errorAlert = errorAlerts.find(alert => alert.classList.contains('alert-danger'));
      expect(errorAlert).toHaveTextContent('Invalid or missing reset token');
      expect(errorAlert).toHaveClass('alert-danger');
    });
  });

  describe('Form validation', () => {
    test('shows error when passwords do not match', async () => {
      renderWithRouter('/reset-password?token=valid-token');

      const passwordInput = screen.getByLabelText('New Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
      const submitButton = screen.getByRole('button', { name: 'Reset Password' });

      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'password456' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
      });

      expect(authApi.resetPassword).not.toHaveBeenCalled();
    });

    test('shows error when password is too short', async () => {
      renderWithRouter('/reset-password?token=valid-token');

      const passwordInput = screen.getByLabelText('New Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
      const submitButton = screen.getByRole('button', { name: 'Reset Password' });

      fireEvent.change(passwordInput, { target: { value: '12345' } });
      fireEvent.change(confirmPasswordInput, { target: { value: '12345' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Password must be at least 6 characters long')).toBeInTheDocument();
      });

      expect(authApi.resetPassword).not.toHaveBeenCalled();
    });

    test('accepts valid password with minimum length', async () => {
      renderWithRouter('/reset-password?token=valid-token');
      authApi.resetPassword.mockResolvedValue({ msg: 'Success' });

      const passwordInput = screen.getByLabelText('New Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
      const submitButton = screen.getByRole('button', { name: 'Reset Password' });

      fireEvent.change(passwordInput, { target: { value: '123456' } });
      fireEvent.change(confirmPasswordInput, { target: { value: '123456' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(authApi.resetPassword).toHaveBeenCalledWith('valid-token', '123456');
      });
    });

    test('password inputs have required attribute', () => {
      renderWithRouter('/reset-password?token=valid-token');

      const passwordInput = screen.getByLabelText('New Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm New Password');

      expect(passwordInput).toBeRequired();
      expect(confirmPasswordInput).toBeRequired();
    });

    test('password inputs have minLength attribute', () => {
      renderWithRouter('/reset-password?token=valid-token');

      const passwordInput = screen.getByLabelText('New Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm New Password');

      expect(passwordInput).toHaveAttribute('minLength', '6');
      expect(confirmPasswordInput).toHaveAttribute('minLength', '6');
    });
  });

  describe('Form submission', () => {
    test('calls authApi.resetPassword with correct parameters', async () => {
      renderWithRouter('/reset-password?token=test-token-123');
      authApi.resetPassword.mockResolvedValue({ msg: 'Password reset successfully' });

      const passwordInput = screen.getByLabelText('New Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
      const submitButton = screen.getByRole('button', { name: 'Reset Password' });

      fireEvent.change(passwordInput, { target: { value: 'newPassword123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'newPassword123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(authApi.resetPassword).toHaveBeenCalledWith('test-token-123', 'newPassword123');
      });
    });

    test('shows success message on successful reset', async () => {
      renderWithRouter('/reset-password?token=valid-token');
      authApi.resetPassword.mockResolvedValue({ msg: 'Password has been reset' });

      const passwordInput = screen.getByLabelText('New Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
      const submitButton = screen.getByRole('button', { name: 'Reset Password' });

      fireEvent.change(passwordInput, { target: { value: 'newPassword123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'newPassword123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Password has been reset')).toBeInTheDocument();
      });
    });

    test('shows default success message when API response has no msg', async () => {
      renderWithRouter('/reset-password?token=valid-token');
      authApi.resetPassword.mockResolvedValue({});

      const passwordInput = screen.getByLabelText('New Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
      const submitButton = screen.getByRole('button', { name: 'Reset Password' });

      fireEvent.change(passwordInput, { target: { value: 'newPassword123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'newPassword123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Password reset successfully')).toBeInTheDocument();
      });
    });

    test('navigates to login after successful reset', async () => {
      renderWithRouter('/reset-password?token=valid-token');
      authApi.resetPassword.mockResolvedValue({ msg: 'Success' });

      const passwordInput = screen.getByLabelText('New Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
      const submitButton = screen.getByRole('button', { name: 'Reset Password' });

      fireEvent.change(passwordInput, { target: { value: 'newPassword123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'newPassword123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Success')).toBeInTheDocument();
      });

      jest.advanceTimersByTime(2000);

      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });

    test('shows error message on failed reset', async () => {
      renderWithRouter('/reset-password?token=valid-token');
      authApi.resetPassword.mockRejectedValue(new Error('Invalid or expired token'));

      const passwordInput = screen.getByLabelText('New Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
      const submitButton = screen.getByRole('button', { name: 'Reset Password' });

      fireEvent.change(passwordInput, { target: { value: 'newPassword123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'newPassword123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Invalid or expired token')).toBeInTheDocument();
      });

      expect(mockNavigate).not.toHaveBeenCalled();
    });

    test('shows default error message when error has no message', async () => {
      renderWithRouter('/reset-password?token=valid-token');
      authApi.resetPassword.mockRejectedValue({});

      const passwordInput = screen.getByLabelText('New Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
      const submitButton = screen.getByRole('button', { name: 'Reset Password' });

      fireEvent.change(passwordInput, { target: { value: 'newPassword123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'newPassword123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to reset password')).toBeInTheDocument();
      });
    });
  });

  describe('Loading state', () => {
    test('shows loading text on submit button during submission', async () => {
      renderWithRouter('/reset-password?token=valid-token');
      authApi.resetPassword.mockImplementation(() => new Promise(() => {})); // Never resolves

      const passwordInput = screen.getByLabelText('New Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
      const submitButton = screen.getByRole('button', { name: 'Reset Password' });

      fireEvent.change(passwordInput, { target: { value: 'newPassword123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'newPassword123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Resetting...' })).toBeInTheDocument();
      });
    });

    test('disables inputs during submission', async () => {
      renderWithRouter('/reset-password?token=valid-token');
      authApi.resetPassword.mockImplementation(() => new Promise(() => {})); // Never resolves

      const passwordInput = screen.getByLabelText('New Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
      const submitButton = screen.getByRole('button', { name: 'Reset Password' });

      fireEvent.change(passwordInput, { target: { value: 'newPassword123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'newPassword123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(passwordInput).toBeDisabled();
        expect(confirmPasswordInput).toBeDisabled();
        expect(submitButton).toBeDisabled();
      });
    });

    test('re-enables inputs after successful submission', async () => {
      renderWithRouter('/reset-password?token=valid-token');
      authApi.resetPassword.mockResolvedValue({ msg: 'Success' });

      const passwordInput = screen.getByLabelText('New Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
      const submitButton = screen.getByRole('button', { name: 'Reset Password' });

      fireEvent.change(passwordInput, { target: { value: 'newPassword123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'newPassword123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(passwordInput).not.toBeDisabled();
        expect(confirmPasswordInput).not.toBeDisabled();
        expect(submitButton).not.toBeDisabled();
      });
    });

    test('re-enables inputs after failed submission', async () => {
      renderWithRouter('/reset-password?token=valid-token');
      authApi.resetPassword.mockRejectedValue(new Error('Server error'));

      const passwordInput = screen.getByLabelText('New Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
      const submitButton = screen.getByRole('button', { name: 'Reset Password' });

      fireEvent.change(passwordInput, { target: { value: 'newPassword123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'newPassword123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Server error')).toBeInTheDocument();
      });

      expect(passwordInput).not.toBeDisabled();
      expect(confirmPasswordInput).not.toBeDisabled();
      expect(submitButton).not.toBeDisabled();
    });
  });

  describe('Message clearing', () => {
    test('clears previous error when submitting again', async () => {
      renderWithRouter('/reset-password?token=valid-token');

      const passwordInput = screen.getByLabelText('New Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
      const submitButton = screen.getByRole('button', { name: 'Reset Password' });

      // First submission with error
      fireEvent.change(passwordInput, { target: { value: 'short' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'short' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Password must be at least 6 characters long')).toBeInTheDocument();
      });

      // Second submission
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'different' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.queryByText('Password must be at least 6 characters long')).not.toBeInTheDocument();
        expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
      });
    });

    test('clears previous success message when submitting again', async () => {
      renderWithRouter('/reset-password?token=valid-token');
      authApi.resetPassword.mockResolvedValueOnce({ msg: 'First success' });

      const passwordInput = screen.getByLabelText('New Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
      const submitButton = screen.getByRole('button', { name: 'Reset Password' });

      // First submission
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('First success')).toBeInTheDocument();
      });

      // Clear timer before second submission
      jest.runOnlyPendingTimers();
      mockNavigate.mockClear();

      // Second submission with validation error
      authApi.resetPassword.mockResolvedValueOnce({ msg: 'Second success' });
      fireEvent.change(passwordInput, { target: { value: 'newpass123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'different' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.queryByText('First success')).not.toBeInTheDocument();
        expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
      });
    });
  });

  describe('Input updates', () => {
    test('updates password field on change', () => {
      renderWithRouter('/reset-password?token=valid-token');

      const passwordInput = screen.getByLabelText('New Password');
      fireEvent.change(passwordInput, { target: { value: 'myNewPassword' } });

      expect(passwordInput.value).toBe('myNewPassword');
    });

    test('updates confirm password field on change', () => {
      renderWithRouter('/reset-password?token=valid-token');

      const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
      fireEvent.change(confirmPasswordInput, { target: { value: 'confirmValue' } });

      expect(confirmPasswordInput.value).toBe('confirmValue');
    });
  });

  describe('Token parameter variations', () => {
    test('handles empty token parameter', () => {
      renderWithRouter('/reset-password?token=');

      expect(screen.getByText('Invalid or missing reset token')).toBeInTheDocument();
      expect(screen.queryByLabelText('New Password')).not.toBeInTheDocument();
    });

    test('handles multiple query parameters', () => {
      renderWithRouter('/reset-password?token=valid-token&utm_source=email');

      expect(screen.getByLabelText('New Password')).toBeInTheDocument();
      expect(screen.queryByText('Invalid or missing reset token')).not.toBeInTheDocument();
    });

    test('extracts token from complex URL', async () => {
      renderWithRouter('/reset-password?foo=bar&token=complex-token-123&baz=qux');
      authApi.resetPassword.mockResolvedValue({ msg: 'Success' });

      const passwordInput = screen.getByLabelText('New Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
      const submitButton = screen.getByRole('button', { name: 'Reset Password' });

      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(authApi.resetPassword).toHaveBeenCalledWith('complex-token-123', 'password123');
      });
    });
  });
});
