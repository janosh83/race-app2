import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import StandingsPage from './StandingsPage';

// Mock the Standings component
vi.mock('../Standings', () => {
  return function MockStandings() {
    return <div data-testid="standings-component">Standings Component</div>;
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

    test('renders without crashing', () => {
      expect(() => {
        render(
          <MemoryRouter>
            <StandingsPage />
          </MemoryRouter>
        );
      }).not.toThrow();
    });
  });

  describe('Component structure', () => {
    test('only renders Standings component', () => {
      const { container } = render(
        <MemoryRouter>
          <StandingsPage />
        </MemoryRouter>
      );

      expect(container.firstChild).toHaveAttribute('data-testid', 'standings-component');
    });
  });
});
