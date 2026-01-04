import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MapPage from './MapPage';

// Mock the Map component
jest.mock('../Map', () => {
  return function MockMap({ topOffset }) {
    return <div data-testid="map-component">Map Component (topOffset: {topOffset})</div>;
  };
});

// Mock useOutletContext
const mockUseOutletContext = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useOutletContext: () => mockUseOutletContext(),
}));

describe('MapPage Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Component rendering', () => {
    test('renders Map component', () => {
      mockUseOutletContext.mockReturnValue({ navHeight: 56 });

      render(
        <MemoryRouter>
          <MapPage />
        </MemoryRouter>
      );

      expect(screen.getByTestId('map-component')).toBeInTheDocument();
    });
  });

  describe('NavHeight context', () => {
    test('passes navHeight from outlet context to Map as topOffset', () => {
      mockUseOutletContext.mockReturnValue({ navHeight: 64 });

      render(
        <MemoryRouter>
          <MapPage />
        </MemoryRouter>
      );

      expect(screen.getByText(/topOffset: 64/)).toBeInTheDocument();
    });

    test('handles different navHeight values', () => {
      mockUseOutletContext.mockReturnValue({ navHeight: 100 });

      render(
        <MemoryRouter>
          <MapPage />
        </MemoryRouter>
      );

      expect(screen.getByText(/topOffset: 100/)).toBeInTheDocument();
    });

    test('handles undefined navHeight', () => {
      mockUseOutletContext.mockReturnValue({});

      render(
        <MemoryRouter>
          <MapPage />
        </MemoryRouter>
      );

      expect(screen.getByText(/topOffset: undefined/)).toBeInTheDocument();
    });

    test('handles null navHeight', () => {
      mockUseOutletContext.mockReturnValue({ navHeight: null });

      render(
        <MemoryRouter>
          <MapPage />
        </MemoryRouter>
      );

      expect(screen.getByText(/topOffset: null/)).toBeInTheDocument();
    });

    test('handles zero navHeight', () => {
      mockUseOutletContext.mockReturnValue({ navHeight: 0 });

      render(
        <MemoryRouter>
          <MapPage />
        </MemoryRouter>
      );

      expect(screen.getByText(/topOffset: 0/)).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    test('renders without crashing when outlet context is empty', () => {
      mockUseOutletContext.mockReturnValue({});

      render(
        <MemoryRouter>
          <MapPage />
        </MemoryRouter>
      );

      expect(screen.getByTestId('map-component')).toBeInTheDocument();
    });

    test('renders without crashing when outlet context is null', () => {
      mockUseOutletContext.mockReturnValue(null);

      expect(() => {
        render(
          <MemoryRouter>
            <MapPage />
          </MemoryRouter>
        );
      }).toThrow();
    });
  });
});
