import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { SUPPORTED_LANGUAGES, LANGUAGE_LABELS } from '../../config/languages';
import { adminApi } from '../../services/adminApi';
import { logger } from '../../utils/logger';
import Toast from '../Toast';

import TranslationManager from './TranslationManager';

export default function RaceForm({ race = null, onSaved = null, onCreated = null, onCancel = null }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startShow, setStartShow] = useState('');
  const [endShow, setEndShow] = useState('');
  const [startLogging, setStartLogging] = useState('');
  const [endLogging, setEndLogging] = useState('');
  const [registrationSlug, setRegistrationSlug] = useState('');
  const [registrationEnabled, setRegistrationEnabled] = useState(false);
  const [minTeamSize, setMinTeamSize] = useState(1);
  const [maxTeamSize, setMaxTeamSize] = useState(2);
  const [allowTeamRegistration, setAllowTeamRegistration] = useState(true);
  const [allowIndividualRegistration, setAllowIndividualRegistration] = useState(false);
  const [registrationCurrency, setRegistrationCurrency] = useState('eur');
  const [registrationTeamAmountCents, setRegistrationTeamAmountCents] = useState(5000);
  const [registrationDriverAmountCents, setRegistrationDriverAmountCents] = useState(2500);
  const [registrationCodriverAmountCents, setRegistrationCodriverAmountCents] = useState(1500);
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
      setRegistrationSlug(race.registration_slug || '');
      setRegistrationEnabled(Boolean(race.registration_enabled || false));
      setMinTeamSize(Number(race.min_team_size ?? 1));
      setMaxTeamSize(Number(race.max_team_size ?? 2));
      setAllowTeamRegistration(Boolean(race.allow_team_registration ?? true));
      setAllowIndividualRegistration(Boolean(race.allow_individual_registration ?? false));
      setRegistrationCurrency((race.registration_currency || 'eur').toLowerCase());
      setRegistrationTeamAmountCents(Number(race.registration_team_amount_cents ?? 5000));
      setRegistrationDriverAmountCents(Number(race.registration_driver_amount_cents ?? 2500));
      setRegistrationCodriverAmountCents(Number(race.registration_codriver_amount_cents ?? 1500));
    } else {
      setName('');
      setDescription('');
      setDefaultLanguage('');
      setSupportedLanguages([]);
      setStartShow('');
      setEndShow('');
      setStartLogging('');
      setEndLogging('');
      setRegistrationSlug('');
      setRegistrationEnabled(false);
      setMinTeamSize(1);
      setMaxTeamSize(2);
      setAllowTeamRegistration(true);
      setAllowIndividualRegistration(false);
      setRegistrationCurrency('eur');
      setRegistrationTeamAmountCents(5000);
      setRegistrationDriverAmountCents(2500);
      setRegistrationCodriverAmountCents(1500);
    }
  }, [race]);

  const toIso = (dtLocal) => dtLocal ? new Date(dtLocal).toISOString() : null;

  // --- Validation logic ---
  const [validationError, setValidationError] = useState('');
  useEffect(() => {
    setValidationError('');
    if (startShow && endShow && startShow > endShow) {
      setValidationError(t('admin.raceForm.validationStartShowBeforeEndShow'));
      return;
    }
    if (startLogging && endLogging && startLogging > endLogging) {
      setValidationError(t('admin.raceForm.validationStartLogBeforeEndLog'));
      return;
    }
    if (startLogging && startShow && startLogging < startShow) {
      setValidationError(t('admin.raceForm.validationStartLogNotBeforeShow'));
      return;
    }
    if (endLogging && endShow && endLogging > endShow) {
      setValidationError(t('admin.raceForm.validationEndLogNotAfterShow'));
      return;
    }
    if (Number(minTeamSize) < 1 || Number(maxTeamSize) < 1) {
      setValidationError('Team size must be at least 1.');
      return;
    }
    if (Number(minTeamSize) > Number(maxTeamSize)) {
      setValidationError('Min team size must be less than or equal to max team size.');
      return;
    }
    if (allowTeamRegistration === allowIndividualRegistration) {
      setValidationError(t('admin.raceForm.validationRegistrationModeRequired'));
      return;
    }
    if (registrationEnabled && !registrationSlug.trim()) {
      setValidationError(t('admin.raceForm.validationRegistrationSlugRequired'));
      return;
    }

    const normalizedCurrency = registrationCurrency.trim().toLowerCase();
    if (!/^[a-z]{3}$/.test(normalizedCurrency)) {
      setValidationError(t('admin.raceForm.validationRegistrationCurrency'));
      return;
    }

    const teamAmount = Number(registrationTeamAmountCents);
    if (!Number.isInteger(teamAmount) || teamAmount < 1) {
      setValidationError(t('admin.raceForm.validationRegistrationTeamAmount'));
      return;
    }

    const driverAmount = Number(registrationDriverAmountCents);
    if (!Number.isInteger(driverAmount) || driverAmount < 1) {
      setValidationError(t('admin.raceForm.validationRegistrationDriverAmount'));
      return;
    }

    const codriverAmount = Number(registrationCodriverAmountCents);
    if (!Number.isInteger(codriverAmount) || codriverAmount < 1) {
      setValidationError(t('admin.raceForm.validationRegistrationCodriverAmount'));
    }
  }, [
    startShow,
    endShow,
    startLogging,
    endLogging,
    registrationSlug,
    registrationEnabled,
    minTeamSize,
    maxTeamSize,
    allowTeamRegistration,
    allowIndividualRegistration,
    registrationCurrency,
    registrationTeamAmountCents,
    registrationDriverAmountCents,
    registrationCodriverAmountCents,
    t,
  ]);

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
        registration_slug: registrationSlug.trim() || null,
        registration_enabled: registrationEnabled,
        min_team_size: Number(minTeamSize),
        max_team_size: Number(maxTeamSize),
        allow_team_registration: allowTeamRegistration,
        allow_individual_registration: allowIndividualRegistration,
        registration_currency: registrationCurrency.trim().toLowerCase(),
        registration_team_amount_cents: Number(registrationTeamAmountCents),
        registration_driver_amount_cents: Number(registrationDriverAmountCents),
        registration_codriver_amount_cents: Number(registrationCodriverAmountCents),
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
        message: isEdit ? t('admin.raceForm.toastUpdated') : t('admin.raceForm.toastCreated'),
        type: 'success',
        duration: 5000
      });
    } catch (err) {
      logger.error('ADMIN', 'Failed to save race', err);
      setToast({
        message: t('admin.raceForm.toastSaveFailed', { message: err?.message || t('admin.common.unknownError') }),
        type: 'error',
        duration: 5000
      });
    } finally {
      setSaving(false);
    }
  };

  const registrationFormUrl = registrationSlug.trim()
    ? `${window.location.origin}/register/${encodeURIComponent(registrationSlug.trim())}`
    : '';

  return (
    <>
      <form onSubmit={handleSubmit} className="mb-3 card p-3">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h4 className="mb-0">{isEdit ? t('admin.raceForm.editTitle') : t('admin.raceForm.createTitle')}</h4>
        <div>
          {onCancel && <button type="button" className="btn btn-sm btn-outline-secondary me-2" onClick={onCancel}>{t('admin.raceForm.cancel')}</button>}
          <button className="btn btn-primary btn-sm" type="submit" disabled={saving || !!validationError}>{saving ? t('admin.raceForm.saving') : (isEdit ? t('admin.raceForm.save') : t('admin.raceForm.create'))}</button>
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
          placeholder={t('admin.raceForm.namePlaceholder')}
          required
        />
      </div>

      <div className="mb-2">
        <textarea
          className="form-control"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder={t('admin.raceForm.descriptionPlaceholder')}
          rows={2}
        />
      </div>

      <div className="mb-3">
        <label className="form-label small mb-2">{t('admin.raceForm.supportedLanguages')}</label>
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
          <label htmlFor="defaultLanguage" className="form-label small">{t('admin.raceForm.defaultLanguage')}</label>
          <select
            id="defaultLanguage"
            className="form-select form-select-sm"
            value={defaultLanguage}
            onChange={e => setDefaultLanguage(e.target.value)}
          >
            <option value="">{t('admin.raceForm.selectDefaultLanguage')}</option>
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
          <label className="form-label small">{t('admin.raceForm.startShowing')}</label>
          <input className="form-control" type="datetime-local" value={startShow} onChange={e => setStartShow(e.target.value)} />
        </div>
        <div className="col">
          <label className="form-label small">{t('admin.raceForm.endShowing')}</label>
          <input className="form-control" type="datetime-local" value={endShow} onChange={e => setEndShow(e.target.value)} />
        </div>
      </div>

      <div className="row g-2 mb-3">
        <div className="col">
          <label className="form-label small">{t('admin.raceForm.startLogging')}</label>
          <input className="form-control" type="datetime-local" value={startLogging} onChange={e => setStartLogging(e.target.value)} />
        </div>
        <div className="col">
          <label className="form-label small">{t('admin.raceForm.endLogging')}</label>
          <input className="form-control" type="datetime-local" value={endLogging} onChange={e => setEndLogging(e.target.value)} />
        </div>
      </div>

      <div className="row g-2 mb-3">
        <div className="col-md-8">
          <label className="form-label small">Registration slug</label>
          <input
            className="form-control"
            type="text"
            value={registrationSlug}
            onChange={e => setRegistrationSlug(e.target.value)}
            placeholder="e.g. summer-rally-2026"
          />
          <div className="d-flex justify-content-between align-items-center mt-1">
            <div className="form-text mb-0">Lowercase kebab-case. Used in public URL.</div>
            {registrationFormUrl && (
              <a
                href={registrationFormUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-sm btn-outline-primary"
              >
                {t('admin.raceForm.openRegistrationForm')}
              </a>
            )}
          </div>
        </div>
        <div className="col-md-4 d-flex align-items-end">
          <div className="form-check mb-2">
            <input
              id="registration-enabled"
              className="form-check-input"
              type="checkbox"
              checked={registrationEnabled}
              onChange={e => setRegistrationEnabled(e.target.checked)}
            />
            <label className="form-check-label" htmlFor="registration-enabled">
              Registration enabled
            </label>
          </div>
        </div>
      </div>

      <div className="mb-3">
        <label className="form-label small d-block">Registration mode</label>
        <div className="form-check">
          <input
            id="allow-team-registration"
            className="form-check-input"
            type="radio"
            name="registration-mode"
            checked={allowTeamRegistration}
            onChange={() => {
              setAllowTeamRegistration(true);
              setAllowIndividualRegistration(false);
            }}
          />
          <label className="form-check-label" htmlFor="allow-team-registration">
            Allow team registration
          </label>
        </div>
        <div className="form-check">
          <input
            id="allow-individual-registration"
            className="form-check-input"
            type="radio"
            name="registration-mode"
            checked={allowIndividualRegistration}
            onChange={() => {
              setAllowTeamRegistration(false);
              setAllowIndividualRegistration(true);
            }}
          />
          <label className="form-check-label" htmlFor="allow-individual-registration">
            Allow individual registration
          </label>
        </div>
      </div>

      <div className={`row g-2 mb-3 ${allowIndividualRegistration ? 'opacity-50' : ''}`}>
        <div className="col">
          <label className="form-label small">Min team size</label>
          <input
            className="form-control"
            type="number"
            min="1"
            value={minTeamSize}
            onChange={e => setMinTeamSize(e.target.value)}
            disabled={allowIndividualRegistration}
          />
        </div>
        <div className="col">
          <label className="form-label small">Max team size</label>
          <input
            className="form-control"
            type="number"
            min="1"
            value={maxTeamSize}
            onChange={e => setMaxTeamSize(e.target.value)}
            disabled={allowIndividualRegistration}
          />
        </div>
      </div>

      <div className="row g-2 mb-3">
        <div className="col-md-6">
          <label className="form-label small">{t('admin.raceForm.registrationCurrency')}</label>
          <input
            className="form-control"
            type="text"
            maxLength={3}
            value={registrationCurrency}
            onChange={e => setRegistrationCurrency(e.target.value)}
            placeholder="eur"
          />
        </div>
        <div className="col-md-6">
          <label className="form-label small">{t('admin.raceForm.registrationTeamAmountCents')}</label>
          <input
            className="form-control"
            type="number"
            min="1"
            value={registrationTeamAmountCents}
            onChange={e => setRegistrationTeamAmountCents(e.target.value)}
            disabled={allowIndividualRegistration}
          />
        </div>
      </div>

      <div className={`row g-2 mb-3 ${allowTeamRegistration ? 'opacity-50' : ''}`}>
        <div className="col-md-6">
          <label className="form-label small">{t('admin.raceForm.registrationDriverAmountCents')}</label>
          <input
            className="form-control"
            type="number"
            min="1"
            value={registrationDriverAmountCents}
            onChange={e => setRegistrationDriverAmountCents(e.target.value)}
            disabled={allowTeamRegistration}
          />
        </div>
        <div className="col-md-6">
          <label className="form-label small">{t('admin.raceForm.registrationCodriverAmountCents')}</label>
          <input
            className="form-control"
            type="number"
            min="1"
            value={registrationCodriverAmountCents}
            onChange={e => setRegistrationCodriverAmountCents(e.target.value)}
            disabled={allowTeamRegistration}
          />
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
          fields={{ name: t('admin.raceForm.translationFieldName'), description: t('admin.raceForm.translationFieldDescription') }}
          supportedLanguages={supportedLanguages}
        />
      </div>
    )}
    </>
  );
}