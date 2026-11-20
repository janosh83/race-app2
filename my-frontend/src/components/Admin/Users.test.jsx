import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';

import { adminApi } from '../../services/adminApi';

import Users from './Users';

vi.mock('../../services/adminApi', () => ({
  adminApi: {
    getUsers: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    deleteUser: vi.fn(),
  },
}));

const users = [
  { id: 1, name: 'Admin User', email: 'admin@example.com', is_administrator: true, preferred_language: 'en' },
  { id: 2, name: 'Alice Thompson', email: 'alice@example.com', is_administrator: false, preferred_language: null },
];

describe('Users', () => {
  beforeEach(() => {
    localStorage.setItem('user', JSON.stringify({ id: 1, name: 'Admin User' }));
    adminApi.getUsers.mockResolvedValue({ data: users, meta: { total: 2 } });
    adminApi.createUser.mockResolvedValue({ id: 3 });
    adminApi.updateUser.mockResolvedValue({});
    adminApi.deleteUser.mockResolvedValue({});
  });

  afterEach(() => localStorage.clear());

  it('lists users first and creates one from the dialog', async () => {
    render(<Users />);

    expect(await screen.findByText('Alice Thompson')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Users/ })).toHaveTextContent('(2)');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('You')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '+ New user' }));
    const dialog = within(screen.getByRole('dialog'));
    fireEvent.change(dialog.getByLabelText('Name'), { target: { value: 'Night Owl' } });
    fireEvent.change(dialog.getByLabelText('Email'), { target: { value: 'owl@example.com' } });
    fireEvent.change(dialog.getByLabelText('Password'), { target: { value: 'secret' } });
    fireEvent.click(dialog.getByRole('switch', { name: 'Administrator' }));
    fireEvent.click(dialog.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(adminApi.createUser).toHaveBeenCalledWith({
      name: 'Night Owl', email: 'owl@example.com', password: 'secret', is_administrator: true,
    }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('edits a user without sending an empty password', async () => {
    render(<Users />);
    fireEvent.click(await screen.findByText('Alice Thompson'));

    const dialog = within(screen.getByRole('dialog'));
    fireEvent.change(dialog.getByLabelText('Preferred language'), { target: { value: 'cs' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(adminApi.updateUser).toHaveBeenCalledWith(2, {
      name: 'Alice Thompson', email: 'alice@example.com', is_administrator: false, preferred_language: 'cs',
    }));
  });

  it('shows a taken email inside the dialog', async () => {
    const err = new Error('User with this email already exists');
    err.status = 409;
    adminApi.updateUser.mockRejectedValue(err);
    render(<Users />);
    fireEvent.click(await screen.findByText('Alice Thompson'));

    const dialog = within(screen.getByRole('dialog'));
    fireEvent.click(dialog.getByRole('button', { name: 'Save Changes' }));

    expect(await dialog.findByRole('alert')).toHaveTextContent('already exists');
  });

  it('deletes a user after confirming, but not the signed-in admin', async () => {
    render(<Users />);
    fireEvent.click(await screen.findByText('Admin User'));
    let dialog = within(screen.getByRole('dialog'));
    expect(dialog.queryByRole('button', { name: 'Delete user' })).not.toBeInTheDocument();
    expect(dialog.getByRole('switch', { name: 'Administrator' })).toBeDisabled();
    fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }));

    fireEvent.click(screen.getByText('Alice Thompson'));
    dialog = within(screen.getByRole('dialog'));
    fireEvent.click(dialog.getByRole('button', { name: 'Delete user' }));
    expect(adminApi.deleteUser).not.toHaveBeenCalled();
    fireEvent.click(dialog.getByRole('button', { name: 'Yes, delete' }));

    await waitFor(() => expect(adminApi.deleteUser).toHaveBeenCalledWith(2));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
