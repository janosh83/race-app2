import React from 'react';
import { useTranslation } from 'react-i18next';

import { formatDate } from '../contexts/TimeContext';

function StatusBadge({ topOffset = 56, isShown, loggingAllowed, timeInfo, itemName = 'Content' }) {
  const { t } = useTranslation();

  return (
    <div style={{
      position: 'fixed',
      top: topOffset ? topOffset + 8 : 16,
      right: 16,
      zIndex: 1500
    }}>
      <span className={`badge ${
        !isShown
          ? 'bg-warning'
          : loggingAllowed ? 'bg-success' : 'bg-secondary'
      }`}>
        {!isShown ? (
          timeInfo.state === 'BEFORE_SHOW'
            ? t('statusBadge.comingAt', { time: formatDate(timeInfo.startShow) })
            : t('statusBadge.hidden', { itemName })
        ) : (
          loggingAllowed ? t('statusBadge.loggingOpen') : t('statusBadge.readOnly')
        )}
      </span>
    </div>
  );
}

export default StatusBadge;
