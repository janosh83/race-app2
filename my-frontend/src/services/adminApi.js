import { apiFetch } from '../utils/api';

export const adminApi = {
  listRaces: () => apiFetch('/api/race/'),
  // FIXME: adjust endpoint as needed
  createRace: (payload) => apiFetch('/api/admin/races/', { method: 'POST', body: payload }),
  getRegistrations: (raceId) => apiFetch(`/api/admin/races/${raceId}/registrations/`),
  updateRegistration: (raceId, payload) => apiFetch(`/api/admin/races/${raceId}/registrations/`, { method: 'PUT', body: payload }),
  getResults: (raceId) => apiFetch(`/api/admin/races/${raceId}/results/`),
  getLogs: (raceId) => apiFetch(`/api/admin/races/${raceId}/logs/`),
  listTeams: () => apiFetch('/api/admin/teams/'),
  listCategories: () => apiFetch('/api/admin/categories/'),
};