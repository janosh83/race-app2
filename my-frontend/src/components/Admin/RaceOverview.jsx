import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LANGUAGE_LABELS } from '../../config/languages';
import { formatCoordinates } from '../../utils/coordinates';
import { formatDateRange } from '../../utils/dateRange';
import { formatMoney } from '../../utils/money';
import LanguageFlagsDisplay from '../LanguageFlagsDisplay';

import CheckpointMap from './CheckpointMap';

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const languageName = (code) => `${LANGUAGE_LABELS[code] || code} (${code})`;

// Finish and bivaks, with a label for the map and the list.
function racePlaces(race, t) {
  return [
    { id: 'finish', label: t('admin.dashboard.finishMarker'), name: race.finish_description, lat: race.finish_latitude, lng: race.finish_longitude },
    { id: 'bivak1', label: t('admin.dashboard.bivak1Marker'), name: race.bivak_1_name, lat: race.bivak_1_latitude, lng: race.bivak_1_longitude },
    { id: 'bivak2', label: t('admin.dashboard.bivak2Marker'), name: race.bivak_2_name, lat: race.bivak_2_latitude, lng: race.bivak_2_longitude },
  ]
    .map(place => ({ ...place, latitude: toNumber(place.lat), longitude: toNumber(place.lng) }))
    .filter(place => place.latitude !== null && place.longitude !== null)
    .map(place => ({ ...place, title: place.name ? `${place.label}: ${place.name}` : place.label }));
}

