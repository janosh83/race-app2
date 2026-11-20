import React from 'react';

// An in-page "are you sure?" in place of a browser pop-up: the question with
// a cancel and a confirm button. `variant` colours it (danger for deletes,
// primary for sending).
export default function InlineConfirm({
  text, confirmLabel, cancelLabel, onConfirm, onCancel, busy = false, variant = 'danger', className = '',
}) {
  return (
    <div
      className={`d-flex flex-wrap align-items-center gap-2 rounded bg-${variant}-subtle p-2 ${className}`}
      role="group"
      aria-label={text}
    >
      <span className={`small text-${variant}-emphasis me-auto`}>{text}</span>
      <div className="d-flex gap-2 ms-auto">
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </button>
        <button type="button" className={`btn btn-sm btn-${variant}`} onClick={onConfirm} disabled={busy}>
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
