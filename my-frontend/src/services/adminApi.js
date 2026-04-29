import { apiFetch } from '../utils/api';

export const adminApi = {
  listRaces: () => apiFetch('/api/race/'),  // OK
  createRace: (payload) => apiFetch('/api/race/', { method: 'POST', body: payload }),  // OK
  updateRace: (raceId, payload) => apiFetch(`/api/race/${raceId}/`, { method: 'PUT', body: payload }),  // OK

  getRegistrations: (raceId) => apiFetch(`/api/team/race/${raceId}/`), // OK
  addRegistration: (raceId, payload) => apiFetch(`/api/team/race/${raceId}/`, { method: 'POST', body: payload }),
  deleteRegistration: (raceId, teamId) => apiFetch(`/api/team/race/${raceId}/team/${teamId}/`, { method: 'DELETE' }),
  setDisqualification: (raceId, teamId, disqualified) => apiFetch(
    `/api/team/race/${raceId}/team/${teamId}/disqualify/`,
    { method: 'PATCH', body: { disqualified } }
  ),
  retryRegistrationPayment: (raceId, teamId, payment_type) => apiFetch(
    `/api/race/${raceId}/team/${teamId}/payments/retry/`,
    { method: 'POST', body: { payment_type } }
  ),
  markRegistrationPayment: (raceId, teamId, payment_type, confirmed) => apiFetch(
    `/api/race/${raceId}/team/${teamId}/payments/mark/`,
    { method: 'PATCH', body: { payment_type, confirmed } }
  ),
  reconcileRegistrationPayment: (raceId, teamId, payment_type, stripe_session_id) => apiFetch(
    `/api/race/${raceId}/team/${teamId}/payments/reconcile/`,
    { method: 'POST', body: { payment_type, stripe_session_id } }
  ),
  sendRegistrationEmails: (raceId, payload = {}) => apiFetch(`/api/team/race/${raceId}/send-registration-emails/`, { method: 'POST', body: payload }),
  getRegistrationEmailLogs: (raceId, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiFetch(`/api/team/race/${raceId}/email-logs/${query ? `?${query}` : ''}`);
  },
  retryFailedRegistrationEmails: (raceId, payload = {}) => apiFetch(`/api/team/race/${raceId}/retry-failed-emails/`, { method: 'POST', body: payload }),
  retryRegistrationEmailLog: (raceId, logId) => apiFetch(`/api/team/race/${raceId}/email-logs/${logId}/retry/`, { method: 'POST' }),
  getResults: (raceId) => apiFetch(`/api/race/${raceId}/results/`), // OK
  getRaceStatistics: (raceId) => apiFetch(`/api/race/${raceId}/statistics/`),

  // User management (admin)
  getUsers: () => apiFetch('/api/user/'),
  registerAdminUser: (payload) => apiFetch('/auth/register-admin/', { method: 'POST', body: payload }),
  createUser: (payload) => apiFetch('/api/user/', { method: 'POST', body: payload }),
  updateUser: (userId, payload) => apiFetch(`/api/user/${userId}/`, { method: 'PUT', body: payload }),
  deleteUser: (userId) => apiFetch(`/api/user/${userId}/`, { method: 'DELETE' }),

  // Checkpoint management
  getCheckpointsByRaceID: (raceId) => apiFetch(`/api/race/${raceId}/checkpoints/`), // OK
  addCheckpoint: (raceId, payload) => apiFetch(`/api/race/${raceId}/checkpoints/`, { method: 'POST', body: payload }),
  deleteCheckpoint: (checkpointId) => apiFetch(`/api/checkpoint/${checkpointId}/`, { method: 'DELETE' }), // OK
  updateCheckpoint: (checkpointId, payload) => apiFetch(`/api/checkpoint/${checkpointId}/`, { method: 'PUT', body: payload }), // OK

  // Task management
  getTasksByRaceID: (raceId) => apiFetch(`/api/race/${raceId}/tasks/`),
  addTask: (raceId, payload) => apiFetch(`/api/race/${raceId}/tasks/`, { method: 'POST', body: payload }),
  deleteTask: (taskId) => apiFetch(`/api/task/${taskId}/`, { method: 'DELETE' }),
  updateTask: (taskId, payload) => apiFetch(`/api/task/${taskId}/`, { method: 'PUT', body: payload }), // OK

  getStandings: (raceId) => apiFetch(`/api/admin/races/${raceId}/standings/`),
  getVisitsByTeamAndRace: (teamId, raceId) => apiFetch(`/api/race/${raceId}/visits/${teamId}/`), // OK
  addVisit: (raceId, payload) => apiFetch(`/api/race/${raceId}/checkpoints/log/`, { method: 'POST', body: payload }),
  deleteVisit: (raceId, payload) => apiFetch(`/api/race/${raceId}/checkpoints/log/`, { method: 'DELETE', body: payload }), // OK
  getVisitsByCheckpoint: (checkpointId) => apiFetch(`/api/admin/checkpoints/${checkpointId}/visits/`),
  getTaskCompletionsByTeamAndRace: (teamId, raceId) => apiFetch(`/api/race/${raceId}/task-completions/${teamId}/`), // OK
  deleteTaskCompletion: (raceId, payload) => apiFetch(`/api/race/${raceId}/tasks/log/`, { method: 'DELETE', body: payload }), // OK

  // Team management
  getTeams: () => apiFetch('/api/team/'),
  getTeamMembers: (teamId) => apiFetch(`/api/team/${teamId}/members/`),
  createTeam: (payload) => apiFetch('/api/team/', { method: 'POST', body: payload }),
  addTeamMembers: (teamId, payload) => apiFetch(`/api/team/${teamId}/members/`, { method: 'POST', body: payload }),

  // race-category endpoints
  // list all global categories
  listCategories: () => apiFetch('/api/race-category/'),
  // create global category
  createCategory: (payload) => apiFetch('/api/race-category/', { method: 'POST', body: payload }),
  // delete global category
  deleteCategory: (categoryId) => apiFetch(`/api/race-category/${categoryId}/`, { method: 'DELETE' }),

  // per-race category assignment endpoints
  getRaceCategories: (raceId) => apiFetch(`/api/race/${raceId}/categories/`),
  addRaceCategory: (raceId, raceCategoryId) => apiFetch(`/api/race/${raceId}/categories/`, { method: 'POST', body: { race_category_id: raceCategoryId } }),
  removeRaceCategory: (raceId, raceCategoryId) => apiFetch(`/api/race/${raceId}/categories/`, { method: 'DELETE', body: { race_category_id: raceCategoryId } }),

  // Translation management endpoints
  // Race translations
  getRaceTranslations: (raceId) => apiFetch(`/api/race/${raceId}/translations/`),
  createRaceTranslation: (raceId, language, payload) => apiFetch(`/api/race/${raceId}/translations/`, { method: 'POST', body: { ...payload, language } }),
  updateRaceTranslation: (raceId, language, payload) => apiFetch(`/api/race/${raceId}/translations/${language}/`, { method: 'PUT', body: payload }),
  deleteRaceTranslation: (raceId, language) => apiFetch(`/api/race/${raceId}/translations/${language}/`, { method: 'DELETE' }),

  // Checkpoint translations
  getCheckpointTranslations: (checkpointId) => apiFetch(`/api/checkpoint/${checkpointId}/translations/`),
  createCheckpointTranslation: (checkpointId, language, payload) => apiFetch(`/api/checkpoint/${checkpointId}/translations/`, { method: 'POST', body: { ...payload, language } }),
  updateCheckpointTranslation: (checkpointId, language, payload) => apiFetch(`/api/checkpoint/${checkpointId}/translations/${language}/`, { method: 'PUT', body: payload }),
  deleteCheckpointTranslation: (checkpointId, language) => apiFetch(`/api/checkpoint/${checkpointId}/translations/${language}/`, { method: 'DELETE' }),

  // Task translations
  getTaskTranslations: (taskId) => apiFetch(`/api/task/${taskId}/translations/`),
  createTaskTranslation: (taskId, language, payload) => apiFetch(`/api/task/${taskId}/translations/`, { method: 'POST', body: { ...payload, language } }),
  updateTaskTranslation: (taskId, language, payload) => apiFetch(`/api/task/${taskId}/translations/${language}/`, { method: 'PUT', body: payload }),
  deleteTaskTranslation: (taskId, language) => apiFetch(`/api/task/${taskId}/translations/${language}/`, { method: 'DELETE' }),

  // Race category translations
  getCategoryTranslations: (categoryId) => apiFetch(`/api/race-category/${categoryId}/translations/`),
  createCategoryTranslation: (categoryId, language, payload) => apiFetch(`/api/race-category/${categoryId}/translations/`, { method: 'POST', body: { ...payload, language } }),
  updateCategoryTranslation: (categoryId, language, payload) => apiFetch(`/api/race-category/${categoryId}/translations/${language}/`, { method: 'PUT', body: payload }),
  deleteCategoryTranslation: (categoryId, language) => apiFetch(`/api/race-category/${categoryId}/translations/${language}/`, { method: 'DELETE' }),

  // Add other necessary endpoints...
};
