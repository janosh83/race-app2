import { apiFetch } from '../utils/api';

export const raceApi = {
  // Fetch checkpoints status for a team in a race
  getCheckpointsStatus: (raceId, teamId) => apiFetch(`/api/race/${raceId}/checkpoints/${teamId}/status/`),

  // Log a visit for a checkpoint (POST)
  logVisit: (raceId, body) => apiFetch(`/api/race/${raceId}/checkpoints/log/`, { method: 'POST', body }),

  // Delete a visit for a checkpoint (DELETE)
  deleteVisit: (raceId, body) => apiFetch(`/api/race/${raceId}/checkpoints/log/`, { method: 'DELETE', body }),

  // Get race results (used by Standings)
  getResults: (raceId) => apiFetch(`/api/race/${raceId}/results/`),
};
