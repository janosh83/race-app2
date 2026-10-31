import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { TimeProvider } from '../../contexts/TimeContext';
import { logoutAndRedirect } from '../../utils/api';

import AdminLayout from './AdminLayout';

vi.mock('../../utils/api');

describe('AdminLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('user', JSON.stringify({ username: 'admin', is_administrator: true }));
  });

  afterEach(() => {
    localStorage.clear();
  });

  test('shows the logo, app name and an Admin label in the slim brand bar', () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <TimeProvider>
          <AdminLayout />
        </TimeProvider>
      </MemoryRouter>
    );

    const nav = screen.getByRole('navigation');
    expect(nav).toHaveClass('brand-navbar', 'brand-navbar-admin');
    expect(nav.querySelector('img')).toHaveAttribute('src', '/logo192.png');
    expect(screen.getByText('Race App')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toHaveClass('brand-navbar-admin-label');
  });

  test('logout ends the session the same way as the race view', () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <TimeProvider>
          <AdminLayout />
        </TimeProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Logout' }));

    expect(logoutAndRedirect).toHaveBeenCalled();
  });
});
