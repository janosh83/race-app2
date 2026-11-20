import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { formatDate } from '../contexts/TimeContext';

const MINUTE = 60_000;
// Under this much time left the badge turns red.
const URGENT_MS = 15 * MINUTE;

// "2 d 3 h", "1 h 05 min", "12 min", "<1 min"
export function formatDuration(t, ms) {
  const totalMinutes = Math.floor(ms / MINUTE);
  if (totalMinutes < 1) return t('statusBadge.lessThanMinute');
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return t('statusBadge.daysHours', { days, hours });
  if (hours > 0) return t('statusBadge.hoursMinutes', { hours, minutes: String(minutes).padStart(2, '0') });
  return t('statusBadge.minutes', { minutes });
}

function StatusBadge({ topOffset = 56, isShown, loggingAllowed, timeInfo, itemName = 'Content' }) {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => Date.now());

  // Keep the countdown current; the time context itself only re-evaluates the
  // race phase, not the remaining time.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const msUntilLoggingEnds = loggingAllowed && timeInfo?.endLogging ? timeInfo.endLogging - now : null;
  const msUntilLoggingStarts = isShown && !loggingAllowed && timeInfo?.state === 'SHOW_ONLY' && timeInfo?.startLogging
    ? timeInfo.startLogging - now
    : null;

  let toneClass;
  let label;
  if (!isShown) {
    toneClass = 'bg-warning';
    label = timeInfo.state === 'BEFORE_SHOW'
      ? t('statusBadge.comingAt', { time: formatDate(timeInfo.startShow) })
      : t('statusBadge.hidden', { itemName });
  } else if (loggingAllowed) {
    toneClass = msUntilLoggingEnds !== null && msUntilLoggingEnds < URGENT_MS ? 'bg-danger' : 'bg-success';
    label = msUntilLoggingEnds !== null && msUntilLoggingEnds > 0
      ? t('statusBadge.loggingOpenLeft', { duration: formatDuration(t, msUntilLoggingEnds) })
      : t('statusBadge.loggingOpen');
  } else {
    toneClass = 'bg-secondary';
    label = msUntilLoggingStarts !== null && msUntilLoggingStarts > 0
      ? t('statusBadge.loggingOpensIn', { duration: formatDuration(t, msUntilLoggingStarts) })
      : t('statusBadge.readOnly');
  }

  return (
    <div style={{
      position: 'fixed',
      top: topOffset ? topOffset + 8 : 16,
      right: 16,
      zIndex: 1500
    }}>
      <span className={`badge ${toneClass}`}>{label}</span>
    </div>
  );
}

export default StatusBadge;
