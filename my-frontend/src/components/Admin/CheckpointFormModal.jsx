import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { formatCoordinates, parseCoordinates } from '../../utils/coordinates';

import CheckpointMap from './CheckpointMap';

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

// Create or edit one checkpoint. The position comes from the map (click or
// drag the pin) or from the coordinates field, which takes text pasted from
// Mapy.com or Google Maps. The race's other checkpoints show as grey dots.
// `onSave(payload)` returns a promise; the dialog stays open if it rejects.
export default function CheckpointFormModal({ checkpoint = null, checkpoints = [], onSave, onCancel }) {
  const { t } = useTranslation();
  const isNew = !checkpoint;
  const initialLat = toNumber(checkpoint?.latitude ?? checkpoint?.lat);
  const initialLng = toNumber(checkpoint?.longitude ?? checkpoint?.lng);

  const [title, setTitle] = useState(checkpoint?.title ?? checkpoint?.name ?? '');
  const [description, setDescription] = useState(checkpoint?.description ?? '');
  const [points, setPoints] = useState(String(checkpoint?.numOfPoints ?? (isNew ? '' : 0)));
  const [position, setPosition] = useState(
    initialLat !== null && initialLng !== null ? { latitude: initialLat, longitude: initialLng } : null,
  );
  const [coordinatesText, setCoordinatesText] = useState(formatCoordinates(initialLat, initialLng));
  const [coordinatesError, setCoordinatesError] = useState(false);
  const [saving, setSaving] = useState(false);

  const pick = (next) => {
    setPosition(next);
    setCoordinatesText(formatCoordinates(next.latitude, next.longitude));
    setCoordinatesError(false);
  };

  const handleCoordinatesChange = (text) => {
    setCoordinatesText(text);
    if (!text.trim()) {
      setPosition(null);
      setCoordinatesError(false);
      return;
    }
    const parsed = parseCoordinates(text);
    setCoordinatesError(!parsed);
    if (parsed) setPosition(parsed);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (coordinatesError) return;
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        description,
        latitude: position?.latitude ?? null,
        longitude: position?.longitude ?? null,
        numOfPoints: points === '' ? 0 : parseInt(points, 10) || 0,
      });
    } catch {
      // The caller shows the error; keep the dialog and what was typed.
    } finally {
      setSaving(false);
    }
  };

  const editedId = checkpoint ? (checkpoint.id ?? checkpoint.checkpoint_id) : null;

  return (
    <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} role="dialog" aria-modal="true" aria-labelledby="checkpoint-form-title">
      <div className="modal-dialog modal-xl modal-fullscreen-md-down">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title" id="checkpoint-form-title">
              {isNew ? t('admin.checkpoints.newTitle') : t('admin.checkpoints.editTitle')}
            </h5>
            <button type="button" className="btn-close" aria-label={t('admin.checkpoints.cancel')} onClick={onCancel} />
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="row g-3">
                <div className="col-lg-5">
                  <div className="mb-3">
                    <label className="form-label" htmlFor="checkpoint-title">{t('admin.checkpoints.fieldTitle')}</label>
                    <input
                      id="checkpoint-title"
                      type="text"
                      className="form-control"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                      autoFocus={isNew}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label" htmlFor="checkpoint-coordinates">{t('admin.checkpoints.fieldCoordinates')}</label>
                    <input
                      id="checkpoint-coordinates"
                      type="text"
                      inputMode="decimal"
                      className={`form-control${coordinatesError ? ' is-invalid' : ''}`}
                      value={coordinatesText}
                      placeholder="50.0755, 14.4378"
                      onChange={(e) => handleCoordinatesChange(e.target.value)}
                      aria-describedby="checkpoint-coordinates-help"
                    />
                    <div id="checkpoint-coordinates-help" className={coordinatesError ? 'invalid-feedback d-block' : 'form-text'}>
                      {coordinatesError ? t('admin.checkpoints.coordinatesInvalid') : t('admin.checkpoints.coordinatesHelp')}
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label" htmlFor="checkpoint-points">{t('admin.checkpoints.fieldPoints')}</label>
                    <input
                      id="checkpoint-points"
                      type="number"
                      min="0"
                      step="1"
                      className="form-control"
                      value={points}
                      onChange={(e) => setPoints(e.target.value)}
                    />
                  </div>
                  <div className="mb-0">
                    <label className="form-label" htmlFor="checkpoint-description">{t('admin.checkpoints.fieldDescription')}</label>
                    <textarea
                      id="checkpoint-description"
                      className="form-control"
                      rows="5"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                </div>
                <div className="col-lg-7">
                  <CheckpointMap
                    checkpoints={checkpoints}
                    excludeId={editedId}
                    picked={position}
                    onPick={pick}
                    className="admin-checkpoint-map-picker"
                  />
                  <div className="form-text">{t('admin.checkpoints.mapHelp')}</div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>{t('admin.checkpoints.cancel')}</button>
              <button type="submit" className="btn btn-primary" disabled={saving || coordinatesError}>
                {isNew ? t('admin.checkpoints.create') : t('admin.checkpoints.saveChanges')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
