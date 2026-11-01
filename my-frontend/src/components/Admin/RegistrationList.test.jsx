import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';

import { adminApi } from '../../services/adminApi';

import RegistrationList from './RegistrationList';

vi.mock('../../services/adminApi', () => ({
  adminApi: {
    getRegistrations: vi.fn(),
    getTeams: vi.fn(),
    getRaceCategories: vi.fn(),
    getUsers: vi.fn(),
    addRegistration: vi.fn(),
    deleteRegistration: vi.fn(),
    sendRegistrationEmails: vi.fn(),
  },
}));

const registrations = [
  { team_id: 1, name: 'Alice solo', race_category: 'Runners', members: [{ id: 11, name: 'Alice Thompson' }], payment_confirmed: true, email_sent: true },
  { team_id: 2, name: 'Bob & Eva', race_category: 'Bikes', members: [{ id: 12, name: 'Bob Novák' }, { id: 13, name: 'Eva Svobodová' }], payment_confirmed: true, email_sent: false },
  { team_id: 3, name: 'Ivan solo', race_category: 'Runners', members: [{ id: 14, name: 'Ivan Horák' }], payment_confirmed: false, email_sent: false, disqualified: true },
];

const table = () => within(screen.getAllByRole('table')[0]);

describe('RegistrationList', () => {
  beforeEach(() => {
    adminApi.getRegistrations.mockResolvedValue(registrations);
    adminApi.getTeams.mockResolvedValue([
      { id: 1, name: 'Alice solo' }, { id: 2, name: 'Bob & Eva' }, { id: 3, name: 'Ivan solo' }, { id: 4, name: 'Explorer Team' },
    ]);
    adminApi.getRaceCategories.mockResolvedValue([{ id: 7, name: 'Runners' }]);
    adminApi.getUsers.mockResolvedValue([]);
    adminApi.addRegistration.mockResolvedValue({});
  });

  it('lists registrations first and filters them by status and search', async () => {
    render(<RegistrationList raceId={2} race={{ id: 2 }} />);

    expect(await table().findByText('Bob & Eva')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Unpaid 1/ })).toBeInTheDocument();
    expect(screen.queryByLabelText('Team')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Email not sent 2/ }));
    expect(table().queryByText('Alice solo')).not.toBeInTheDocument();
    expect(table().getByText('Ivan solo')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'eva' } });
    expect(table().getByText('Bob & Eva')).toBeInTheDocument();
    expect(table().queryByText('Ivan solo')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Disqualified 1/ }));
    expect(table().getByText('No registrations match.')).toBeInTheDocument();
  });

  it('registers only teams that are not registered yet', async () => {
    render(<RegistrationList raceId={2} race={{ id: 2 }} />);
    await table().findByText('Bob & Eva');
    await waitFor(() => expect(adminApi.getTeams).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: '+ Register team' }));
    const teamSelect = await screen.findByLabelText('Team');
    await waitFor(() => expect(within(teamSelect).getAllByRole('option').map(o => o.textContent)).toEqual(['Explorer Team']));

    fireEvent.click(screen.getByRole('button', { name: 'Register team' }));
    await waitFor(() => expect(adminApi.addRegistration).toHaveBeenCalledWith(2, { team_id: 4, race_category_id: 7 }));
  });

  it('reports sent registration emails on the page', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    adminApi.sendRegistrationEmails.mockResolvedValue({ sent: 2, failed: 0 });
    render(<RegistrationList raceId={2} race={{ id: 2 }} />);
    await table().findByText('Bob & Eva');

    fireEvent.click(screen.getByRole('button', { name: 'Send Registration Emails' }));

    expect(await screen.findByRole('status')).toHaveTextContent(/2/);
  });

  it('deletes a registration after confirming in its details, without a browser pop-up', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    adminApi.deleteRegistration.mockResolvedValue({});
    render(<RegistrationList raceId={2} race={{ id: 2 }} />);
    await table().findByText('Bob & Eva');

    fireEvent.click(table().getAllByRole('button', { name: 'Show details' })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
    expect(screen.getAllByText(/Delete the registration of Alice solo/).length).toBeGreaterThan(0);
    expect(adminApi.deleteRegistration).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole('button', { name: 'Keep' })[0]);
    expect(screen.queryByText(/Delete the registration of/)).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Yes, delete' })[0]);

    await waitFor(() => expect(adminApi.deleteRegistration).toHaveBeenCalledWith(2, 1));
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('explains why a registration with logged visits cannot be deleted', async () => {
    const err = new Error('Cannot delete');
    err.payload = { code: 'registration_has_visits', visits: 3 };
    adminApi.deleteRegistration.mockRejectedValue(err);
    render(<RegistrationList raceId={2} race={{ id: 2 }} />);
    await table().findByText('Bob & Eva');

    fireEvent.click(table().getAllByRole('button', { name: 'Show details' })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Yes, delete' })[0]);

    expect((await screen.findAllByText(/3 logged visits in this race/)).length).toBeGreaterThan(0);
    expect(adminApi.deleteRegistration).toHaveBeenCalledWith(2, 1);
  });
});
