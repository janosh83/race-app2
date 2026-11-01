import { render, screen, within } from '@testing-library/react';
import React from 'react';

import { adminApi } from '../../services/adminApi';

import RaceStatistics from './RaceStatistics';

vi.mock('../../services/adminApi', () => ({
  adminApi: { getRaceStatistics: vi.fn() },
}));

describe('RaceStatistics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the most favourite checkpoints', async () => {
    adminApi.getRaceStatistics.mockResolvedValue({
      favourites_count: 5,
      teams_with_favourites_count: 3,
      top_favourite_checkpoints: [
        { checkpoint_id: 2, title: 'Bravo', favourites_count: 3 },
        { checkpoint_id: 1, title: 'Alpha', favourites_count: 1 },
      ],
    });

    render(<RaceStatistics raceId={1} />);

    const heading = await screen.findByText('Most favourite');
    const items = within(heading.parentElement).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(['Bravo★ 3', 'Alpha★ 1']);
    const tile = screen.getByText('Favourite marks').closest('.card');
    expect(tile).toHaveTextContent('5');
    expect(tile).toHaveTextContent('by 3 teams');
    expect(adminApi.getRaceStatistics).toHaveBeenCalledWith(1);
  });

  it('sums up visits and completions in the tile row', async () => {
    adminApi.getRaceStatistics.mockResolvedValue({
      registered_teams_count: 4, checkpoints_count: 6, visits_count: 13, checkpoints_with_visits_count: 5,
      tasks_count: 2, task_completions_count: 3, tasks_with_completions_count: 2,
    });

    render(<RaceStatistics raceId={1} />);

    expect((await screen.findByText('Visits')).closest('.card')).toHaveTextContent('13at 5 of 6 checkpoints');
    expect(screen.getByText('Task completions').closest('.card')).toHaveTextContent('3for 2 of 2 tasks');
    expect(screen.getByText('Registered teams').closest('.card')).toHaveTextContent('4');
  });
});
