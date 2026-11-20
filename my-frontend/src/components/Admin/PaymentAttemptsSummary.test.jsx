import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';

import { adminApi } from '../../services/adminApi';

import PaymentAttemptsSummary from './PaymentAttemptsSummary';

vi.mock('../../services/adminApi', () => ({
  adminApi: {
    getRegistrations: vi.fn(),
    getRegistrationEmailLogs: vi.fn(),
    reconcileRegistrationPayment: vi.fn(),
    retryFailedRegistrationEmails: vi.fn(),
    retryRegistrationEmailLog: vi.fn(),
  },
}));

const registrations = [
  {
    team_id: 1, name: 'Želvy', payment_confirmed: true,
    payment_details: { attempts: [{ id: 11, status: 'confirmed', amount_cents: 50000, currency: 'czk', created_at: '2026-10-24T11:04:11Z' }] },
  },
  {
    team_id: 2, name: 'Alice solo', payment_confirmed: false,
    payment_details: { attempts: [{ id: 12, status: 'pending', amount_cents: 50000, currency: 'czk', created_at: '2026-10-25T11:04:11Z', stripe_session_id: 'cs_1' }] },
  },
];

describe('PaymentAttemptsSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminApi.getRegistrations.mockResolvedValue(registrations);
    adminApi.getRegistrationEmailLogs.mockResolvedValue({ data: [] });
  });

  it('sums up payments in one row and offers reconcile only for unconfirmed attempts', async () => {
    render(<PaymentAttemptsSummary raceId={3} />);

    const paid = (await screen.findByText('Paid')).closest('.card');
    expect(paid).toHaveTextContent('1 / 2');
    expect(screen.getByText('pending 1')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Reconcile with Stripe' })).toHaveLength(1);
  });

  it('filters email logs by a team picked by name, applying at once', async () => {
    render(<PaymentAttemptsSummary raceId={3} />);
    const teamSelect = await screen.findByLabelText('Team');
    await waitFor(() => expect(within(teamSelect).getAllByRole('option').map(o => o.textContent))
      .toEqual(['Any team', 'Alice solo', 'Želvy']));

    fireEvent.change(teamSelect, { target: { value: '2' } });

    await waitFor(() => expect(adminApi.getRegistrationEmailLogs).toHaveBeenLastCalledWith(3, expect.objectContaining({ team_id: '2' })));
    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    await waitFor(() => expect(adminApi.getRegistrationEmailLogs).toHaveBeenLastCalledWith(3, expect.not.objectContaining({ team_id: expect.anything() })));
  });
});
