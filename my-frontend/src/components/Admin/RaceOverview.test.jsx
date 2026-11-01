import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import RaceOverview from './RaceOverview';

vi.mock('./CheckpointMap', () => ({
  default: ({ checkpoints, markers }) => <div>map with {checkpoints.length} checkpoints and {markers.length} places</div>,
}));

const race = {
  id: 1,
  name: 'City Race',
  race_greeting: 'Welcome!',
  description: 'Run around.',
  default_language: 'en',
  supported_languages: ['en', 'cs'],
  registration_enabled: true,
  registration_slug: 'city-race',
  registration_currency: 'czk',
  allow_team_registration: true,
  allow_individual_registration: false,
  min_team_size: 2,
  max_team_size: 4,
  registration_team_amount_cents: 60000,
  registration_driver_amount_cents: 40000,
  registration_codriver_amount_cents: 20000,
  finish_description: 'Pub',
  finish_latitude: 50.1,
  finish_longitude: 14.2,
};

describe('RaceOverview', () => {
  it('shows the team price and size for team registration', () => {
    render(<RaceOverview race={race} checkpoints={[{ id: 1, latitude: 50, longitude: 14 }]} tasks={[]} />);

    expect(screen.getByText('Team · 2–4 members')).toBeInTheDocument();
    expect(screen.getByText('Team price')).toBeInTheDocument();
    expect(screen.queryByText('Driver price')).not.toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '/register/city-race' })).toHaveAttribute('href', expect.stringContaining('/register/city-race'));
    expect(screen.getByText('map with 1 checkpoints and 1 places')).toBeInTheDocument();
  });

  it('shows driver and codriver prices for individual registration', () => {
    render(<RaceOverview race={{ ...race, allow_team_registration: false, allow_individual_registration: true }} />);

    expect(screen.getByText('Driver price')).toBeInTheDocument();
    expect(screen.getByText('Codriver price')).toBeInTheDocument();
    expect(screen.queryByText('Team price')).not.toBeInTheDocument();
  });

  it('previews translated texts from a flag', () => {
    render(
      <RaceOverview
        race={race}
        translations={[{ language: 'cs', race_greeting: 'Vítejte!', description: 'Běhejte.' }]}
      />,
    );

    fireEvent.click(screen.getByAltText('cs'));

    expect(screen.getByText('Vítejte!')).toBeInTheDocument();
    expect(screen.getByText('Běhejte.')).toBeInTheDocument();
  });
});
