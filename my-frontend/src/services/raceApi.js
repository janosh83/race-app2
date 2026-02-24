import { apiFetch, fetchRaw } from '../utils/api';
import { logger } from '../utils/logger';

export const raceApi = {
  getRegistrationBySlug: (slug, language) => {
    const query = language ? `?lang=${encodeURIComponent(language)}` : '';
    const url = `/api/race/registration/${encodeURIComponent(slug)}/${query}`;
    logger.info('RACE', 'Fetching race registration by slug', { slug, language });
    return apiFetch(url, { noAuth: true, noRedirectOnAuthFailure: true }).then(result => {
      logger.success('RACE', 'Race registration fetched', { slug });
      return result;
    }).catch(err => {
      logger.error('RACE', 'Failed to fetch race registration by slug', err.message);
      throw err;
    });
  },

  createTeamPublic: (name) => {
    logger.info('RACE', 'Creating public team', { name });
    return apiFetch('/api/team/', {
      method: 'POST',
      body: { name },
      noAuth: true,
      noRedirectOnAuthFailure: true,
    }).then(result => {
      logger.success('RACE', 'Public team created', { teamId: result?.id });
      return result;
    }).catch(err => {
      logger.error('RACE', 'Failed to create public team', err.message);
      throw err;
    });
  },

  addTeamMembersPublic: (teamId, members) => {
    logger.info('RACE', 'Adding members to public team', { teamId, memberCount: members?.length || 0 });
    return apiFetch(`/api/team/${teamId}/members/`, {
      method: 'POST',
      body: { members },
      noAuth: true,
      noRedirectOnAuthFailure: true,
    }).then(result => {
      logger.success('RACE', 'Members added to public team', { teamId });
      return result;
    }).catch(err => {
      logger.error('RACE', 'Failed adding members to public team', err.message);
      throw err;
    });
  },

  signUpTeamPublic: (raceId, teamId, raceCategoryId) => {
    logger.info('RACE', 'Submitting public race registration', { raceId, teamId, raceCategoryId });
    return apiFetch(`/api/team/race/${raceId}/`, {
      method: 'POST',
      body: {
        team_id: teamId,
        race_category_id: raceCategoryId,
      },
      noAuth: true,
      noRedirectOnAuthFailure: true,
    }).then(result => {
      logger.success('RACE', 'Public race registration submitted', { raceId, teamId });
      return result;
    }).catch(err => {
      logger.error('RACE', 'Public race registration failed', err.message);
      throw err;
    });
  },

  getTeamsPublic: () => {
    logger.info('RACE', 'Fetching teams for public registration');
    return apiFetch('/api/team/', {
      noAuth: true,
      noRedirectOnAuthFailure: true,
    }).then(result => {
      logger.success('RACE', 'Public teams fetched', { count: result?.length || 0 });
      return result;
    }).catch(err => {
      logger.error('RACE', 'Failed to fetch public teams', err.message);
      throw err;
    });
  },

  getTeamMembersPublic: (teamId) => {
    logger.info('RACE', 'Fetching public team members', { teamId });
    return apiFetch(`/api/team/${teamId}/members/`, {
      noAuth: true,
      noRedirectOnAuthFailure: true,
    }).then(result => {
      logger.success('RACE', 'Public team members fetched', { teamId, count: result?.length || 0 });
      return result;
    }).catch(err => {
      logger.error('RACE', 'Failed to fetch public team members', err.message);
      throw err;
    });
  },

  createRegistrationCheckoutSession: (slug, payload) => {
    logger.info('RACE', 'Creating registration checkout session', { slug, mode: payload?.mode });
    return apiFetch(`/api/race/registration/${encodeURIComponent(slug)}/checkout/`, {
      method: 'POST',
      body: payload,
      noAuth: true,
      noRedirectOnAuthFailure: true,
    }).then(result => {
      logger.success('RACE', 'Registration checkout session created', { slug });
      return result;
    }).catch(err => {
      logger.error('RACE', 'Failed to create registration checkout session', err.message);
      throw err;
    });
  },

  getRegistrationPaymentStatus: (slug, teamId) => {
    logger.info('RACE', 'Fetching registration payment status', { slug, teamId });
    return apiFetch(`/api/race/registration/${encodeURIComponent(slug)}/payment-status/?team_id=${encodeURIComponent(teamId)}`, {
      noAuth: true,
      noRedirectOnAuthFailure: true,
    }).then(result => {
      logger.success('RACE', 'Registration payment status fetched', { slug, teamId });
      return result;
    }).catch(err => {
      logger.error('RACE', 'Failed to fetch registration payment status', err.message);
      throw err;
    });
  },

  // Fetch checkpoints status for a team in a race
  getCheckpointsStatus: (raceId, teamId, language) => {
    const url = `/api/race/${raceId}/checkpoints/${teamId}/status/${language ? `?lang=${language}` : ''}`.replace(/\/$/, '');
    logger.info('RACE', 'Fetching checkpoint status', { raceId, teamId, language });
    return apiFetch(url).then(result => {
      logger.success('RACE', 'Checkpoints fetched', { count: result?.length || 0 });
      return result;
    }).catch(err => {
      logger.error('RACE', 'Failed to fetch checkpoints', err.message);
      throw err;
    });
  },

  // Fetch tasks status for a team in a race
  getTasksStatus: (raceId, teamId, language) => {
    const url = `/api/race/${raceId}/tasks/${teamId}/status/${language ? `?lang=${language}` : ''}`.replace(/\/$/, '');
    logger.info('RACE', 'Fetching task status', { raceId, teamId, language });
    return apiFetch(url).then(result => {
      logger.success('RACE', 'Tasks fetched', { count: result?.length || 0 });
      return result;
    }).catch(err => {
      logger.error('RACE', 'Failed to fetch tasks', err.message);
      throw err;
    });
  },

  // Log a visit for a checkpoint with optional image (multipart/form-data)
  logVisitWithImage: async (raceId, formData) => {
    logger.info('RACE', 'Logging checkpoint visit with image', { raceId });
    try {
      const response = await fetchRaw(`/api/race/${raceId}/checkpoints/log/`, {
        method: 'POST',
        body: formData
        // Don't set Content-Type - browser will set it with boundary for FormData
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        logger.error('RACE', 'Failed to log visit with image', error.message);
        throw new Error(error.message || 'Failed to log visit');
      }
      logger.success('RACE', 'Checkpoint visit logged with image');
      return response.json();
    } catch (err) {
      logger.error('RACE', 'Error logging visit with image', err.message);
      throw err;
    }
  },

  // Log a visit for a checkpoint (POST) - JSON version
  logVisit: (raceId, body) => {
    logger.info('RACE', 'Logging checkpoint visit', { raceId, checkpointId: body?.checkpoint_id });
    return apiFetch(`/api/race/${raceId}/checkpoints/log/`, { method: 'POST', body }).then(result => {
      logger.success('RACE', 'Checkpoint visit logged');
      return result;
    }).catch(err => {
      logger.error('RACE', 'Failed to log visit', err.message);
      throw err;
    });
  },

  // Delete a visit for a checkpoint (DELETE)
  deleteVisit: (raceId, body) => {
    logger.info('RACE', 'Deleting checkpoint visit', { raceId, checkpointId: body?.checkpoint_id });
    return apiFetch(`/api/race/${raceId}/checkpoints/log/`, { method: 'DELETE', body }).then(result => {
      logger.success('RACE', 'Checkpoint visit deleted');
      return result;
    }).catch(err => {
      logger.error('RACE', 'Failed to delete visit', err.message);
      throw err;
    });
  },

  // Log a task completion with optional image (multipart/form-data)
  logTaskWithImage: async (raceId, formData) => {
    logger.info('RACE', 'Logging task with image', { raceId });
    try {
      const response = await fetchRaw(`/api/race/${raceId}/tasks/log/`, {
        method: 'POST',
        body: formData
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        logger.error('RACE', 'Failed to log task with image', error.message);
        throw new Error(error.message || 'Failed to log task');
      }
      logger.success('RACE', 'Task logged with image');
      return response.json();
    } catch (err) {
      logger.error('RACE', 'Error logging task with image', err.message);
      throw err;
    }
  },

  // Log a task completion (JSON)
  logTask: (raceId, body) => {
    logger.info('RACE', 'Logging task completion', { raceId, taskId: body?.task_id });
    return apiFetch(`/api/race/${raceId}/tasks/log/`, { method: 'POST', body }).then(result => {
      logger.success('RACE', 'Task logged');
      return result;
    }).catch(err => {
      logger.error('RACE', 'Failed to log task', err.message);
      throw err;
    });
  },

  // Delete a task completion
  deleteTaskCompletion: (raceId, body) => {
    logger.info('RACE', 'Deleting task completion', { raceId, taskId: body?.task_id });
    return apiFetch(`/api/race/${raceId}/tasks/log/`, { method: 'DELETE', body }).then(result => {
      logger.success('RACE', 'Task completion deleted');
      return result;
    }).catch(err => {
      logger.error('RACE', 'Failed to delete task', err.message);
      throw err;
    });
  },

  // Get race results (used by Standings)
  getResults: (raceId) => {
    logger.info('RACE', 'Fetching race results', { raceId });
    return apiFetch(`/api/race/${raceId}/results/`).then(result => {
      logger.success('RACE', 'Race results fetched');
      return result;
    }).catch(err => {
      logger.error('RACE', 'Failed to fetch results', err.message);
      throw err;
    });
  }
};
