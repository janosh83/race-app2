import React from 'react';
import { LANGUAGE_LABELS, LANGUAGE_FLAGS } from '../config/languages';

/**
 * LanguageFlagsDisplay - Shows language flags in a row
 * @param {Array} languages - Array of language codes to display
 * @param {Function} onClick - Optional callback when flag is clicked, receives language code
 * @param {string} selectedLanguage - Optional language code to highlight
 * @param {number} flagWidth - Width of flag in pixels (default: 24)
 * @param {number} flagHeight - Height of flag in pixels (default: 16)
 */
function LanguageFlagsDisplay({ languages, onClick, selectedLanguage, flagWidth = 24, flagHeight = 16 }) {
  if (!languages || languages.length === 0) {
    return <span className="text-muted">None</span>;
  }

  return (
    <div className="d-flex gap-2">
      {languages.map(lang => (
        <div
          key={lang}
          title={LANGUAGE_LABELS[lang] || lang}
          onClick={() => onClick && onClick(lang)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            cursor: onClick ? 'pointer' : 'default',
            padding: '2px',
            border: selectedLanguage === lang ? '2px solid #0d6efd' : '2px solid transparent',
            borderRadius: '4px',
            transition: 'border-color 0.2s'
          }}
        >
          <img
            src={LANGUAGE_FLAGS[lang]}
            alt={lang}
            style={{ width: `${flagWidth}px`, height: `${flagHeight}px` }}
          />
        </div>
      ))}
    </div>
  );
}

export default LanguageFlagsDisplay;
