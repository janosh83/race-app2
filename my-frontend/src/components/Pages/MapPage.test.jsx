import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import MapPage from './MapPage';

// Mock the Map component
vi.mock('../Map', () => {
  return {
    default: function MockMap({ topOffset }) {
      return <div data-testid="map-component">Map Component (topOffset: {String(topOffset)})</div>;
    },
  };
});

// Mock useOutletContext
const mockUseOutletContext = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');

  return {
    ...actual,
    useOutletContext: () => mockUseOutletContext(),
  };
});

describe('MapPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    test('uses zero topOffset for undefined navHeight', () => {
      mockUseOutletContext.mockReturnValue({});

      render(
        <MemoryRouter>
          <MapPage />
        </MemoryRouter>
      );

      expect(screen.getByText(/topOffset: 0/)).toBeInTheDocument();
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

    test('uses zero topOffset when outlet context is null', () => {
      mockUseOutletContext.mockReturnValue(null);

      render(
        <MemoryRouter>
          <MapPage />
        </MemoryRouter>
      );

      expect(screen.getByText(/topOffset: 0/)).toBeInTheDocument();
    });
  });
});
