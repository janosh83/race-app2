import { apiFetch } from '../utils/api';
import { logger } from '../utils/logger';

export const userApi = {
  // Update user's preferred language
  updatePreferredLanguage: (userId, language) => {
    logger.info('USER', 'Updating preferred language', { userId, language });
    return apiFetch(`/api/user/${userId}/`, {
      method: 'PATCH',
      body: { preferred_language: language }
    }).then(result => {
      logger.success('USER', 'Preferred language updated', { language });
      return result;
    }).catch(err => {
      logger.error('USER', 'Failed to update preferred language', err.message);
      throw err;
    });
  }
};
