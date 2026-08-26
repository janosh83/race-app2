import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';

import './FilePickerButton.css';

// Native <input type="file"> text ("Choose file"/"No file chosen") follows the
// browser/OS language and can't be translated, so we drive it from a custom button instead.
function FilePickerButton({ accept, onChange, fileName, id, className = '' }) {
  const { t } = useTranslation();
  const inputRef = useRef(null);

  return (
    <div className={`file-picker-button ${className}`}>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        onChange={onChange}
        className="file-picker-button-input"
      />
      <button
        type="button"
        className="btn btn-outline-secondary btn-sm file-picker-button-trigger"
        onClick={() => inputRef.current?.click()}
      >
        {t('map.chooseFile')}
      </button>
      <span className="file-picker-button-filename text-muted small">
        {fileName || t('map.noFileChosen')}
      </span>
    </div>
  );
}

export default FilePickerButton;
