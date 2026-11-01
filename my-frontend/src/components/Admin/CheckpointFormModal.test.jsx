import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import { adminApi } from '../../services/adminApi';

import CheckpointFormModal from './CheckpointFormModal';
import CheckpointList from './CheckpointList';
import TaskList from './TaskList';

// The map is Leaflet; here it only reports what it was given and can "click".
vi.mock('./CheckpointMap', () => ({
  default: ({ picked, onPick, checkpoints, onCheckpointClick }) => (
    <div>
      <div data-testid="pin">{picked ? `${picked.latitude},${picked.longitude}` : 'none'}</div>
      {onPick && <button type="button" onClick={() => onPick({ latitude: 50.5, longitude: 14.25 })}>map click</button>}
      {onCheckpointClick && checkpoints.map(cp => (
        <button type="button" key={cp.id} onClick={() => onCheckpointClick(cp)}>dot {cp.title}</button>
      ))}
    </div>
  ),
}));

vi.mock('../../services/adminApi', () => ({
  adminApi: {
    addCheckpoint: vi.fn(),
    updateCheckpoint: vi.fn(),
    addTask: vi.fn(),
    deleteCheckpoint: vi.fn(),
    deleteTask: vi.fn(),
    getCheckpointTranslations: vi.fn(),
    getTaskTranslations: vi.fn(),
  },
}));

