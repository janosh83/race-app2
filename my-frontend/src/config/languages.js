import csFlag from '../assets/flags/cs.svg';
import deFlag from '../assets/flags/de.svg';
import enFlag from '../assets/flags/en.svg';

export const SUPPORTED_LANGUAGES = ['en', 'cs', 'de'];

export const LANGUAGE_LABELS = {
  en: 'English',
  cs: 'Čeština',
  de: 'Deutsch'
};

export const LANGUAGE_FLAGS = {
  en: enFlag,
  cs: csFlag,
  de: deFlag
};

export const getLanguageLabel = (langCode) => LANGUAGE_LABELS[langCode] || langCode;
export const getLanguageFlag = (langCode) => LANGUAGE_FLAGS[langCode];
