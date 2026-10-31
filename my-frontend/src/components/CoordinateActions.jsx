import React from 'react';
import { useTranslation } from 'react-i18next';

import { openNavigationTarget } from '../utils/navigation';

import './CoordinateActions.css';

// Coordinates of a checkpoint with large Navigate / Copy buttons, sized for
// tapping on the move. Without a navigation target (incomplete coordinates)
// only the coordinates are shown.
function CoordinateActions({ point, coordinatesText, label, canNavigate, onCopy, children }) {
  const { t } = useTranslation();

  return (
    <div className="coordinate-actions">
      <div className="coordinate-actions-coords text-muted small">
        <strong>{label}:</strong> {coordinatesText}
      </div>
      {canNavigate && (
        <div className="coordinate-actions-buttons">
          <button
            type="button"
            className="btn btn-outline-primary"
            onClick={() => openNavigationTarget({
              latitude: point.latitude,
              longitude: point.longitude,
              title: point.title,
            })}
          >
            <span aria-hidden="true">🧭</span> <span>{t('map.navigate')}</span>
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => onCopy({ latitude: point.latitude, longitude: point.longitude })}
          >
            <span aria-hidden="true">📋</span> <span>{t('map.copyCoordinates')}</span>
          </button>
        </div>
      )}
      {canNavigate && children}
    </div>
  );
}

export default CoordinateActions;
