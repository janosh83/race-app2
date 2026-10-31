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
