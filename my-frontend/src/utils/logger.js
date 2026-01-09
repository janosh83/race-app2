/**
 * Logger utility for consistent logging across the frontend
 * Provides structured logging with categories and log levels
 * 
 * Debug mode controlled by REACT_APP_DEBUG_MODE env variable (true/false)
 * Can be set on Render even in production to enable/disable debug output
 */

const isDev = process.env.REACT_APP_DEBUG_MODE === 'true';

// Color codes for console output
const colors = {
  info: 'color: #0066cc; font-weight: bold;',
  error: 'color: #cc0000; font-weight: bold;',
  warn: 'color: #ff8800; font-weight: bold;',
  success: 'color: #009900; font-weight: bold;',
};

/**
 * Logger with category-based logging
 * Categories: API, AUTH, TOKEN, CONTEXT, NAV, COMPONENT, RACE, GEOLOCATION, STORAGE
 */
export const logger = {
  info: (category, message, data) => {
    if (isDev) {
      console.log(
        `%c[${category}]%c ${message}`,
        colors.info,
        'color: inherit;',
        data !== undefined ? data : ''
      );
    }
  },

  error: (category, message, error) => {
    console.error(
      `%c[${category}]%c ERROR: ${message}`,
      colors.error,
      'color: inherit;',
      error || ''
    );
  },

  warn: (category, message, data) => {
    console.warn(
      `%c[${category}]%c WARNING: ${message}`,
      colors.warn,
      'color: inherit;',
      data !== undefined ? data : ''
    );
  },

  success: (category, message, data) => {
    if (isDev) {
      console.log(
        `%c[${category}]%c ✓ ${message}`,
        colors.success,
        'color: inherit;',
        data !== undefined ? data : ''
      );
    }
  },

  /**
   * Log an API request
   * @param {string} method - HTTP method
   * @param {string} endpoint - API endpoint
   * @param {object} body - Request body (optional)
   */
  apiRequest: (method, endpoint, body) => {
    if (isDev) {
      const summary = body ? { ...body, password: '***' } : undefined;
      logger.info('API', `${method} ${endpoint}`, summary);
    }
  },

  /**
   * Log an API response
   * @param {string} method - HTTP method
   * @param {string} endpoint - API endpoint
   * @param {number} status - Response status code
   * @param {object} data - Response data (optional)
   */
  apiResponse: (method, endpoint, status, data) => {
    if (isDev) {
      const summary = status >= 200 && status < 300 ? '✓' : '✗';
      logger.info('API', `${summary} ${method} ${endpoint} (${status})`, data);
    }
  },

  /**
   * Log an API error
   * @param {string} method - HTTP method
   * @param {string} endpoint - API endpoint
   * @param {number} status - Response status code
   * @param {string|object} error - Error message or object
   */
  apiError: (method, endpoint, status, error) => {
    const message = typeof error === 'string' ? error : JSON.stringify(error);
    logger.error('API', `${method} ${endpoint} (${status})`, message);
  },

  /**
   * Log token operations
   */
  tokenRefresh: (success, message) => {
    if (success) {
      logger.success('TOKEN', message || 'Token refreshed');
    } else {
      logger.error('TOKEN', message || 'Token refresh failed');
    }
  },

  tokenExpiry: (timeUntilExpiry) => {
    logger.warn('TOKEN', `Token expiring in ${timeUntilExpiry}s`);
  },
};

export default logger;
