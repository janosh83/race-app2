import { render, screen, fireEvent, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';

import { adminApi } from '../../services/adminApi';

import AdminDashboard from './AdminDashboard';

vi.mock('../../services/adminApi', () => ({
  adminApi: {
    listRaces: vi.fn(),
    getCheckpointsByRaceID: vi.fn(),
    getTasksByRaceID: vi.fn(),
    getRaceTranslations: vi.fn(),
    getResults: vi.fn(),
  },
}));

// The section bodies have their own tests; here they only need to show up.
vi.mock('./VisitsList', () => ({ default: ({ teamId }) => <div>visits of {teamId}</div> }));
vi.mock('./CheckpointList', () => ({ default: () => <div>checkpoint list</div> }));
vi.mock('./TaskList', () => ({ default: () => <div>task list</div> }));
vi.mock('./TeamPathsMap', () => ({ default: () => <div>team paths</div> }));
vi.mock('./RaceStatistics', () => ({ default: () => <div>statistics</div> }));

const HOUR = 3_600_000;
const iso = (offsetHours) => new Date(Date.now() + offsetHours * HOUR).toISOString();

const races = [
  {
    id: 1,
    name: 'City Race',
    start_showing_checkpoints_at: iso(-48),
    end_showing_checkpoints_at: iso(48),
    start_logging_at: iso(-24),
    end_logging_at: iso(24),
  },
  {
    id: 2,
    name: 'Future Race',
    start_showing_checkpoints_at: iso(24),
    end_showing_checkpoints_at: iso(72),
    start_logging_at: iso(30),
    end_logging_at: iso(60),
  },
];

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.search}</div>;
}

const renderAt = (search = '') => render(
  <MemoryRouter initialEntries={[`/admin${search}`]}>
    <AdminDashboard />
    <LocationDisplay />
  </MemoryRouter>
);

describe('AdminDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminApi.listRaces.mockResolvedValue(races);
    adminApi.getCheckpointsByRaceID.mockResolvedValue([]);
    adminApi.getTasksByRaceID.mockResolvedValue([]);
    adminApi.getRaceTranslations.mockResolvedValue([]);
    adminApi.getResults.mockResolvedValue([
      { team_id: 7, team: 'Rockets', category: 'Cars', points_for_checkpoints: 10, points_for_tasks: 2, total_points: 12 },
    ]);
  });

  test('lists races with their current phase', async () => {
    renderAt();

    const cityRow = await screen.findByRole('button', { name: /City Race/ });
    expect(within(cityRow).getByText('Logging open')).toBeInTheDocument();
    const futureRow = screen.getByRole('button', { name: /Future Race/ });
    expect(within(futureRow).getByText('Before checkpoints are shown')).toBeInTheDocument();
  });

  test('opening a race shows its overview full width and puts it in the URL', async () => {
    renderAt();

    fireEvent.click(await screen.findByRole('button', { name: /City Race/ }));

    expect(screen.getByRole('heading', { name: 'City Race' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('button', { name: /Future Race/ })).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('?race=1');
  });

  test('switching sections updates the URL', async () => {
    renderAt('?race=1');

    fireEvent.click(await screen.findByRole('button', { name: 'Statistics' }));

    expect(screen.getByText('statistics')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('?race=1&section=statistics');
  });

  test('a reload restores the race, section and the team being reviewed', async () => {
    renderAt('?race=1&section=results&team=7');

    expect(await screen.findByText('visits of 7')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Visits — Rockets' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Results & visits' })).toHaveAttribute('aria-current', 'page');
  });

  test('back to races clears the opened race', async () => {
    renderAt('?race=1&section=results');

    fireEvent.click(await screen.findByRole('button', { name: /‹ Races/ }));

    expect(await screen.findByRole('button', { name: /Future Race/ })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toBeEmptyDOMElement();
  });

  test('says so when the race in the URL does not exist', async () => {
    renderAt('?race=99');

    expect(await screen.findByText('This race was not found.')).toBeInTheDocument();
  });
});