function Field({ label, children }) {
  return (
    <div className="admin-overview-field">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

// The "Overview" section of a race in admin, as cards: texts and languages,
// schedule, registration and prices, and a map of the checkpoints with the
// finish and bivaks. Clicking a translation flag previews the texts in that
// language.
function RaceOverview({ race, translations = [], checkpoints = [], tasks = [] }) {
  const { t, i18n } = useTranslation();
  const [previewLang, setPreviewLang] = useState(null);
  const [copied, setCopied] = useState(false);

  const translated = previewLang ? translations.find(tr => tr.language === previewLang) : null;
  const greeting = translated?.race_greeting ?? race.race_greeting;
  const description = translated?.description || race.description;

  const currency = race.registration_currency || 'eur';
  const money = (cents) => formatMoney(cents, currency, i18n.language);
  const individual = Boolean(race.allow_individual_registration);
  const registrationUrl = race.registration_slug
    ? `${window.location.origin}/register/${encodeURIComponent(race.registration_slug)}`
    : null;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(registrationUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard not available (e.g. plain http): the link is still there to copy by hand.
    }
  };

  const places = racePlaces(race, t);
  const mapCheckpoints = checkpoints.map(cp => ({
    id: cp.id ?? cp.checkpoint_id,
    title: cp.title ?? cp.name,
    numOfPoints: cp.numOfPoints,
    latitude: toNumber(cp.latitude ?? cp.lat),
    longitude: toNumber(cp.longitude ?? cp.lng),
  }));
  const otherLanguages = (race.supported_languages || []).filter(lang => lang !== race.default_language);

  return (
    <div className="admin-overview">
      <section className="card mb-3">
        <div className="card-body">
          {greeting ? (
            <p className="fs-5 fst-italic mb-2">{greeting}</p>
          ) : (
            <p className="text-muted mb-2">{t('admin.dashboard.noRaceGreeting')}</p>
          )}
          {description ? (
            <p className="mb-0 admin-overview-description">{description}</p>
          ) : (
            <p className="text-muted mb-0">{t('admin.dashboard.noDescription')}</p>
          )}
        </div>
        <div className="card-footer small d-flex flex-wrap align-items-center column-gap-4 row-gap-1">
          <span>
            <span className="text-muted">{t('admin.dashboard.defaultLanguage')}:</span>{' '}
            {race.default_language ? languageName(race.default_language) : t('admin.dashboard.notSet')}
          </span>
          {otherLanguages.length > 0 && (
            <span>
              <span className="text-muted">{t('admin.dashboard.supportedLanguages')}:</span>{' '}
              {otherLanguages.map(languageName).join(', ')}
            </span>
          )}
          <span className="d-inline-flex align-items-center gap-2">
            <span className="text-muted">{t('admin.dashboard.existingTranslations')}:</span>
            {translations.length > 0 ? (
              <>
                <LanguageFlagsDisplay
                  languages={translations.map(tr => tr.language)}
                  selectedLanguage={previewLang}
                  onClick={(lang) => setPreviewLang(previewLang === lang ? null : lang)}
                />
                <span className="text-muted">
                  {previewLang
                    ? t('admin.dashboard.previewingTranslation', { language: languageName(previewLang) })
                    : t('admin.dashboard.previewHint')}
                </span>
              </>
            ) : (
              <span className="text-muted">{t('admin.dashboard.noneYet')}</span>
            )}
          </span>
        </div>
      </section>

      <div className="row g-3">
        <div className="col-lg-5 d-flex flex-column gap-3">
          <section className="card">
            <div className="card-body">
              <h3 className="h6 card-title">{t('admin.dashboard.scheduleTitle')}</h3>
              <dl className="admin-overview-fields mb-0">
                <Field label={t('admin.dashboard.showingCheckpoints')}>
                  {formatDateRange(
                    race.start_showing_checkpoints_at ?? race.start_showing_checkpoints,
                    race.end_showing_checkpoints_at ?? race.end_showing_checkpoints,
                  )}
                </Field>
                <Field label={t('admin.dashboard.loggingWindow')}>
                  {formatDateRange(race.start_logging_at ?? race.start_logging, race.end_logging_at ?? race.end_logging)}
                </Field>
              </dl>
            </div>
          </section>

          <section className="card">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
                <h3 className="h6 card-title mb-0">{t('admin.dashboard.registrationTitle')}</h3>
                <span className={`badge rounded-pill ${race.registration_enabled ? 'bg-success-subtle text-success-emphasis' : 'bg-secondary-subtle text-secondary-emphasis'}`}>
                  {race.registration_enabled ? t('admin.raceList.registrationOpen') : t('admin.raceList.registrationClosed')}
                </span>
              </div>
              <dl className="admin-overview-fields mb-0">
                <Field label={t('admin.dashboard.publicForm')}>
                  {registrationUrl ? (
                    <span className="d-inline-flex flex-wrap align-items-center gap-2">
                      <a href={registrationUrl} target="_blank" rel="noopener noreferrer" className="text-break">
                        /register/{race.registration_slug}
                      </a>
                      <button type="button" className="btn btn-sm btn-outline-secondary py-0" onClick={copyLink}>
                        {copied ? t('admin.dashboard.copied') : t('admin.dashboard.copyLink')}
                      </button>
                    </span>
                  ) : t('admin.dashboard.notSet')}
                </Field>
                <Field label={t('admin.dashboard.registrationModes')}>
                  {individual
                    ? t('admin.dashboard.modeIndividual')
                    : `${t('admin.dashboard.modeTeam')} · ${t('admin.dashboard.teamSizeValue', { min: race.min_team_size ?? 1, max: race.max_team_size ?? 2 })}`}
                </Field>
                {individual ? (
                  <>
                    <Field label={t('admin.dashboard.registrationDriverAmountCents')}>
                      {money(race.registration_driver_amount_cents ?? 2500)}
                    </Field>
                    <Field label={t('admin.dashboard.registrationCodriverAmountCents')}>
                      {money(race.registration_codriver_amount_cents ?? 1500)}
                    </Field>
                  </>
                ) : (
                  <Field label={t('admin.dashboard.registrationTeamAmountCents')}>
                    {money(race.registration_team_amount_cents ?? 5000)}
                  </Field>
                )}
              </dl>
            </div>
          </section>
        </div>

        <div className="col-lg-7">
          <section className="card h-100">
            <div className="card-body d-flex flex-column">
              <div className="d-flex justify-content-between align-items-baseline gap-2 mb-2">
                <h3 className="h6 card-title mb-0">{t('admin.dashboard.mapTitle')}</h3>
                <span className="small text-muted">
                  {t('admin.dashboard.contentCounts', { checkpoints: checkpoints.length, tasks: tasks.length })}
                </span>
              </div>
              <CheckpointMap checkpoints={mapCheckpoints} markers={places} className="admin-overview-map" />
              {places.length > 0 ? (
                <ul className="list-unstyled small mb-0 mt-2 admin-overview-places">
                  {places.map(place => (
                    <li key={place.id}>
                      <span className="admin-overview-place-icon" aria-hidden="true" />
                      <strong>{place.label}</strong>
                      {place.name ? `: ${place.name}` : ''}
                      <span className="text-muted"> · {formatCoordinates(place.latitude, place.longitude)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="small text-muted mb-0 mt-2">{t('admin.dashboard.noRaceMarkers')}</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default RaceOverview;
