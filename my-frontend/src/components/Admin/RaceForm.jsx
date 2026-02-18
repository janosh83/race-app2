import React, { useState, useEffect } from 'react';
import { adminApi } from '../../services/adminApi';
import Toast from '../Toast';
import TranslationManager from './TranslationManager';
import { SUPPORTED_LANGUAGES, LANGUAGE_LABELS } from '../../config/languages';
import { logger } from '../../utils/logger';

export default function RaceForm({ race = null, onSaved = null, onCreated = null, onCancel = null }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startShow, setStartShow] = useState('');
  const [endShow, setEndShow] = useState('');
  const [startLogging, setStartLogging] = useState('');
  const [endLogging, setEndLogging] = useState('');
  const [defaultLanguage, setDefaultLanguage] = useState('');
  const [supportedLanguages, setSupportedLanguages] = useState([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const isEdit = Boolean(race && race.id);

  useEffect(() => {
    if (race) {
      setName(race.name || '');
      setDescription(race.description || '');
      setDefaultLanguage(race.default_language || '');
      setSupportedLanguages(Array.isArray(race.supported_languages) ? race.supported_languages : []);
      // try to parse ISO -> local datetime-local value
      const toLocal = (iso) => {
        if (!iso) return '';
        const d = new Date(iso);
        const pad = (n) => String(n).padStart(2, '0');
        const yyyy = d.getFullYear();
        const mm = pad(d.getMonth() + 1);
        const dd = pad(d.getDate());
        const hh = pad(d.getHours());
        const min = pad(d.getMinutes());
        return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
      };
      setStartShow(toLocal(race.start_showing_checkpoints_at ?? race.start_showing_checkpoints ?? race.start_showing));
      setEndShow(toLocal(race.end_showing_checkpoints_at ?? race.end_showing_checkpoints ?? race.end_showing));
      setStartLogging(toLocal(race.start_logging_at ?? race.start_logging));
      setEndLogging(toLocal(race.end_logging_at ?? race.end_logging));
    } else {
      setName('');
      setDescription('');
      setDefaultLanguage('');
      setSupportedLanguages([]);
      setStartShow('');
      setEndShow('');
      setStartLogging('');
      setEndLogging('');
    }
  }, [race]);

  const toIso = (dtLocal) => dtLocal ? new Date(dtLocal).toISOString() : null;

  // --- Validation logic ---
  const [validationError, setValidationError] = useState('');
  useEffect(() => {
    setValidationError('');
    if (startShow && endShow && startShow > endShow) {
      setValidationError('Start showing must be before end showing.');
      return;
    }
    if (startLogging && endLogging && startLogging > endLogging) {
      setValidationError('Start logging must be before end logging.');
      return;
    }
    if (startLogging && startShow && startLogging < startShow) {
      setValidationError('Start logging cannot be before start showing.');
      return;
    }
    if (endLogging && endShow && endLogging > endShow) {
      setValidationError('End logging cannot be after end showing.');
      return;
    }
  }, [startShow, endShow, startLogging, endLogging]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (validationError) return;
    setSaving(true);
    try {
      const payload = {
        name,
        description,
        default_language: defaultLanguage || null,
        supported_languages: supportedLanguages.length > 0 ? supportedLanguages : null,
        start_showing_checkpoints_at: toIso(startShow),
        end_showing_checkpoints_at: toIso(endShow),
        start_logging_at: toIso(startLogging),
        end_logging_at: toIso(endLogging),
      };
      let saved;
      if (isEdit) {
        saved = await adminApi.updateRace(race.id, payload);
      } else {
        saved = await adminApi.createRace(payload);
      }
      if (onSaved) onSaved(saved);
      if (!isEdit && onCreated) onCreated(saved);
      setToast({
        message: isEdit ? 'Race updated successfully' : 'Race created successfully',
        type: 'success',
        duration: 5000
      });
    } catch (err) {
      logger.error('ADMIN', 'Failed to save race', err);
      setToast({
        message: 'Failed to save race: ' + (err?.message || 'Unknown error'),
        type: 'error',
        duration: 5000
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="mb-3 card p-3">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h4 className="mb-0">{isEdit ? 'Edit race' : 'Create race'}</h4>
        <div>
          {onCancel && <button type="button" className="btn btn-sm btn-outline-secondary me-2" onClick={onCancel}>Cancel</button>}
          <button className="btn btn-primary btn-sm" type="submit" disabled={saving || !!validationError}>{saving ? 'Saving…' : (isEdit ? 'Save' : 'Create')}</button>
        </div>
      </div>

      {validationError && (
        <div className="alert alert-danger py-2 mb-2">
          {validationError}
        </div>
      )}

      <div className="mb-2">
        <input
          className="form-control"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Race name"
          required
        />
      </div>

      <div className="mb-2">
        <textarea
          className="form-control"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Description"
          rows={2}
        />
      </div>

      <div className="mb-3">
        <label className="form-label small mb-2">Supported Languages</label>
        <div className="d-flex gap-3">
          {SUPPORTED_LANGUAGES.map(lang => (
            <div key={lang} className="form-check">
              <input
                className="form-check-input"
                type="checkbox"
                id={`lang-${lang}`}
                checked={supportedLanguages.includes(lang)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSupportedLanguages(prev => [...prev, lang]);
                  } else {
                    setSupportedLanguages(prev => prev.filter(l => l !== lang));
                    if (defaultLanguage === lang) setDefaultLanguage('');
                  }
                }}
              />
              <label className="form-check-label small" htmlFor={`lang-${lang}`}>
                {LANGUAGE_LABELS[lang]}
              </label>
            </div>
          ))}
        </div>
      </div>

      {supportedLanguages.length > 0 && (
        <div className="mb-3">
          <label htmlFor="defaultLanguage" className="form-label small">Default Language</label>
          <select
            id="defaultLanguage"
            className="form-select form-select-sm"
            value={defaultLanguage}
            onChange={e => setDefaultLanguage(e.target.value)}
          >
            <option value="">— Select default language —</option>
            {supportedLanguages.map(lang => (
              <option key={lang} value={lang}>
                {LANGUAGE_LABELS[lang]} ({lang})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="row g-2 mb-2">
        <div className="col">
          <label className="form-label small">Start showing</label>
          <input className="form-control" type="datetime-local" value={startShow} onChange={e => setStartShow(e.target.value)} />
        </div>
        <div className="col">
          <label className="form-label small">End showing</label>
          <input className="form-control" type="datetime-local" value={endShow} onChange={e => setEndShow(e.target.value)} />
        </div>
      </div>

      <div className="row g-2 mb-3">
        <div className="col">
          <label className="form-label small">Start logging</label>
          <input className="form-control" type="datetime-local" value={startLogging} onChange={e => setStartLogging(e.target.value)} />
        </div>
        <div className="col">
          <label className="form-label small">End logging</label>
          <input className="form-control" type="datetime-local" value={endLogging} onChange={e => setEndLogging(e.target.value)} />
        </div>
      </div>

      {/* Toast notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={() => setToast(null)}
        />
      )}
    </form>

    {/* Translation Manager - shown below the form when editing */}
    {isEdit && race && race.id && (
      <div className="mt-3">
        <TranslationManager
          entityType="race"
          entityId={race.id}
          entityName={race.name || race.title}
          fields={{ name: 'Name', description: 'Description' }}
          supportedLanguages={supportedLanguages}
        />
      </div>
    )}
    </>
  );
}