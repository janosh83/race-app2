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

    const heading = await screen.findByText('Most favourite checkpoints');
    const items = within(heading.parentElement).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(['Bravo★ 3', 'Alpha★ 1']);
    expect(screen.getByText('Favourite marks').nextSibling).toHaveTextContent('5');
    expect(screen.getByText('Teams with favourites').nextSibling).toHaveTextContent('3');
    expect(adminApi.getRaceStatistics).toHaveBeenCalledWith(1);
  });
});
