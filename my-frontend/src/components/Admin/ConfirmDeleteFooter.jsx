import React from 'react';
import { useTranslation } from 'react-i18next';

// A dialog footer asking to confirm a delete, in place of the normal footer.
export default function ConfirmDeleteFooter({ text, onConfirm, onKeep, busy = false }) {
  const { t } = useTranslation();
  return (
    <div className="modal-footer justify-content-between bg-danger-subtle">
      <span className="small text-danger-emphasis">{text}</span>
      <div className="d-flex gap-2">
        <button type="button" className="btn btn-outline-secondary" onClick={onKeep} disabled={busy}>
          {t('admin.teams.keep')}
        </button>
        <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy}>
          {t('admin.teams.deleteYes')}
        </button>
      </div>
    </div>
  );
}
