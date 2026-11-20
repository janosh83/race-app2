import React from 'react';
import { useTranslation } from 'react-i18next';

import { LANGUAGE_FLAGS, LANGUAGE_LABELS, SUPPORTED_LANGUAGES } from '../config/languages';
import { useTime } from '../contexts/TimeContext';
import { userApi } from '../services/userApi';
import { logger } from '../utils/logger';

import './LanguageSwitcher.css';

// Three languages fit side by side, so every language is one tap away
// (no dropdown). variant="dark" is for the black top bars.
export default function LanguageSwitcher({ className = '', variant = 'light' }) {
  const { i18n, t } = useTranslation();
  const { setSelectedLanguage } = useTime();
  const current = (i18n.resolvedLanguage || i18n.language || 'en').split('-')[0];

  const handleChange = async (next) => {
    if (next === current) return;

    // Update frontend UI language
    i18n.changeLanguage(next);

    // Update API language parameter
    setSelectedLanguage(next);
    logger.info('LANG', 'Language changed', { language: next });

    // Try to persist to backend if user is logged in
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user?.id) {
          await userApi.updatePreferredLanguage(user.id, next);
          logger.success('SETTINGS', 'Language preference saved', { language: next });
        }
      }
    } catch (error) {
      // If not logged in or API fails, just log it and continue
      // Frontend change already applied, so user experience is not affected
      logger.warn('SETTINGS', 'Failed to save language preference', error.message);
    }
  };

  return (
    <div
      role="group"
      aria-label={t('nav.language')}
      className={`language-switcher language-switcher-${variant} ${className}`}
    >
      {SUPPORTED_LANGUAGES.map((lang) => {
        const active = lang === current;
        return (
          <button
            key={lang}
            type="button"
            lang={lang}
            className={`language-switcher-option ${active ? 'is-active' : ''}`}
            aria-pressed={active}
            aria-label={LANGUAGE_LABELS[lang]}
            title={LANGUAGE_LABELS[lang]}
            onClick={() => handleChange(lang)}
          >
            <img src={LANGUAGE_FLAGS[lang]} alt="" className="language-switcher-flag" />
            <span className="language-switcher-code" aria-hidden="true">{lang.toUpperCase()}</span>
          </button>
        );
      })}
    </div>
  );
}
