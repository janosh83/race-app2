import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import AdminPage from './AdminPage';

vi.mock('../Admin/AdminDashboard', () => ({
  default: () => <div data-testid="admin-dashboard">Dashboard</div>,
}));

vi.mock('../Admin/TeamManagement', () => ({
  default: () => <div data-testid="team-management">Teams</div>,
}));

vi.mock('../Admin/Users', () => ({
  default: () => <div data-testid="admin-users">Users</div>,
}));

describe('AdminPage', () => {
  test('renders races tab and dashboard by default', () => {
    render(<AdminPage />);

    expect(screen.getByRole('tablist', { name: 'Admin sections' })).toBeInTheDocument();

    const racesTab = screen.getByRole('tab', { name: 'Races' });
    expect(racesTab).toHaveAttribute('type', 'button');
    expect(racesTab).toHaveAttribute('aria-selected', 'true');

    expect(screen.getByTestId('admin-dashboard')).toBeInTheDocument();
    expect(screen.queryByTestId('team-management')).not.toBeInTheDocument();
    expect(screen.queryByTestId('admin-users')).not.toBeInTheDocument();
  });

  test('switches to teams tab and updates aria state', () => {
    render(<AdminPage />);

    const racesTab = screen.getByRole('tab', { name: 'Races' });
    const teamsTab = screen.getByRole('tab', { name: 'Teams' });

    fireEvent.click(teamsTab);

    expect(teamsTab).toHaveAttribute('aria-selected', 'true');
    expect(racesTab).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByTestId('team-management')).toBeInTheDocument();
    expect(screen.queryByTestId('admin-dashboard')).not.toBeInTheDocument();
  });

  test('switches to users tab and renders users panel', () => {
    render(<AdminPage />);

    const usersTab = screen.getByRole('tab', { name: 'Users' });
    fireEvent.click(usersTab);

    expect(usersTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('admin-users')).toBeInTheDocument();
    expect(screen.queryByTestId('admin-dashboard')).not.toBeInTheDocument();
    expect(screen.queryByTestId('team-management')).not.toBeInTheDocument();
  });
});
