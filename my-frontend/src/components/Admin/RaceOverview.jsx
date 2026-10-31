import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LANGUAGE_LABELS } from '../../config/languages';
import { formatMoney } from '../../utils/money';
import LanguageFlagsDisplay from '../LanguageFlagsDisplay';

function formatIso(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

function formatCoordinates(latitude, longitude) {
  if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) return '—';
  return `${latitude}, ${longitude}`;
}

// The "Overview" section of a race in admin: greeting, description, time
// windows, languages, map markers and registration settings. Clicking a
// translation flag previews the texts in that language.
function RaceOverview({ race: selected, translations }) {
  const { t, i18n } = useTranslation();
  const [viewingTranslationLang, setViewingTranslationLang] = useState(null);

  return (
    <>
      {/* Description and time constraints */}
      <div className="card mb-3">
        <div className="card-body">
          {(() => {
            const translated = translations.find(t => t.language === viewingTranslationLang);
            const greeting = viewingTranslationLang
              ? (translated?.race_greeting ?? selected.race_greeting)
              : selected.race_greeting;
            return (
              <>
                {greeting ? (
                  <p className="mb-2 fst-italic">{greeting}</p>
                ) : (
                  <p className="mb-2 text-muted">{t('admin.dashboard.noRaceGreeting')}</p>
                )}
              </>
            );
          })()}

          {(() => {
            const desc = viewingTranslationLang
              ? (translations.find(t => t.language === viewingTranslationLang)?.description || selected.description)
              : selected.description;
            return desc ? (
              <p className="mb-2">{desc}</p>
            ) : (
              <p className="mb-2 text-muted">{t('admin.dashboard.noDescription')}</p>
            );
          })()}

          <div className="small text-muted">
            <div>
              <strong>{t('admin.dashboard.showingCheckpoints')}:</strong>{' '}
              {formatIso(selected.start_showing_checkpoints_at ?? selected.start_showing_checkpoints ?? selected.start_showing)}
              {' — '}
              {formatIso(selected.end_showing_checkpoints_at ?? selected.end_showing_checkpoints ?? selected.end_showing)}
            </div>
            <div>
              <strong>{t('admin.dashboard.loggingWindow')}:</strong>{' '}
              {formatIso(selected.start_logging_at ?? selected.start_logging)}
              {' — '}
              {formatIso(selected.end_logging_at ?? selected.end_logging)}
            </div>
            <div className="mt-2 pt-2 border-top">
              <div>
                <strong>{t('admin.dashboard.defaultLanguage')}:</strong>{' '}
                {selected.default_language ? `${LANGUAGE_LABELS[selected.default_language] || selected.default_language} (${selected.default_language})` : t('admin.dashboard.notSet')}
              </div>
              <div>
                <strong>{t('admin.dashboard.supportedLanguages')}:</strong>{' '}
                {selected.supported_languages && selected.supported_languages.length > 0
                  ? selected.supported_languages.map(lang => `${LANGUAGE_LABELS[lang] || lang} (${lang})`).join(', ')
                  : t('admin.dashboard.none')}
              </div>
              <div className="mt-2 pt-2 border-top">
                <div>
                  <strong>{t('admin.dashboard.raceMarkers')}:</strong>
                </div>
                <div>
                  <strong>{t('admin.dashboard.finishMarker')}:</strong>{' '}
                  {selected.finish_description ? `${selected.finish_description} — ` : ''}
                  {formatCoordinates(selected.finish_latitude, selected.finish_longitude)}
                </div>
                <div>
                  <strong>{t('admin.dashboard.bivak1Marker')}:</strong>{' '}
                  {selected.bivak_1_name ? `${selected.bivak_1_name} — ` : ''}
                  {formatCoordinates(selected.bivak_1_latitude, selected.bivak_1_longitude)}
                </div>
                <div>
                  <strong>{t('admin.dashboard.bivak2Marker')}:</strong>{' '}
                  {selected.bivak_2_name ? `${selected.bivak_2_name} — ` : ''}
                  {formatCoordinates(selected.bivak_2_latitude, selected.bivak_2_longitude)}
                </div>
              </div>
              <div className="mt-2 pt-2 border-top">
                <div>
                  <strong>{t('admin.dashboard.registrationSettings')}:</strong>
                </div>
                <div>
                  <strong>{t('admin.dashboard.registrationEnabled')}:</strong>{' '}
                  {selected.registration_enabled ? t('admin.dashboard.yes') : t('admin.dashboard.no')}
                </div>
                <div>
                  <strong>{t('admin.dashboard.registrationSlug')}:</strong>{' '}
                  {selected.registration_slug ? (
                    <a
                      href={`${window.location.origin}/register/${encodeURIComponent(selected.registration_slug)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {selected.registration_slug}
                    </a>
                  ) : t('admin.dashboard.notSet')}
                </div>
                <div>
                  <strong>{t('admin.dashboard.teamSizeRange')}:</strong>{' '}
                  {selected.min_team_size ?? 1} — {selected.max_team_size ?? 2}
                </div>
                <div>
                  <strong>{t('admin.dashboard.registrationModes')}:</strong>{' '}
                  {[
                    selected.allow_team_registration ? t('admin.dashboard.modeTeam') : null,
                    selected.allow_individual_registration ? t('admin.dashboard.modeIndividual') : null,
                  ].filter(Boolean).join(', ') || t('admin.dashboard.none')}
                </div>
                <div>
                  <strong>{t('admin.dashboard.registrationCurrency')}:</strong>{' '}
                  {(selected.registration_currency || 'eur').toUpperCase()}
                </div>
                <div>
                  <strong>{t('admin.dashboard.registrationPricingStrategy')}:</strong>{' '}
                  {selected.registration_pricing_strategy === 'driver_codriver'
                    ? t('admin.dashboard.registrationPricingStrategyDriverCodriver')
                    : t('admin.dashboard.registrationPricingStrategyTeamFlat')}
                </div>
                <div>
                  <strong>{t('admin.dashboard.registrationTeamAmountCents')}:</strong>{' '}
                  {formatMoney(selected.registration_team_amount_cents ?? 5000, selected.registration_currency || 'eur', i18n.language)}
                </div>
                <div>
                  <strong>{t('admin.dashboard.registrationIndividualAmountCents')}:</strong>{' '}
                  {formatMoney(selected.registration_individual_amount_cents ?? 2500, selected.registration_currency || 'eur', i18n.language)}
                </div>
                <div>
                  <strong>{t('admin.dashboard.registrationDriverAmountCents')}:</strong>{' '}
                  {formatMoney(selected.registration_driver_amount_cents ?? 2500, selected.registration_currency || 'eur', i18n.language)}
                </div>
                <div>
                  <strong>{t('admin.dashboard.registrationCodriverAmountCents')}:</strong>{' '}
                  {formatMoney(selected.registration_codriver_amount_cents ?? 1500, selected.registration_currency || 'eur', i18n.language)}
                </div>
              </div>
              <div className="mt-2">
                <div className="d-flex align-items-center gap-2">
                  <strong>{t('admin.dashboard.existingTranslations')}:</strong>
                  {translations && translations.length > 0 ? (
                    <LanguageFlagsDisplay
                      languages={translations.map(t => t.language)}
                      selectedLanguage={viewingTranslationLang}
                      onClick={(lang) => setViewingTranslationLang(viewingTranslationLang === lang ? null : lang)}
                    />
                  ) : (
                    <span className="text-muted">{t('admin.dashboard.noneYet')}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default RaceOverview;
