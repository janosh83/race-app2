import { apiFetch, fetchRaw } from '../utils/api';

export const raceApi = {
  // Fetch checkpoints status for a team in a race
  getCheckpointsStatus: (raceId, teamId) => apiFetch(`/api/race/${raceId}/checkpoints/${teamId}/status/`),

  // Log a visit for a checkpoint with optional image (multipart/form-data)
  logVisitWithImage: async (raceId, formData) => {
    const response = await fetchRaw(`/api/race/${raceId}/checkpoints/log/`, {
      method: 'POST',
      body: formData
      // Don't set Content-Type - browser will set it with boundary for FormData
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Failed to log visit');
    }
    return response.json();
  },

  // Log a visit for a checkpoint (POST) - JSON version
  logVisit: (raceId, body) => apiFetch(`/api/race/${raceId}/checkpoints/log/`, { method: 'POST', body }),

  // Delete a visit for a checkpoint (DELETE)
  deleteVisit: (raceId, body) => apiFetch(`/api/race/${raceId}/checkpoints/log/`, { method: 'DELETE', body }),

  // Get race results (used by Standings)
  getResults: (raceId) => apiFetch(`/api/race/${raceId}/results/`),
};
