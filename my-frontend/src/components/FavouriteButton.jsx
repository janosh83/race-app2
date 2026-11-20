import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { raceApi } from '../services/raceApi';

import './FavouriteButton.css';

export function setFavouriteInList(checkpoints, checkpointId, isFavourite) {
  return checkpoints.map(cp => (cp.id === checkpointId ? { ...cp, is_favourite: isFavourite } : cp));
}

/**
 * Star toggle for the team's favourite checkpoints (shared by all members). Updates the list
 * optimistically through setCheckpoints and rolls back if the request fails.
 */
export default function FavouriteButton({ raceId, checkpoint, setCheckpoints, onError, size = 'md' }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const isFavourite = Boolean(checkpoint.is_favourite);
  const label = isFavourite ? t('favourites.remove') : t('favourites.add');

  const handleClick = async (event) => {
    // The button sits inside clickable cards; don't open the checkpoint.
    event.stopPropagation();
    if (busy) return;
    const next = !isFavourite;
    setBusy(true);
    setCheckpoints(prev => setFavouriteInList(prev, checkpoint.id, next));
    try {
      await raceApi.setCheckpointFavourite(raceId, checkpoint.id, next);
    } catch (err) {
      setCheckpoints(prev => setFavouriteInList(prev, checkpoint.id, !next));
      onError?.(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      className={`favourite-button favourite-button-${size} ${isFavourite ? 'is-favourite' : ''}`}
      onClick={handleClick}
      disabled={busy}
      aria-pressed={isFavourite}
      aria-label={label}
      title={label}
    >
      <span aria-hidden="true">{isFavourite ? '★' : '☆'}</span>
    </button>
  );
}
