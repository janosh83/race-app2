import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';

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
  },
}));

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
  });

  it('lists teams first and creates a team with members from one dialog', async () => {
    render(<TeamManagement />);

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
    render(<TeamManagement />);
    fireEvent.click(await screen.findByText('Bob Novák, Eva Svobodová'));

    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByLabelText('Team name')).toHaveValue('Bob & Eva');
    fireEvent.click(dialog.getByRole('button', { name: 'Remove Eva Svobodová' }));
    fireEvent.click(dialog.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(adminApi.updateTeam).toHaveBeenCalledWith(5, { name: 'Bob & Eva', user_ids: [2] }));
  });

  it('deletes a team after confirming in the dialog', async () => {
    adminApi.deleteTeam.mockResolvedValue({});
    render(<TeamManagement />);
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
    render(<TeamManagement />);
    fireEvent.click(await screen.findByText('Bob Novák, Eva Svobodová'));

    const dialog = within(screen.getByRole('dialog'));
    fireEvent.click(dialog.getByRole('button', { name: 'Delete team' }));
    fireEvent.click(dialog.getByRole('button', { name: 'Yes, delete' }));

    expect(await dialog.findByRole('alert')).toHaveTextContent('registered for a race');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
