import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { adminApi } from '../../services/adminApi';
import { logger } from '../../utils/logger';
import FilePickerButton from '../FilePickerButton';
import Toast from '../Toast';

import ConfirmDeleteFooter from './ConfirmDeleteFooter';
import { plainExcerpt } from './listText';
import TranslationManager from './TranslationManager';

// Create or edit one task. `onSave(payload)` and `onDelete()` return
// promises; the dialog stays open if they reject. When editing, Delete asks
// to confirm and `children` (the translations) show below the form.
function TaskFormModal({ task = null, onSave, onDelete, onCancel, children }) {
  const { t } = useTranslation();
  const isNew = !task;
  const [form, setForm] = useState({
    title: task?.title ?? task?.name ?? '',
    description: task?.description ?? '',
    numOfPoints: String(task?.numOfPoints ?? task?.points ?? (isNew ? '' : 0)),
  });
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        title: form.title.trim(),
        description: form.description,
        numOfPoints: form.numOfPoints ? parseInt(form.numOfPoints, 10) || 0 : 0,
      });
    } catch {
      // The caller shows the error; keep the dialog and what was typed.
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    setDeleteError(null);
    try {
      await onDelete();
    } catch (err) {
      setDeleteError(err.message);
      setConfirmingDelete(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} role="dialog" aria-modal="true" aria-labelledby="task-form-title">
      <div className={`modal-dialog modal-fullscreen-sm-down modal-dialog-scrollable${isNew ? '' : ' modal-lg'}`}>
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title" id="task-form-title">{isNew ? t('admin.tasks.newTitle') : t('admin.tasks.editTitle')}</h5>
            <button type="button" className="btn-close" aria-label={t('admin.tasks.cancel')} onClick={onCancel}></button>
          </div>
          <div className="modal-body">
            {deleteError && <div className="alert alert-danger py-2" role="alert">{deleteError}</div>}
            <form id="task-form" onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label" htmlFor="task-title">{t('admin.tasks.fieldTitle')}</label>
                <input id="task-title" type="text" className="form-control" autoFocus={isNew} value={form.title} onChange={set('title')} required />
              </div>
              <div className="mb-3">
                <label className="form-label" htmlFor="task-description">{t('admin.tasks.fieldDescription')}</label>
                <textarea id="task-description" className="form-control" rows="3" value={form.description} onChange={set('description')} />
              </div>
              <div className="mb-0">
                <label className="form-label" htmlFor="task-points">{t('admin.tasks.fieldPoints')}</label>
                <input id="task-points" type="number" min="0" step="1" className="form-control" value={form.numOfPoints} onChange={set('numOfPoints')} />
              </div>
            </form>
            {children && <div className="mt-4">{children}</div>}
          </div>
          {confirmingDelete ? (
            <ConfirmDeleteFooter
              text={t('admin.tasks.deleteConfirm', { name: task?.title ?? task?.name })}
              onConfirm={handleDelete}
              onKeep={() => setConfirmingDelete(false)}
              busy={saving}
            />
          ) : (
            <div className="modal-footer">
              {!isNew && (
                <button type="button" className="btn btn-outline-danger me-auto" onClick={() => setConfirmingDelete(true)}>
                  {t('admin.tasks.delete')}
                </button>
              )}
              <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>{t('admin.tasks.cancel')}</button>
              <button type="submit" form="task-form" className="btn btn-primary" disabled={saving}>
                {isNew ? t('admin.tasks.create') : t('admin.tasks.saveChanges')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TaskList({ tasks = [], onRemove = () => {}, raceId = null, onImported = () => {}, onUpdate = () => {}, supportedLanguages = [], defaultLanguage = null }) {
  const { t } = useTranslation();
  const [selectedFile, setSelectedFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(null);
  const [formFor, setFormFor] = useState(null); // null, 'new' or the task being edited
  const [showImport, setShowImport] = useState(false);
  const [toast, setToast] = useState(null);
  const [showHelpModal, setShowHelpModal] = useState(false);

  const handleSave = async (payload) => {
    const isNew = formFor === 'new';
    try {
      if (isNew) {
        const created = await adminApi.addTask(raceId, payload);
        onImported(Array.isArray(created) ? created : [created]);
      } else {
        const id = formFor.id ?? formFor.task_id;
        await adminApi.updateTask(id, payload);
        onUpdate(id, payload);
      }
      setFormFor(null);
      setToast({
        message: isNew ? t('admin.tasks.created', { name: payload.title }) : t('admin.tasks.updated'),
        type: 'success',
        duration: 5000
      });
    } catch (err) {
      logger.error('ADMIN', isNew ? 'Failed to create task' : 'Failed to update task', err);
      setToast({
        message: t(isNew ? 'admin.tasks.createFailed' : 'admin.tasks.updateFailed', { message: err?.message || t('admin.common.unknownError') }),
        type: 'error',
        duration: 5000
      });
      throw err;
    }
  };

  // Called from the edit dialog after the admin confirmed.
  const handleDelete = async () => {
    const id = formFor.id ?? formFor.task_id;
    try {
      await adminApi.deleteTask(id);
    } catch (err) {
      logger.error('ADMIN', 'Failed to delete task', err);
      throw new Error(t('admin.tasks.deleteFailed', { message: err?.message || t('admin.common.unknownError') }));
    }
    onRemove(id);
    setFormFor(null);
    setToast({ message: t('admin.tasks.deleted'), type: 'success', duration: 5000 });
  };

  const validateItem = (it) => {
    if (!it || typeof it !== 'object') return t('admin.tasks.validationItemNotObject');
    if (!it.name && !it.title) return t('admin.tasks.validationMissingNameOrTitle');
    return null;
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setSelectedFile(file);
    setImportError(null);
  };

  const handleImport = async (e) => {
    e.preventDefault();
    setImportError(null);

    if (!selectedFile) {
      setImportError(t('admin.tasks.validationSelectFile'));
      return;
    }

    if (!raceId) {
      setImportError(t('admin.tasks.validationMissingRace'));
      return;
    }

    // Read file content
    const fileContent = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target.result);
      reader.onerror = (error) => reject(error);
      reader.readAsText(selectedFile);
    });

    let parsed;
    try {
      parsed = JSON.parse(fileContent);
    } catch (err) {
      setImportError(t('admin.tasks.validationInvalidJson', { message: err.message }));
      return;
    }
    if (!Array.isArray(parsed)) {
      setImportError(t('admin.tasks.validationExpectedArray'));
      return;
    }
    const errors = parsed.map(validateItem).filter(Boolean);
    if (errors.length) {
      setImportError(t('admin.tasks.validationFailed', { error: errors[0] }));
      return;
    }

    setImporting(true);
    try {
      const created = [];
      let translationsCount = 0;
      for (const it of parsed) {
        const payload = {
          title: it.title ?? it.name,
          description: it.description ?? it.desc ?? null,
          numOfPoints: it.numOfPoints ?? it.points ?? 0,
        };
        const task = await adminApi.addTask(raceId, payload);
        created.push(task);

        // Import translations for this task
        const translations = it.translations || [];
        for (const trans of translations) {
          if (trans.language) {
            try {
              const translationPayload = {
                title: trans.title ?? trans.name ?? null,
                description: trans.description ?? null
              };
              await adminApi.createTaskTranslation(task.id, trans.language, translationPayload);
              translationsCount++;
            } catch (e) {
              logger.error('ADMIN', `Failed to create translation ${trans.language} for task ${task.id}`, e);
            }
          }
        }
      }
      onImported(created);
      setSelectedFile(null);
      setShowImport(false);
      // Reset file input
      const fileInput = document.getElementById('task-file-input');
      if (fileInput) fileInput.value = '';

      const msg = translationsCount > 0
        ? t('admin.tasks.importSuccessWithTranslations', { count: created.length, translations: translationsCount })
        : t('admin.tasks.importSuccess', { count: created.length });
      setToast({
        message: msg,
        type: 'success',
        duration: 5000
      });
    } catch (err) {
      logger.error('ADMIN', 'Import failed', err);
      setImportError(err?.message || t('admin.common.unknownError'));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="mb-3">
      <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
        <h5 className="mb-0 me-auto">{t('admin.tasks.title')} <span className="text-muted fw-normal">({tasks.length})</span></h5>
        <button
          type="button"
          className={`btn btn-sm ${showImport ? 'btn-secondary' : 'btn-outline-secondary'}`}
          onClick={() => setShowImport(prev => !prev)}
          aria-expanded={showImport}
        >
          {t('admin.tasks.importButton')}
        </button>
        <button type="button" className="btn btn-sm btn-primary" onClick={() => setFormFor('new')}>
          + {t('admin.tasks.new')}
        </button>
      </div>

      {showImport && (
        <div className="card card-body mb-3">
          <form onSubmit={handleImport}>
            <div className="d-flex align-items-center gap-2 mb-2">
              <h6 className="mb-0 me-auto">{t('admin.tasks.importTitle')}</h6>
              <button type="button" className="btn btn-sm btn-link p-0" onClick={() => setShowHelpModal(true)}>
                {t('admin.tasks.importHelpTitle')}
              </button>
              <button type="button" className="btn-close" aria-label={t('admin.close')} onClick={() => setShowImport(false)} />
            </div>
            <FilePickerButton
              id="task-file-input"
              accept=".json"
              onChange={handleFileChange}
              disabled={importing}
              fileName={selectedFile?.name}
              className="mb-2"
            />
            {importError && <div className="alert alert-danger">{importError}</div>}
            <button className="btn btn-primary btn-sm" type="submit" disabled={importing || !selectedFile}>
              {importing ? t('admin.tasks.importing') : t('admin.tasks.import')}
            </button>
            <div className="small text-muted mt-2">{t('admin.tasks.importHelp')}</div>
          </form>
        </div>
      )}

      {tasks.length === 0 ? (
        <div className="text-muted">{t('admin.tasks.none')}</div>
      ) : (
        <div className="list-group">
          {tasks.map(task => {
            const taskId = task.id ?? task.task_id;
            const excerpt = plainExcerpt(task.description);
            return (
              <button
                key={taskId}
                type="button"
                className="list-group-item list-group-item-action admin-item-row"
                onClick={() => setFormFor(task)}
              >
                <span className="d-flex align-items-center gap-2">
                  <strong className="text-truncate">{task.title ?? task.name}</strong>
                  <span className="badge bg-secondary flex-shrink-0">{task.numOfPoints ?? task.points ?? 0} {t('admin.common.pointsShort')}</span>
                </span>
                {excerpt && <span className="d-block small text-muted text-truncate">{excerpt}</span>}
              </button>
            );
          })}
        </div>
      )}

      {formFor !== null && (
        <TaskFormModal
          task={formFor === 'new' ? null : formFor}
          onSave={handleSave}
          onDelete={handleDelete}
          onCancel={() => setFormFor(null)}
        >
          {formFor !== 'new' && (
            <TranslationManager
              entityType="task"
              entityId={formFor.id ?? formFor.task_id}
              entityName={formFor.title ?? formFor.name}
              fields={{ title: t('admin.translationManager.fieldTitle'), description: t('admin.translationManager.fieldDescription') }}
              supportedLanguages={supportedLanguages}
              defaultLanguage={defaultLanguage}
            />
          )}
        </TaskFormModal>
      )}

      {/* Help Modal */}
      {showHelpModal && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{t('admin.tasks.importHelpTitle')}</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowHelpModal(false)}
                  aria-label="Close"
                ></button>
              </div>
              <div className="modal-body">
                <h6>{t('admin.tasks.importHelpFormat')}</h6>
                <p className="text-muted">{t('admin.tasks.importHelpDescription')}</p>

                <h6 className="mt-3">{t('admin.tasks.importHelpFields')}</h6>
                <ul>
                  <li><strong>title</strong> {t('admin.tasks.importHelpFieldTitle')}</li>
                  <li><strong>description</strong> {t('admin.tasks.importHelpFieldDesc')}</li>
                  <li><strong>numOfPoints</strong> {t('admin.tasks.importHelpFieldPoints')}</li>
                  <li><strong>translations</strong> {t('admin.tasks.importHelpFieldTranslations')}</li>
                </ul>

                <h6 className="mt-3">{t('admin.tasks.importHelpExample')}</h6>
                <pre className="bg-light p-3 rounded border" style={{ fontSize: '12px', overflow: 'auto' }}>{`[
  {
    "title": "Complete the quiz",
    "description": "Answer all questions correctly",
    "numOfPoints": 15,
    "translations": [
      {
        "language": "cs",
        "title": "Vyplnit kvíz",
        "description": "Správně odpověděte na všechny otázky"
      },
      {
        "language": "de",
        "title": "Quiz ausfuellen",
        "description": "Beantworten Sie alle Fragen korrekt"
      }
    ]
  },
  {
    "title": "Take a photo",
    "description": "Capture your team at the location",
    "numOfPoints": 10
  }
]`}</pre>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowHelpModal(false)}
                >
                  {t('admin.tasks.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
