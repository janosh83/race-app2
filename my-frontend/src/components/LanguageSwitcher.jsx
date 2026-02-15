import React from 'react';
import { useTranslation } from 'react-i18next';
import enFlag from '../assets/flags/en.svg';
import csFlag from '../assets/flags/cs.svg';
import deFlag from '../assets/flags/de.svg';

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'EN', flag: enFlag },
  { value: 'cs', label: 'CS', flag: csFlag },
  { value: 'de', label: 'DE', flag: deFlag }
];

export default function LanguageSwitcher({ className = '' }) {
  const { i18n, t } = useTranslation();
  const current = (i18n.resolvedLanguage || i18n.language || 'en').split('-')[0];

  const handleChange = (event) => {
    const next = event.target.value;
    i18n.changeLanguage(next);
  };

  const currentFlag = LANGUAGE_OPTIONS.find(option => option.value === current)?.flag || enFlag;

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
        style={{
          backgroundImage: `url(${currentFlag})`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: '8px center',
          backgroundSize: '18px 12px',
          paddingLeft: '32px'
        }}
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