describe('CheckpointFormModal', () => {
  it('creates a checkpoint from pasted Mapy.com coordinates', async () => {
    const onSave = vi.fn().mockResolvedValue();
    render(<CheckpointFormModal onSave={onSave} onCancel={() => {}} />);

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: ' Old Oak ' } });
    fireEvent.change(screen.getByLabelText('Coordinates'), { target: { value: '50.1405N, 14.5702E' } });
    fireEvent.change(screen.getByLabelText('Number of Points'), { target: { value: '7' } });
    expect(screen.getByTestId('pin')).toHaveTextContent('50.1405,14.5702');

    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({
      title: 'Old Oak', description: '', latitude: 50.1405, longitude: 14.5702, numOfPoints: 7,
    }));
  });

  it('clicking the map fills the coordinates', () => {
    render(<CheckpointFormModal onSave={vi.fn()} onCancel={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'map click' }));

    expect(screen.getByLabelText('Coordinates')).toHaveValue('50.5, 14.25');
  });

  it('blocks saving coordinates it cannot read', () => {
    render(<CheckpointFormModal onSave={vi.fn()} onCancel={() => {}} />);

    fireEvent.change(screen.getByLabelText('Coordinates'), { target: { value: '50.1' } });

    expect(screen.getByText(/Use latitude, longitude/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
  });

  it('edits an existing checkpoint', () => {
    render(
      <CheckpointFormModal
        checkpoint={{ id: 3, title: 'Bridge', latitude: 50.1, longitude: 14.2, numOfPoints: 5 }}
        onSave={vi.fn()}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Edit Checkpoint' })).toBeInTheDocument();
    expect(screen.getByLabelText('Coordinates')).toHaveValue('50.1, 14.2');
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled();
  });
});

describe('creating single checkpoints and tasks', () => {
  beforeEach(() => vi.clearAllMocks());

  it('New checkpoint posts one checkpoint and adds it to the list', async () => {
    adminApi.addCheckpoint.mockResolvedValue({ id: 9, title: 'Old Oak', latitude: 50.5, longitude: 14.25, numOfPoints: 0 });
    const onImported = vi.fn();
    render(<CheckpointList raceId={2} checkpoints={[]} onImported={onImported} />);

    fireEvent.click(screen.getByRole('button', { name: '+ New checkpoint' }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Old Oak' } });
    fireEvent.click(screen.getByRole('button', { name: 'map click' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(onImported).toHaveBeenCalledWith([expect.objectContaining({ id: 9 })]));
    expect(adminApi.addCheckpoint).toHaveBeenCalledWith(2, expect.objectContaining({ title: 'Old Oak', latitude: 50.5, longitude: 14.25 }));
    expect(screen.queryByRole('heading', { name: 'New checkpoint' })).not.toBeInTheDocument();
  });

  it('a checkpoint on the overview map opens its edit dialog', () => {
    render(<CheckpointList raceId={2} checkpoints={[{ id: 4, title: 'Bridge', latitude: 50, longitude: 14, numOfPoints: 3 }]} />);

    fireEvent.click(screen.getByRole('button', { name: 'dot Bridge' }));

    expect(screen.getByRole('heading', { name: 'Edit Checkpoint' })).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('Bridge');
  });

  it('New task posts one task', async () => {
    adminApi.addTask.mockResolvedValue({ id: 5, title: 'Sing', numOfPoints: 4 });
    const onImported = vi.fn();
    render(<TaskList raceId={2} tasks={[]} onImported={onImported} />);

    fireEvent.click(screen.getByRole('button', { name: '+ New task' }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Sing' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(adminApi.addTask).toHaveBeenCalledWith(2, { title: 'Sing', description: '', numOfPoints: 0 }));
    expect(onImported).toHaveBeenCalledWith([{ id: 5, title: 'Sing', numOfPoints: 4 }]);
  });
});

describe('checkpoint and task rows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminApi.getCheckpointTranslations.mockResolvedValue([]);
    adminApi.getTaskTranslations.mockResolvedValue([]);
  });

  it('a checkpoint row opens its dialog, which deletes it after confirming', async () => {
    adminApi.deleteCheckpoint.mockResolvedValue({});
    const onRemove = vi.fn();
    render(<CheckpointList raceId={2} onRemove={onRemove} checkpoints={[
      { id: 4, title: 'Bridge', description: '<p>Under the <b>old</b> bridge</p>', latitude: 50, longitude: 14, numOfPoints: 3 },
    ]} />);

    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Bridge.*Under the old bridge/ }));

    expect(screen.getByLabelText('Title')).toHaveValue('Bridge');
    expect(await screen.findByText('No translations yet')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete checkpoint' }));
    expect(screen.getByText(/Visits logged at it/)).toBeInTheDocument();
    expect(adminApi.deleteCheckpoint).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete' }));

    await waitFor(() => expect(onRemove).toHaveBeenCalledWith(4));
    expect(adminApi.deleteCheckpoint).toHaveBeenCalledWith(4);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('a failed delete keeps the dialog open with the reason', async () => {
    adminApi.deleteCheckpoint.mockRejectedValue(new Error('Server down'));
    render(<CheckpointList raceId={2} checkpoints={[{ id: 4, title: 'Bridge', latitude: 50, longitude: 14, numOfPoints: 3 }]} />);

    fireEvent.click(screen.getByRole('button', { name: /^Bridge/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete checkpoint' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Server down');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('flags a checkpoint without a position', () => {
    render(<CheckpointList raceId={2} checkpoints={[{ id: 4, title: 'Somewhere', numOfPoints: 1 }]} />);
    expect(screen.getByText('No position')).toBeInTheDocument();
  });

  it('the import panel opens from the Import button', () => {
    render(<CheckpointList raceId={2} checkpoints={[]} />);
    expect(screen.queryByText('Import checkpoints from JSON file')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    expect(screen.getByText('Import checkpoints from JSON file')).toBeInTheDocument();
  });

  it('a task row opens its dialog, which deletes it after confirming', async () => {
    adminApi.deleteTask.mockResolvedValue({});
    const onRemove = vi.fn();
    render(<TaskList raceId={2} onRemove={onRemove} tasks={[{ id: 5, title: 'Sing', numOfPoints: 4 }]} />);

    fireEvent.click(screen.getByRole('button', { name: /Sing/ }));
    expect(screen.getByLabelText('Title')).toHaveValue('Sing');
    fireEvent.click(screen.getByRole('button', { name: 'Delete task' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete' }));

    await waitFor(() => expect(onRemove).toHaveBeenCalledWith(5));
    expect(adminApi.deleteTask).toHaveBeenCalledWith(5);
  });
});
