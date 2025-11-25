import { apiFetch } from '../utils/api';

export const adminApi = {
  listRaces: () => apiFetch('/api/race/'),  // OK
  createRace: (payload) => apiFetch('/api/race/', { method: 'POST', body: payload }),  // OK
  updateRace: (raceId, payload) => apiFetch(`/api/race/${raceId}/`, { method: 'PUT', body: payload }),  // OK
  getRegistrations: (raceId) => apiFetch(`/api/admin/races/${raceId}/registrations/`),
  updateRegistration: (raceId, payload) => apiFetch(`/api/admin/races/${raceId}/registrations/`, { method: 'PUT', body: payload }),
  getResults: (raceId) => apiFetch(`/api/race/${raceId}/results/`), // OK
  getLogs: (raceId) => apiFetch(`/api/admin/races/${raceId}/logs/`),
  listTeams: () => apiFetch('/api/admin/teams/'),
  listCategories: () => apiFetch('/api/race-category/'),
  addCheckpoint: (raceId, payload) => apiFetch(`/api/admin/races/${raceId}/checkpoints/`, { method: 'POST', body: payload }),
  getStandings: (raceId) => apiFetch(`/api/admin/races/${raceId}/standings/`),
  getVisitsByTeam: (teamId) => apiFetch(`/api/admin/teams/${teamId}/visits/`),
  addVisit: (teamId, payload) => apiFetch(`/api/admin/teams/${teamId}/visits/`, { method: 'POST', body: payload }),
  deleteVisit: (visitId) => apiFetch(`/api/admin/visits/${visitId}/`, { method: 'DELETE' }),
  createCategory: (payload) => apiFetch('/api/admin/categories/', { method: 'POST', body: payload }),
  deleteCategory: (categoryId) => apiFetch(`/api/admin/categories/${categoryId}/`, { method: 'DELETE' }),
  getVisitsByCheckpoint: (checkpointId) => apiFetch(`/api/admin/checkpoints/${checkpointId}/visits/`),
  getCheckpointsByRaceID: (raceId) => apiFetch(`/api/race/${raceId}/checkpoints/`), // OK
  // Add other necessary endpoints...
};