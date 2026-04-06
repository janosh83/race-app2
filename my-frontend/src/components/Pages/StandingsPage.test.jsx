import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import StandingsPage from './StandingsPage';

// Mock the Standings component
vi.mock('../Standings', () => {
  return {
    default: function MockStandings() {
      return <div data-testid="standings-component">Standings Component</div>;
    },
  };
});

describe('StandingsPage Component', () => {
  describe('Component rendering', () => {
    test('renders Standings component', () => {
      render(
        <MemoryRouter>
          <StandingsPage />
        </MemoryRouter>
      );

      expect(screen.getByTestId('standings-component')).toBeInTheDocument();
    });
  });
});
