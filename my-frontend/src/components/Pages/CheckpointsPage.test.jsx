import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import CheckpointsPage from './CheckpointsPage';

vi.mock('../CheckpointsList', () => {
  return function MockCheckpointsList({ topOffset }) {
    return <div data-testid="checkpoints-list">Checkpoints List (topOffset: {String(topOffset)})</div>;
  };
});

const mockUseOutletContext = vi.fn();
vi.mock('react-router-dom', () => ({
  ...vi.requireActual('react-router-dom'),
  useOutletContext: () => mockUseOutletContext(),
}));

describe('CheckpointsPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders CheckpointsList component', () => {
    mockUseOutletContext.mockReturnValue({ navHeight: 56 });

    render(
      <MemoryRouter>
        <CheckpointsPage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('checkpoints-list')).toBeInTheDocument();
  });

  test('passes navHeight from outlet context as topOffset', () => {
    mockUseOutletContext.mockReturnValue({ navHeight: 72 });

    render(
      <MemoryRouter>
        <CheckpointsPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/topOffset: 72/)).toBeInTheDocument();
  });
});
