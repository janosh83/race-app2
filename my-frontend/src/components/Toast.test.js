import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import Toast from './Toast';

describe('Toast', () => {
  it('renders with message and type', () => {
    const onClose = jest.fn();
    render(<Toast message="Test message" type="error" onClose={onClose} duration={0} />);
    
    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = jest.fn();
    render(<Toast message="Test message" type="info" onClose={onClose} duration={0} />);
    
    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);
    
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('auto-dismisses after duration', async () => {
    const onClose = jest.fn();
    render(<Toast message="Test message" type="success" onClose={onClose} duration={100} />);
    
    expect(onClose).not.toHaveBeenCalled();
    
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    }, { timeout: 200 });
  });

  it('does not auto-dismiss when duration is 0', async () => {
    const onClose = jest.fn();
    render(<Toast message="Test message" type="warning" onClose={onClose} duration={0} />);
    
    await new Promise(resolve => setTimeout(resolve, 150));
    
    expect(onClose).not.toHaveBeenCalled();
  });
});
