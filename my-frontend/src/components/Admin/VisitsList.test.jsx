import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';

import { adminApi } from '../../services/adminApi';

import VisitsList from './VisitsList';

vi.mock('../../services/adminApi', () => ({
  adminApi: {
    getVisitsByTeamAndRace: vi.fn(),
    getTaskCompletionsByTeamAndRace: vi.fn(),
  },
}));

const visit = (id, checkpoint, distances) => ({
  id,
  checkpoint_id: id,
  team_id: 1,
  checkpoint,
  created_at: `2026-05-01T10:0${id}:00`,
  image_distance_km: null,
  user_distance_km: null,
  ...distances,
});

// Heading -> card header -> card content (holds the distance box).
const cardOf = (heading) => heading.parentElement.parentElement;

describe('VisitsList position review', () => {
  beforeEach(() => {
    adminApi.getTaskCompletionsByTeamAndRace.mockResolvedValue([]);
    adminApi.getVisitsByTeamAndRace.mockResolvedValue([
      visit(1, 'No position', {}),
      visit(2, 'Device only far', { user_distance_km: 0.45 }),
      visit(3, 'Photo near device far', { image_distance_km: 0.03, user_distance_km: 2.5 }),
      visit(4, 'Photo far device near', { image_distance_km: 1.2, user_distance_km: 0.01 }),
    ]);
  });

  it('warns when both positions are missing', async () => {
    render(<VisitsList teamId={1} raceId={1} />);

    const card = cardOf(await screen.findByText('No position'));
    expect(within(card).getByRole('alert')).toHaveTextContent('Verify this visit manually');
    expect(within(card).queryByText('used')).not.toBeInTheDocument();
  });

  it('uses the only available position', async () => {
    render(<VisitsList teamId={1} raceId={1} />);

    const card = cardOf(await screen.findByText('Device only far'));
    expect(within(card).getByRole('alert')).toHaveTextContent('Device was 450 m from the checkpoint');
    expect(within(card).getByText('Device position:')).toContainElement(within(card).getByText('used'));
  });

  it('judges by the photo when both positions are available', async () => {
    render(<VisitsList teamId={1} raceId={1} />);

    const nearCard = cardOf(await screen.findByText('Photo near device far'));
    expect(within(nearCard).queryByRole('alert')).not.toBeInTheDocument();
    expect(within(nearCard).getByText('Photo position:')).toContainElement(within(nearCard).getByText('used'));
    expect(within(nearCard).getByText('30 m')).toBeInTheDocument();
    expect(within(nearCard).getByText('2500 m')).toBeInTheDocument();

    const farCard = cardOf(screen.getByText('Photo far device near'));
    expect(within(farCard).getByRole('alert')).toHaveTextContent('Photo taken 1200 m from the checkpoint');
  });
});

describe('VisitsList photos and summary', () => {
  beforeEach(() => {
    adminApi.getTaskCompletionsByTeamAndRace.mockResolvedValue([
      { id: 5, task_id: 5, team_id: 1, task: 'Sing a song', created_at: '2026-05-01T10:09:00', image_filename: 'song.jpg' },
    ]);
    adminApi.getVisitsByTeamAndRace.mockResolvedValue([
      visit(1, 'Old mill', { image_filename: 'mill.jpg', image_distance_km: 0.01 }),
      visit(2, 'Bridge', { user_distance_km: 0.9 }),
    ]);
  });

  it('counts visits, tasks and the ones to check', async () => {
    render(<VisitsList teamId={1} raceId={1} />);

    expect(await screen.findByText('Checkpoints: 2')).toBeInTheDocument();
    expect(screen.getByText('Tasks: 1')).toBeInTheDocument();
    expect(screen.getByText(/To check: 1/)).toBeInTheDocument();
  });

  it('goes through the photos with arrow keys and closes with Escape', async () => {
    render(<VisitsList teamId={1} raceId={1} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Open photo: Sing a song' }));
    const viewer = screen.getByRole('dialog', { name: 'Sing a song' });
    expect(within(viewer).getByText('1 / 2')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByRole('dialog', { name: 'Old mill' })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByRole('dialog', { name: 'Sing a song' })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
