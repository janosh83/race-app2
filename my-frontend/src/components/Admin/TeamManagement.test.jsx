import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { adminApi } from '../../services/adminApi';

import TeamManagement from './TeamManagement';

vi.mock('../../services/adminApi', () => ({
  adminApi: {
    getTeams: vi.fn(),
    getUsers: vi.fn(),
    getTeamMembers: vi.fn(),
    createTeam: vi.fn(),
    updateTeam: vi.fn(),
    deleteTeam: vi.fn(),
    getTeamRegistrations: vi.fn(),
  },
}));

const renderPage = () => render(<MemoryRouter><TeamManagement /></MemoryRouter>);

const users = [
  { id: 1, name: 'Alice Thompson', email: 'alice@example.com' },
  { id: 2, name: 'Bob Novák', email: 'bob@example.com' },
  { id: 3, name: 'Eva Svobodová', email: 'eva@example.com' },
];

describe('TeamManagement', () => {
  beforeEach(() => {
    adminApi.getTeams.mockResolvedValue({ data: [{ id: 5, name: 'Bob & Eva' }], meta: { total: 1 } });
    adminApi.getUsers.mockResolvedValue(users);
    adminApi.getTeamMembers.mockResolvedValue([users[1], users[2]]);
    adminApi.createTeam.mockResolvedValue({ id: 9, name: 'Night Owls' });
    adminApi.updateTeam.mockResolvedValue({});
    adminApi.getTeamRegistrations.mockResolvedValue([]);
  });

  it('lists teams first and creates a team with members from one dialog', async () => {
    renderPage();

    expect(await screen.findByText('Bob Novák, Eva Svobodová')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Teams/ })).toHaveTextContent('(1)');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '+ New team' }));
    const dialog = within(screen.getByRole('dialog'));
    fireEvent.change(dialog.getByLabelText('Team name'), { target: { value: 'Night Owls' } });
    fireEvent.change(dialog.getByLabelText('Add members'), { target: { value: 'alice' } });
    fireEvent.click(dialog.getByRole('checkbox'));
    expect(dialog.getByText('Members')).toHaveTextContent('(1)');
    fireEvent.click(dialog.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(adminApi.updateTeam).toHaveBeenCalledWith(9, { user_ids: [1] }));
    expect(adminApi.createTeam).toHaveBeenCalledWith({ name: 'Night Owls' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('edits a team from its row, removing a member chip', async () => {
    renderPage();
    fireEvent.click(await screen.findByText('Bob Novák, Eva Svobodová'));

    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByLabelText('Team name')).toHaveValue('Bob & Eva');
    fireEvent.click(dialog.getByRole('button', { name: 'Remove Eva Svobodová' }));
    fireEvent.click(dialog.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(adminApi.updateTeam).toHaveBeenCalledWith(5, { name: 'Bob & Eva', user_ids: [2] }));
  });

  it('deletes a team after confirming in the dialog', async () => {
    adminApi.deleteTeam.mockResolvedValue({});
    renderPage();
    fireEvent.click(await screen.findByText('Bob Novák, Eva Svobodová'));

    const dialog = within(screen.getByRole('dialog'));
    fireEvent.click(dialog.getByRole('button', { name: 'Delete team' }));
    expect(adminApi.deleteTeam).not.toHaveBeenCalled();
    fireEvent.click(dialog.getByRole('button', { name: 'Yes, delete' }));

    await waitFor(() => expect(adminApi.deleteTeam).toHaveBeenCalledWith(5));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('explains why a registered team cannot be deleted', async () => {
    const err = new Error('Cannot delete');
    err.payload = { code: 'team_has_registrations' };
    adminApi.deleteTeam.mockRejectedValue(err);
    renderPage();
    fireEvent.click(await screen.findByText('Bob Novák, Eva Svobodová'));

    const dialog = within(screen.getByRole('dialog'));
    fireEvent.click(dialog.getByRole('button', { name: 'Delete team' }));
    fireEvent.click(dialog.getByRole('button', { name: 'Yes, delete' }));

    expect(await dialog.findByRole('alert')).toHaveTextContent('registered for a race');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('lists the races the team is registered for, linking to their registrations', async () => {
    adminApi.getTeamRegistrations.mockResolvedValue([
      { race_id: 4, race_name: 'Autumn Picnic', race_category: 'Bikes', start_logging_at: '2026-10-10T08:00:00', end_logging_at: '2026-10-10T18:00:00', payment_confirmed: true, disqualified: false },
      { race_id: 1, race_name: 'Spring Picnic', race_category: 'Runners', start_logging_at: '2026-04-10T08:00:00', end_logging_at: '2026-04-10T18:00:00', payment_confirmed: false, disqualified: true },
    ]);
    renderPage();
    fireEvent.click(await screen.findByText('Bob Novák, Eva Svobodová'));

    const dialog = within(screen.getByRole('dialog'));
    const link = await dialog.findByRole('link', { name: 'Autumn Picnic' });
    expect(link).toHaveAttribute('href', '/admin?race=4&section=registrations');
    expect(adminApi.getTeamRegistrations).toHaveBeenCalledWith(5);
    expect(dialog.getByText('Registered for races')).toHaveTextContent('(2)');
    expect(dialog.getByText('Disqualified')).toBeInTheDocument();
    expect(dialog.getByText('Unpaid')).toBeInTheDocument();
  });

  it('does not ask for races when creating a team', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '+ New team' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(adminApi.getTeamRegistrations).not.toHaveBeenCalled();
  });
});
