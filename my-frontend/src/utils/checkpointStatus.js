import { formatDate } from '../contexts/TimeContext';

// Why a checkpoint can't be logged right now: logging hasn't opened yet
// (SHOW_ONLY) or has already ended (POST_LOG_SHOW).
export function getCheckpointReadOnlyMessage(t, checkpoint, timeInfo) {
  if (checkpoint?.visited) return t('map.visitLoggedReadOnly');
  if (timeInfo?.state === 'POST_LOG_SHOW') {
    return t('map.loggingEndedAt', { time: formatDate(timeInfo.endLogging) });
  }
  return t('map.loggingOpensAt', { time: formatDate(timeInfo?.startLogging) });
}