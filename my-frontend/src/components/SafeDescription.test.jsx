import { render, screen } from '@testing-library/react';
import React from 'react';

import SafeDescription from './SafeDescription';

describe('SafeDescription', () => {
  test('renders supported formatting and removes unsafe HTML', () => {
    const { container } = render(
      <SafeDescription html={'<p>Find the <strong>blue flag</strong>.</p><ul><li>Take a photo</li></ul><a href="https://example.com" onclick="alert(1)">Details</a><a href="javascript:alert(1)">Unsafe link</a><script>alert(1)</script>'} />
    );

    expect(screen.getByText('blue flag').tagName).toBe('STRONG');
    expect(screen.getByText('Take a photo').tagName).toBe('LI');
    expect(screen.getByRole('link', { name: 'Details' })).toHaveAttribute('href', 'https://example.com');
    expect(screen.getByText('Unsafe link')).not.toHaveAttribute('href');
    expect(container.querySelector('script')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Details' })).not.toHaveAttribute('onclick');
  });
});