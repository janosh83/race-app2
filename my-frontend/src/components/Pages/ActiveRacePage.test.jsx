import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import ActiveRacePage from './ActiveRacePage';

vi.mock('../ActiveRace', () => ({
  default: function MockActiveRace() {
    return <div data-testid="active-race">Active Race Component</div>;
  },
}));

// Auto-selection and the post-login redirect live in TimeContext
// (syncSignedRaces) and Login; see their tests.
describe('ActiveRacePage Component', () => {
  test('renders the race selection component', () => {
    render(
      <MemoryRouter initialEntries={['/race']}>
        <ActiveRacePage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('active-race')).toBeInTheDocument();
  });
});
