import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import { adminApi } from '../../services/adminApi';

import RaceForm from './RaceForm';

vi.mock('../../services/adminApi', () => ({
  adminApi: {
    createRace: vi.fn(),
    updateRace: vi.fn(),
    getRaceTranslations: vi.fn(),
  },
}));

vi.mock('./CheckpointMap', () => ({
  default: ({ markers, onPick }) => (
    <button type="button" onClick={() => onPick({ latitude: 50.5, longitude: 14.5 })}>
      map with {markers.length} other places
    </button>
  ),
}));

const race = {
  id: 3,
  name: 'City Race',
  description: '',
  race_greeting: '',
  supported_languages: ['en'],
  default_language: 'en',
  finish_description: 'Pub',
  finish_latitude: 50.1,
  finish_longitude: 14.2,
  bivak_1_name: 'Camp',
  bivak_1_latitude: 50.2,
  bivak_1_longitude: 14.3,
  registration_enabled: false,
  allow_team_registration: false,
  allow_individual_registration: true,
  registration_currency: 'czk',
  registration_team_amount_cents: 60000,
  registration_driver_amount_cents: 40000,
  registration_codriver_amount_cents: 20000,
};

describe('RaceForm', () => {
  beforeEach(() => {
    adminApi.updateRace.mockImplementation((id, payload) => Promise.resolve({ id, ...payload }));
    adminApi.getRaceTranslations.mockResolvedValue([]);
  });

  it('labels every field and shows only the prices of the registration mode', () => {
    render(<RaceForm race={race} />);

    expect(screen.getByLabelText('Name')).toHaveValue('City Race');
    expect(screen.getByLabelText('Race greeting')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Coordinates')[0]).toHaveValue('50.1, 14.2');
    expect(screen.getByLabelText('Driver price (CZK)')).toHaveValue(400);
    expect(screen.queryByLabelText('Team price (CZK)')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Min team size')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Teams'));
    expect(screen.getByLabelText('Team price (CZK)')).toHaveValue(600);
    expect(screen.getByLabelText('Min team size')).toBeInTheDocument();
  });

  it('blocks saving on coordinates it cannot read', () => {
    render(<RaceForm race={race} />);

    fireEvent.change(screen.getAllByLabelText('Coordinates')[1], { target: { value: 'somewhere' } });

    expect(screen.getByText('Fix the coordinates of Bivak 1.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('saves pasted and picked positions and keeps the hidden mode prices', async () => {
    render(<RaceForm race={race} />);

    fireEvent.change(screen.getAllByLabelText('Coordinates')[0], { target: { value: '49.8N, 15.1E' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Map' })[2]);
    fireEvent.click(screen.getByText('map with 2 other places'));
    expect(screen.getAllByLabelText('Coordinates')[2]).toHaveValue('50.5, 14.5');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(adminApi.updateRace).toHaveBeenCalled());
    expect(adminApi.updateRace.mock.calls[0][1]).toEqual(expect.objectContaining({
      finish_latitude: 49.8,
      finish_longitude: 15.1,
      bivak_2_latitude: 50.5,
      bivak_2_longitude: 14.5,
      registration_team_amount_cents: 60000,
      registration_driver_amount_cents: 40000,
    }));
  });

  it('saves offsets instead of absolute windows for a registration-shifted race', async () => {
    render(<RaceForm race={race} />);

    fireEvent.click(screen.getByLabelText('Registration-based shift'));
    expect(screen.queryByLabelText('Start logging after registration (hours)')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Start showing after registration (hours)'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('End showing after registration (hours)'), { target: { value: '48' } });
    fireEvent.change(screen.getByLabelText('Start logging after registration (hours)'), { target: { value: '1.5' } });
    fireEvent.change(screen.getByLabelText('End logging after registration (hours)'), { target: { value: '24' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(adminApi.updateRace).toHaveBeenCalled());
    const payload = adminApi.updateRace.mock.calls.at(-1)[1];
    expect(payload).toMatchObject({
      time_constraint_mode: 'registration_shift',
      start_showing_offset_seconds: 0,
      end_showing_offset_seconds: 48 * 3600,
      start_logging_offset_seconds: 5400,
      end_logging_offset_seconds: 24 * 3600,
    });
    expect(payload).not.toHaveProperty('start_logging_at');
  });

  it('blocks saving when a shift window ends before it starts', () => {
    render(<RaceForm race={{ ...race, time_constraint_mode: 'registration_shift', start_logging_offset_seconds: 7200, end_logging_offset_seconds: 3600, start_showing_offset_seconds: 0, end_showing_offset_seconds: 7200 }} />);

    expect(screen.getByLabelText('End logging after registration (hours)')).toHaveValue(1);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});
