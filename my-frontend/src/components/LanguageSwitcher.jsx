import React from 'react';
import { useTranslation } from 'react-i18next';

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'EN' },
  { value: 'cs', label: 'CS' },
  { value: 'de', label: 'DE' }
];

export default function LanguageSwitcher({ className = '' }) {
  const { i18n, t } = useTranslation();
  const current = (i18n.resolvedLanguage || i18n.language || 'en').split('-')[0];

  const handleChange = (event) => {
    const next = event.target.value;
    i18n.changeLanguage(next);
  };

  return (
    <div className={className}>
      <label htmlFor="language-switcher" className="visually-hidden">
        {t('nav.language')}
      </label>
      <select
        id="language-switcher"
        className="form-select form-select-sm"
        value={current}
        onChange={handleChange}
      >
        {LANGUAGE_OPTIONS.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
