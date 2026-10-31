import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

import FilePickerButton from './FilePickerButton';

const mockPointer = (coarse) => {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: coarse && query === '(pointer: coarse)',
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
};

describe('FilePickerButton', () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  test('shows a single file chooser with a mouse', () => {
    mockPointer(false);
    render(<FilePickerButton accept="image/*" onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Choose file' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Take photo/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId('file-picker-camera-input')).not.toBeInTheDocument();
  });

  test('offers the camera and the gallery on a touch screen', () => {
    mockPointer(true);
    render(<FilePickerButton accept="image/*" onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: /Take photo/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose from gallery' })).toBeInTheDocument();
    expect(screen.getByTestId('file-picker-camera-input')).toHaveAttribute('capture', 'environment');
  });

  test('the camera button opens the camera input', () => {
    mockPointer(true);
    render(<FilePickerButton accept="image/*" onChange={vi.fn()} />);
    const cameraInput = screen.getByTestId('file-picker-camera-input');
    const click = vi.spyOn(cameraInput, 'click');

    fireEvent.click(screen.getByRole('button', { name: /Take photo/ }));

    expect(click).toHaveBeenCalled();
  });

  test('shows the chosen file name', () => {
    mockPointer(false);
    render(<FilePickerButton accept="image/*" onChange={vi.fn()} fileName="cp1.jpg" />);

    expect(screen.getByText('cp1.jpg')).toBeInTheDocument();
  });
});
