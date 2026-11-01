import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { SUPPORTED_LANGUAGES, LANGUAGE_LABELS } from '../../config/languages';
import { adminApi } from '../../services/adminApi';
import { formatCoordinates, parseCoordinates } from '../../utils/coordinates';
import { logger } from '../../utils/logger';
import { amountToCents, centsToAmount } from '../../utils/money';
import Toast from '../Toast';

import CheckpointMap from './CheckpointMap';
import TranslationManager from './TranslationManager';

// Create or edit a race, in sections: basics, schedule, finish and bivaks
// (coordinates typed, pasted or picked on a map), languages and registration.
// Save and Cancel stay at the bottom of the screen. `checkpoints` (optional)
// show on the map when picking a place.
export default function RaceForm({ race = null, checkpoints = [], onSaved = null, onCreated = null, onCancel = null }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [raceGreeting, setRaceGreeting] = useState('');
  const [finishDescription, setFinishDescription] = useState('');
  const [finishCoords, setFinishCoords] = useState('');
  const [bivak1Name, setBivak1Name] = useState('');
  const [bivak1Coords, setBivak1Coords] = useState('');
  const [bivak2Name, setBivak2Name] = useState('');
  const [bivak2Coords, setBivak2Coords] = useState('');
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
  const [registrationTeamAmountCents, setRegistrationTeamAmountCents] = useState(50);
  const [registrationDriverAmountCents, setRegistrationDriverAmountCents] = useState(25);
  const [registrationCodriverAmountCents, setRegistrationCodriverAmountCents] = useState(15);
  const [defaultLanguage, setDefaultLanguage] = useState('');
  const [supportedLanguages, setSupportedLanguages] = useState([]);
  const [pickingPlace, setPickingPlace] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const isEdit = Boolean(race && race.id);

  useEffect(() => {
    if (race) {
      setName(race.name || '');
      setDescription(race.description || '');
      setRaceGreeting(race.race_greeting || '');
      setFinishDescription(race.finish_description || '');
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
      const coordsText = (lat, lng) => (
        lat === null || lat === undefined || lng === null || lng === undefined ? '' : formatCoordinates(Number(lat), Number(lng))
      );

      setStartShow(toLocal(race.start_showing_checkpoints_at ?? race.start_showing_checkpoints ?? race.start_showing));
      setEndShow(toLocal(race.end_showing_checkpoints_at ?? race.end_showing_checkpoints ?? race.end_showing));
      setStartLogging(toLocal(race.start_logging_at ?? race.start_logging));
      setEndLogging(toLocal(race.end_logging_at ?? race.end_logging));
      setFinishCoords(coordsText(race.finish_latitude, race.finish_longitude));
      setBivak1Name(race.bivak_1_name || '');
      setBivak1Coords(coordsText(race.bivak_1_latitude, race.bivak_1_longitude));
      setBivak2Name(race.bivak_2_name || '');
      setBivak2Coords(coordsText(race.bivak_2_latitude, race.bivak_2_longitude));
      setRegistrationSlug(race.registration_slug || '');
      setRegistrationEnabled(Boolean(race.registration_enabled || false));
      setMinTeamSize(Number(race.min_team_size ?? 1));
      setMaxTeamSize(Number(race.max_team_size ?? 2));
      setAllowTeamRegistration(Boolean(race.allow_team_registration ?? true));
      setAllowIndividualRegistration(Boolean(race.allow_individual_registration ?? false));
      setRegistrationCurrency((race.registration_currency || 'eur').toLowerCase());
      setRegistrationTeamAmountCents(centsToAmount(race.registration_team_amount_cents ?? 5000));
      setRegistrationDriverAmountCents(centsToAmount(race.registration_driver_amount_cents ?? 2500));
      setRegistrationCodriverAmountCents(centsToAmount(race.registration_codriver_amount_cents ?? 1500));
    } else {
      setName('');
      setDescription('');
      setRaceGreeting('');
      setFinishDescription('');
      setFinishCoords('');
      setBivak1Name('');
      setBivak1Coords('');
      setBivak2Name('');
      setBivak2Coords('');
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
      setRegistrationTeamAmountCents(50);
      setRegistrationDriverAmountCents(25);
      setRegistrationCodriverAmountCents(15);
    }
  }, [race]);

  const toIso = (dtLocal) => dtLocal ? new Date(dtLocal).toISOString() : null;
  const position = (text) => parseCoordinates(text) || { latitude: null, longitude: null };

  // Prices of the mode not in use are hidden; an unusable one keeps its saved value.
  const centsOr = (amount, fallback) => {
    const cents = amountToCents(amount);
    return Number.isInteger(cents) && cents >= 1 ? cents : fallback;
  };

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
    const badPlace = [
      [finishCoords, t('admin.raceForm.finishTitle')],
      [bivak1Coords, t('admin.raceForm.bivak1Title')],
      [bivak2Coords, t('admin.raceForm.bivak2Title')],
    ].find(([text]) => text.trim() && !parseCoordinates(text));
    if (badPlace) {
      setValidationError(t('admin.raceForm.validationPlaceCoordinates', { place: badPlace[1] }));
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
    if (!/^[a-z]{3}$/.test(registrationCurrency.trim().toLowerCase())) {
      setValidationError(t('admin.raceForm.validationRegistrationCurrency'));
      return;
    }

    // Prices are typed in the main unit (500 = 500 Kč) and stored in cents.
    const validAmount = (amount) => {
      const cents = amountToCents(amount);
      return Number.isInteger(cents) && cents >= 1;
    };
    if (allowTeamRegistration) {
      if (Number(minTeamSize) < 1 || Number(maxTeamSize) < 1) {
        setValidationError(t('admin.raceForm.validationTeamSizeMin'));
      } else if (Number(minTeamSize) > Number(maxTeamSize)) {
        setValidationError(t('admin.raceForm.validationTeamSizeOrder'));
      } else if (!validAmount(registrationTeamAmountCents)) {
        setValidationError(t('admin.raceForm.validationRegistrationTeamAmount'));
      }
      return;
    }
    if (!validAmount(registrationDriverAmountCents)) {
      setValidationError(t('admin.raceForm.validationRegistrationDriverAmount'));
    } else if (!validAmount(registrationCodriverAmountCents)) {
      setValidationError(t('admin.raceForm.validationRegistrationCodriverAmount'));
    }
  }, [
    finishCoords,
    bivak1Coords,
    bivak2Coords,
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
        race_greeting: raceGreeting.trim() || null,
        finish_description: finishDescription.trim() || null,
        default_language: defaultLanguage || null,
        supported_languages: supportedLanguages.length > 0 ? supportedLanguages : null,
        finish_latitude: position(finishCoords).latitude,
        finish_longitude: position(finishCoords).longitude,
        bivak_1_name: bivak1Name.trim() || null,
        bivak_1_latitude: position(bivak1Coords).latitude,
        bivak_1_longitude: position(bivak1Coords).longitude,
        bivak_2_name: bivak2Name.trim() || null,
        bivak_2_latitude: position(bivak2Coords).latitude,
        bivak_2_longitude: position(bivak2Coords).longitude,
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
        registration_team_amount_cents: centsOr(registrationTeamAmountCents, race?.registration_team_amount_cents ?? 5000),
        registration_driver_amount_cents: centsOr(registrationDriverAmountCents, race?.registration_driver_amount_cents ?? 2500),
        registration_codriver_amount_cents: centsOr(registrationCodriverAmountCents, race?.registration_codriver_amount_cents ?? 1500),
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

  const currencyCode = (registrationCurrency || '').toUpperCase();
  const placeRows = [
    { key: 'finish', title: t('admin.raceForm.finishTitle'), name: finishDescription, setName: setFinishDescription, coords: finishCoords, setCoords: setFinishCoords },
    { key: 'bivak1', title: t('admin.raceForm.bivak1Title'), name: bivak1Name, setName: setBivak1Name, coords: bivak1Coords, setCoords: setBivak1Coords },
    { key: 'bivak2', title: t('admin.raceForm.bivak2Title'), name: bivak2Name, setName: setBivak2Name, coords: bivak2Coords, setCoords: setBivak2Coords },
  ];
  // While picking one place, the other places show as their pins.
  const otherPlaces = placeRows
    .filter(row => row.key !== pickingPlace)
    .map(row => ({ row, position: parseCoordinates(row.coords) }))
    .filter(({ position }) => position)
    .map(({ row, position }) => ({
      id: row.key,
      kind: row.key === 'finish' ? 'finish' : 'bivak',
      number: row.key === 'finish' ? undefined : Number(row.key.slice(-1)),
      title: row.name ? `${row.title}: ${row.name}` : row.title,
      ...position,
    }));
  const mapCheckpoints = checkpoints
    .map(cp => ({
      id: cp.id ?? cp.checkpoint_id,
      title: cp.title ?? cp.name,
      latitude: Number(cp.latitude ?? cp.lat),
      longitude: Number(cp.longitude ?? cp.lng),
    }))
    .filter(cp => Number.isFinite(cp.latitude) && Number.isFinite(cp.longitude));

  return (
    <>
      <form onSubmit={handleSubmit} className="admin-race-form">
      <h3 className="h5 mb-3">{isEdit ? t('admin.raceForm.editTitle') : t('admin.raceForm.createTitle')}</h3>

      <section className="card mb-3">
        <div className="card-body">
          <h4 className="h6 card-title mb-3">{t('admin.raceForm.sectionBasics')}</h4>
          <div className="mb-3">
            <label className="form-label" htmlFor="race-name">{t('admin.raceForm.fieldName')}</label>
            <input
              id="race-name"
              className="form-control"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="race-greeting">{t('admin.raceForm.fieldRaceGreeting')}</label>
            <textarea
              id="race-greeting"
              className="form-control"
              value={raceGreeting}
              onChange={e => setRaceGreeting(e.target.value)}
              rows={2}
              aria-describedby="race-greeting-help"
            />
            <div id="race-greeting-help" className="form-text">{t('admin.raceForm.raceGreetingHelp')}</div>
          </div>
          <div>
            <label className="form-label" htmlFor="race-description">{t('admin.raceForm.fieldDescription')}</label>
            <textarea
              id="race-description"
              className="form-control"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>
      </section>

      <section className="card mb-3">
        <div className="card-body">
          <h4 className="h6 card-title mb-1">{t('admin.raceForm.sectionSchedule')}</h4>
          <p className="form-text mt-0 mb-3">{t('admin.raceForm.scheduleHelp')}</p>
          <fieldset className="mb-3">
            <legend className="form-label fs-6 mb-1">{t('admin.raceForm.showingWindow')}</legend>
            <div className="row g-2">
              <div className="col-sm-6">
                <label className="form-label small text-muted mb-1" htmlFor="race-start-showing">{t('admin.raceForm.from')}</label>
                <input id="race-start-showing" className="form-control" type="datetime-local" value={startShow} onChange={e => setStartShow(e.target.value)} />
              </div>
              <div className="col-sm-6">
                <label className="form-label small text-muted mb-1" htmlFor="race-end-showing">{t('admin.raceForm.to')}</label>
                <input id="race-end-showing" className="form-control" type="datetime-local" value={endShow} onChange={e => setEndShow(e.target.value)} />
              </div>
            </div>
          </fieldset>
          <fieldset>
            <legend className="form-label fs-6 mb-1">{t('admin.raceForm.loggingWindow')}</legend>
            <div className="row g-2">
              <div className="col-sm-6">
                <label className="form-label small text-muted mb-1" htmlFor="race-start-logging">{t('admin.raceForm.from')}</label>
                <input id="race-start-logging" className="form-control" type="datetime-local" value={startLogging} onChange={e => setStartLogging(e.target.value)} />
              </div>
              <div className="col-sm-6">
                <label className="form-label small text-muted mb-1" htmlFor="race-end-logging">{t('admin.raceForm.to')}</label>
                <input id="race-end-logging" className="form-control" type="datetime-local" value={endLogging} onChange={e => setEndLogging(e.target.value)} />
              </div>
            </div>
          </fieldset>
        </div>
      </section>

      <section className="card mb-3">
        <div className="card-body">
          <h4 className="h6 card-title mb-1">{t('admin.raceForm.sectionPlaces')}</h4>
          <p className="form-text mt-0 mb-3">{t('admin.raceForm.raceMarkersHelp')} {t('admin.checkpoints.coordinatesHelp')}</p>
          {placeRows.map(row => {
            const invalid = row.coords.trim() !== '' && !parseCoordinates(row.coords);
            const picking = pickingPlace === row.key;
            return (
              <fieldset key={row.key} className="admin-race-place">
                <legend className="form-label fs-6 mb-1 d-flex align-items-center gap-2">
                  <img
                    className="admin-overview-place-icon me-0"
                    src={row.key === 'finish' ? '/map-finish-marker.svg' : '/map-bivak-marker.svg'}
                    alt=""
                  />
                  {row.title}
                </legend>
                <div className="row g-2">
                  <div className="col-md-5">
                    <label className="form-label small text-muted mb-1" htmlFor={`race-${row.key}-name`}>{t('admin.raceForm.placeName')}</label>
                    <input
                      id={`race-${row.key}-name`}
                      className="form-control"
                      type="text"
                      value={row.name}
                      onChange={e => row.setName(e.target.value)}
                    />
                  </div>
                  <div className="col-md-7">
                    <label className="form-label small text-muted mb-1" htmlFor={`race-${row.key}-coords`}>{t('admin.raceForm.placeCoordinates')}</label>
                    <div className="input-group has-validation">
                      <input
                        id={`race-${row.key}-coords`}
                        className={`form-control${invalid ? ' is-invalid' : ''}`}
                        type="text"
                        placeholder="50.0755, 14.4378"
                        value={row.coords}
                        onChange={e => row.setCoords(e.target.value)}
                      />
                      <button
                        type="button"
                        className={`btn ${picking ? 'btn-secondary' : 'btn-outline-secondary'}`}
                        onClick={() => setPickingPlace(picking ? null : row.key)}
                        aria-expanded={picking}
                      >
                        {picking ? t('admin.raceForm.hideMap') : t('admin.raceForm.pickOnMap')}
                      </button>
                      {invalid && <div className="invalid-feedback">{t('admin.checkpoints.coordinatesInvalid')}</div>}
                    </div>
                  </div>
                </div>
                {picking && (
                  <div className="mt-2">
                    <CheckpointMap
                      checkpoints={mapCheckpoints}
                      markers={otherPlaces}
                      picked={parseCoordinates(row.coords)}
                      onPick={(picked) => row.setCoords(formatCoordinates(picked.latitude, picked.longitude))}
                      className="admin-checkpoint-map-picker"
                    />
                    <div className="form-text">{t('admin.raceForm.mapPickHelp', { place: row.title })}</div>
                  </div>
                )}
              </fieldset>
            );
          })}
        </div>
      </section>

      <section className="card mb-3">
        <div className="card-body">
          <h4 className="h6 card-title mb-1">{t('admin.raceForm.sectionLanguages')}</h4>
          <p className="form-text mt-0 mb-3">{t('admin.raceForm.languagesHelp')}</p>
          <div className="row g-3 align-items-start">
            <fieldset className="col-md-6">
              <legend className="form-label fs-6 mb-1">{t('admin.raceForm.supportedLanguages')}</legend>
              <div className="d-flex flex-wrap column-gap-3">
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
                    <label className="form-check-label" htmlFor={`lang-${lang}`}>
                      {LANGUAGE_LABELS[lang]}
                    </label>
                  </div>
                ))}
              </div>
            </fieldset>
            {supportedLanguages.length > 0 && (
              <div className="col-md-6">
                <label htmlFor="defaultLanguage" className="form-label">{t('admin.raceForm.defaultLanguage')}</label>
                <select
                  id="defaultLanguage"
                  className="form-select"
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
          </div>
        </div>
      </section>

      <section className="card mb-3">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
            <h4 className="h6 card-title mb-0">{t('admin.raceForm.sectionRegistration')}</h4>
            <div className="form-check form-switch mb-0">
              <input
                id="registration-enabled"
                className="form-check-input"
                type="checkbox"
                role="switch"
                checked={registrationEnabled}
                onChange={e => setRegistrationEnabled(e.target.checked)}
              />
              <label className="form-check-label" htmlFor="registration-enabled">
                {t('admin.raceForm.registrationEnabled')}
              </label>
            </div>
          </div>

          <div className="mb-3">
            <label className="form-label" htmlFor="registration-slug">{t('admin.raceForm.registrationSlug')}</label>
            <div className="input-group">
              <span className="input-group-text d-none d-sm-flex">/register/</span>
              <input
                id="registration-slug"
                className="form-control"
                type="text"
                value={registrationSlug}
                onChange={e => setRegistrationSlug(e.target.value)}
                placeholder="summer-rally-2026"
                aria-describedby="registration-slug-help"
              />
            </div>
            <div className="d-flex justify-content-between align-items-start flex-wrap column-gap-3 mt-1">
              <div id="registration-slug-help" className="form-text mt-0">{t('admin.raceForm.registrationSlugHelp')}</div>
              {registrationFormUrl && (
                <a href={registrationFormUrl} target="_blank" rel="noopener noreferrer" className="small">
                  {t('admin.raceForm.openRegistrationForm')} ↗
                </a>
              )}
            </div>
          </div>

          <fieldset className="mb-3">
            <legend className="form-label fs-6 mb-1">{t('admin.raceForm.registrationMode')}</legend>
            <div className="form-check form-check-inline">
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
                {t('admin.raceForm.modeTeam')}
              </label>
            </div>
            <div className="form-check form-check-inline">
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
                {t('admin.raceForm.modeIndividual')}
              </label>
            </div>
            <div className="form-text">
              {allowIndividualRegistration ? t('admin.raceForm.modeIndividualHelp') : t('admin.raceForm.modeTeamHelp')}
            </div>
          </fieldset>

          <div className="row g-2">
            <div className="col-6 col-md-3">
              <label className="form-label" htmlFor="registration-currency">{t('admin.raceForm.registrationCurrency')}</label>
              <input
                id="registration-currency"
                className="form-control text-uppercase"
                type="text"
                maxLength={3}
                value={registrationCurrency}
                onChange={e => setRegistrationCurrency(e.target.value)}
                placeholder="eur"
              />
            </div>
            {allowTeamRegistration ? (
              <>
                <div className="col-6 col-md-3">
                  <label className="form-label" htmlFor="registration-team-amount">{t('admin.raceForm.registrationTeamAmountCents')} ({currencyCode})</label>
                  <input
                    id="registration-team-amount"
                    className="form-control"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={registrationTeamAmountCents}
                    onChange={e => setRegistrationTeamAmountCents(e.target.value)}
                  />
                </div>
                <div className="col-6 col-md-3">
                  <label className="form-label" htmlFor="registration-min-team">{t('admin.raceForm.minTeamSize')}</label>
                  <input
                    id="registration-min-team"
                    className="form-control"
                    type="number"
                    min="1"
                    value={minTeamSize}
                    onChange={e => setMinTeamSize(e.target.value)}
                  />
                </div>
                <div className="col-6 col-md-3">
                  <label className="form-label" htmlFor="registration-max-team">{t('admin.raceForm.maxTeamSize')}</label>
                  <input
                    id="registration-max-team"
                    className="form-control"
                    type="number"
                    min="1"
                    value={maxTeamSize}
                    onChange={e => setMaxTeamSize(e.target.value)}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="col-6 col-md-3">
                  <label className="form-label" htmlFor="registration-driver-amount">{t('admin.raceForm.registrationDriverAmountCents')} ({currencyCode})</label>
                  <input
                    id="registration-driver-amount"
                    className="form-control"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={registrationDriverAmountCents}
                    onChange={e => setRegistrationDriverAmountCents(e.target.value)}
                  />
                </div>
                <div className="col-6 col-md-3">
                  <label className="form-label" htmlFor="registration-codriver-amount">{t('admin.raceForm.registrationCodriverAmountCents')} ({currencyCode})</label>
                  <input
                    id="registration-codriver-amount"
                    className="form-control"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={registrationCodriverAmountCents}
                    onChange={e => setRegistrationCodriverAmountCents(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Always in reach at the bottom of the screen, with what blocks saving. */}
      <div className="admin-form-actions">
        <div className="admin-form-actions-message small" role="status">
          {validationError && <span className="text-danger">{validationError}</span>}
        </div>
        <div className="d-flex gap-2 flex-shrink-0">
          {onCancel && <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>{t('admin.raceForm.cancel')}</button>}
          <button className="btn btn-primary" type="submit" disabled={saving || !!validationError}>
            {saving ? t('admin.raceForm.saving') : (isEdit ? t('admin.raceForm.save') : t('admin.raceForm.create'))}
          </button>
        </div>
      </div>

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
          fields={{
            name: t('admin.raceForm.translationFieldName'),
            description: t('admin.raceForm.translationFieldDescription'),
            race_greeting: t('admin.raceForm.translationFieldRaceGreeting'),
            // Place names only for places the race has; empty = the original name.
            ...(race.finish_description ? { finish_description: t('admin.raceForm.translationFieldFinish') } : {}),
            ...(race.bivak_1_name ? { bivak_1_name: t('admin.raceForm.translationFieldBivak', { index: 1 }) } : {}),
            ...(race.bivak_2_name ? { bivak_2_name: t('admin.raceForm.translationFieldBivak', { index: 2 }) } : {}),
          }}
          placeholders={{
            name: race.name,
            race_greeting: race.race_greeting,
            finish_description: race.finish_description,
            bivak_1_name: race.bivak_1_name,
            bivak_2_name: race.bivak_2_name,
          }}
          supportedLanguages={supportedLanguages}
        />
      </div>
    )}
    </>
  );
}