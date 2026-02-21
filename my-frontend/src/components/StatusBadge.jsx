import React from 'react';

import { formatDate } from '../contexts/TimeContext';

function StatusBadge({ topOffset = 56, isShown, loggingAllowed, timeInfo, itemName = 'Content' }) {
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
            ? `Coming ${formatDate(timeInfo.startShow)}`
            : `${itemName} hidden`
        ) : (
          loggingAllowed ? 'Logging open' : 'Read-only'
        )}
      </span>
    </div>
  );
}

export default StatusBadge;
