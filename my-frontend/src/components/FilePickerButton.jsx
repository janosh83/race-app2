import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import './FilePickerButton.css';

// Phones and tablets: offer the camera directly, with the gallery as a
// fallback (a photo taken earlier, or a camera the browser can't open).
const hasTouchScreen = () => (
  typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(pointer: coarse)').matches
);

// Native <input type="file"> text ("Choose file"/"No file chosen") follows the
// browser/OS language and can't be translated, so we drive it from a custom button instead.
function FilePickerButton({ accept, onChange, fileName, id, disabled = false, className = '' }) {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const cameraInputRef = useRef(null);
  // The camera only makes sense for photos, not for e.g. a JSON import.
  const [touch] = useState(() => String(accept || '').startsWith('image') && hasTouchScreen());

  return (
    <div className={`file-picker-button ${touch ? 'file-picker-button-touch' : ''} ${className}`}>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        onChange={onChange}
        disabled={disabled}
        className="file-picker-button-input"
      />
      {touch && (
        <input
          ref={cameraInputRef}
          type="file"
          accept={accept}
          capture="environment"
          onChange={onChange}
          disabled={disabled}
          className="file-picker-button-input"
          data-testid="file-picker-camera-input"
        />
      )}
      {touch ? (
        <>
          <button
            type="button"
            className="btn btn-outline-primary btn-lg file-picker-button-camera"
            onClick={() => cameraInputRef.current?.click()}
            disabled={disabled}
          >
            <span aria-hidden="true">📷</span> {t('map.takePhoto')}
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary file-picker-button-trigger"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
          >
            {t('map.chooseFromGallery')}
          </button>
        </>
      ) : (
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm file-picker-button-trigger"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
        >
          {t('map.chooseFile')}
        </button>
      )}
      <span className="file-picker-button-filename text-muted small">
        {fileName || t('map.noFileChosen')}
      </span>
    </div>
  );
}

export default FilePickerButton;
