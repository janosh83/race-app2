import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import L from 'leaflet';
import React from 'react';

import { adminApi } from '../../services/adminApi';

import TeamPathsMap, { buildTeamPaths, getTeamColor } from './TeamPathsMap';

vi.mock('leaflet/dist/leaflet.css', () => ({ default: {} }));

vi.mock('leaflet', () => {
  const chainable = () => {
    const layer = {};
    ['addTo', 'bindTooltip', 'bindPopup', 'on'].forEach(name => {
      layer[name] = vi.fn(() => layer);
    });
    return layer;
  };
  const mockMap = {
    setView: vi.fn(function setView() { return this; }),
    fitBounds: vi.fn(),
    remove: vi.fn(),
  };
  const layerGroup = () => ({ addTo: vi.fn(function addTo() { return this; }), clearLayers: vi.fn() });

  return {
    __esModule: true,
    default: {
      map: vi.fn(() => mockMap),
      tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
      layerGroup: vi.fn(layerGroup),
      polyline: vi.fn(chainable),
      circleMarker: vi.fn(chainable),
    },
  };
});

vi.mock('../../services/adminApi', () => ({
  adminApi: { getRaceTeamPaths: vi.fn() },
}));

const payload = {
  race_id: 1,
  checkpoints: [
    { id: 1, title: 'CP 1', latitude: 50.0, longitude: 14.0, numOfPoints: 1 },
    { id: 2, title: 'CP 2', latitude: 50.1, longitude: 14.1, numOfPoints: 1 },
    { id: 3, title: 'CP 3', latitude: 50.2, longitude: 14.2, numOfPoints: 1 },
  ],
  teams: [
    {
      team_id: 10,
      team_name: 'Alpha',
      disqualified: false,
      visits: [
        { checkpoint_id: 3, created_at: '2026-05-01T10:00:00' },
        { checkpoint_id: 1, created_at: '2026-05-01T10:30:00' },
      ],
    },
    { team_id: 20, team_name: 'Beta', disqualified: true, visits: [{ checkpoint_id: 2, created_at: '2026-05-01T11:00:00' }] },
  ],
};

describe('TeamPathsMap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminApi.getRaceTeamPaths.mockResolvedValue(payload);
  });

  it('builds paths in visit order and gives each team a distinct color', () => {
    const checkpointsById = new Map(payload.checkpoints.map(cp => [cp.id, cp]));
    const [alpha, beta] = buildTeamPaths(payload.teams, checkpointsById);

    expect(alpha.points.map(p => p.latLng)).toEqual([[50.2, 14.2], [50.0, 14.0]]);
    expect(beta.points).toHaveLength(1);
    expect(alpha.color).toBe(getTeamColor(0));
    expect(beta.color).toBe(getTeamColor(1));
    expect(alpha.color).not.toBe(beta.color);
  });

  it('draws a polyline per team with more than one visit and lets teams be hidden', async () => {
    render(<TeamPathsMap raceId={1} />);

    expect(await screen.findByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(adminApi.getRaceTeamPaths).toHaveBeenCalledWith(1);

    await waitFor(() => expect(L.polyline).toHaveBeenCalledTimes(1));
    expect(L.polyline.mock.calls[0][0]).toEqual([[50.2, 14.2], [50.0, 14.0]]);
    expect(L.polyline.mock.calls[0][1].color).toBe(getTeamColor(0));

    L.polyline.mockClear();
    fireEvent.click(screen.getByLabelText('Alpha'));
    await waitFor(() => expect(screen.getByLabelText('Alpha')).not.toBeChecked());
    expect(L.polyline).not.toHaveBeenCalled();
  });
});
