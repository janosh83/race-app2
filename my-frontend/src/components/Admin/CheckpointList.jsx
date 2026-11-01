import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { adminApi } from '../../services/adminApi';
import { logger } from '../../utils/logger';
import FilePickerButton from '../FilePickerButton';
import Toast from '../Toast';

import CheckpointFormModal from './CheckpointFormModal';
import CheckpointMap from './CheckpointMap';
import { plainExcerpt } from './listText';
import TranslationManager from './TranslationManager';

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

// One shape for the map, whatever field names the checkpoint came with.
const forMap = (cp) => ({
  ...cp,
  id: cp.id ?? cp.checkpoint_id,
  title: cp.title ?? cp.name,
  latitude: toNumber(cp.latitude ?? cp.lat ?? cp.y),
  longitude: toNumber(cp.longitude ?? cp.lng ?? cp.x),
});

export default function CheckpointList({ checkpoints = [], onRemove = () => {}, raceId = null, onImported = () => {}, onUpdate = () => {}, supportedLanguages = [] }) {
  const { t } = useTranslation();
  const [selectedFile, setSelectedFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(null);
  const [formFor, setFormFor] = useState(null); // null, 'new' or the checkpoint being edited
  const [showImport, setShowImport] = useState(false);
  const [toast, setToast] = useState(null);
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Called from the edit dialog after the admin confirmed; a rejection keeps
  // the dialog open with the message.
  const handleDelete = async () => {
    const id = formFor.id ?? formFor.checkpoint_id;
    try {
      await adminApi.deleteCheckpoint(id);
    } catch (err) {
      logger.error('ADMIN', 'Failed to delete checkpoint', err);
      throw new Error(t('admin.checkpoints.deleteFailed', { message: err?.message || t('admin.common.unknownError') }));
    }
    onRemove(id);
    setFormFor(null);
    setToast({ message: t('admin.checkpoints.deleted'), type: 'success', duration: 5000 });
  };

  const handleSave = async (payload) => {
    const isNew = formFor === 'new';
    try {
      if (isNew) {
        const created = await adminApi.addCheckpoint(raceId, payload);
        onImported(Array.isArray(created) ? created : [created]);
      } else {
        const id = formFor.id ?? formFor.checkpoint_id;
        await adminApi.updateCheckpoint(id, payload);
        onUpdate(id, payload);
      }
      setFormFor(null);
      setToast({
        message: isNew ? t('admin.checkpoints.created', { name: payload.title }) : t('admin.checkpoints.updated'),
        type: 'success',
        duration: 5000
      });
    } catch (err) {
      logger.error('ADMIN', isNew ? 'Failed to create checkpoint' : 'Failed to update checkpoint', err);
      setToast({
        message: t(isNew ? 'admin.checkpoints.createFailed' : 'admin.checkpoints.updateFailed', { message: err?.message || t('admin.common.unknownError') }),
        type: 'error',
        duration: 5000
      });
      throw err;
    }
  };

  const validateItem = (it) => {
    // minimal validation: name present
    if (!it || typeof it !== 'object') return t('admin.checkpoints.validationItemNotObject');
    if (!it.name && !it.title) return t('admin.checkpoints.validationMissingName');
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
      setImportError(t('admin.checkpoints.validationSelectFile'));
      return;
    }

    if (!raceId) {
      setImportError(t('admin.checkpoints.validationMissingRace'));
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
      setImportError(t('admin.checkpoints.validationInvalidJson', { message: err.message }));
      return;
    }
    if (!Array.isArray(parsed)) {
      setImportError(t('admin.checkpoints.validationExpectedArray'));
      return;
    }
    const errors = parsed.map(validateItem).filter(Boolean);
    if (errors.length) {
      setImportError(t('admin.checkpoints.validationFailed', { error: errors[0] }));
      return;
    }

    setImporting(true);
    try {
      // map common field names and prepare batch payload (all in one request)
      const payload = parsed.map(it => ({
        title: it.name ?? it.title,
        description: it.description ?? it.desc ?? null,
        latitude: it.lat ?? it.latitude ?? it.y ?? null,
        longitude: it.lng ?? it.longitude ?? it.x ?? null,
        numOfPoints: it.numOfPoints ?? 0
      }));
      const created = await adminApi.addCheckpoint(raceId, payload);
      const checkpoints = Array.isArray(created) ? created : [created];

      // Import translations for each checkpoint
      let translationsCount = 0;
      for (let i = 0; i < checkpoints.length; i++) {
        const checkpoint = checkpoints[i];
        const sourceData = parsed[i];
        const translations = sourceData.translations || [];

        for (const trans of translations) {
          if (trans.language) {
            try {
              const translationPayload = {
                name: trans.name ?? trans.title ?? null,
                description: trans.description ?? null
              };
              await adminApi.createCheckpointTranslation(checkpoint.id, trans.language, translationPayload);
              translationsCount++;
            } catch (e) {
              logger.error('ADMIN', `Failed to create translation ${trans.language} for checkpoint ${checkpoint.id}`, e);
            }
          }
        }
      }

      // notify parent and clear file selection
      onImported(checkpoints);
      setSelectedFile(null);
      setShowImport(false);
      // Reset file input
      const fileInput = document.getElementById('checkpoint-file-input');
      if (fileInput) fileInput.value = '';

      const msg = translationsCount > 0
        ? t('admin.checkpoints.importSuccessWithTranslations', { count: checkpoints.length, translations: translationsCount })
        : t('admin.checkpoints.importSuccess', { count: checkpoints.length });
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

  const mapCheckpoints = checkpoints.map(forMap);

  return (
    <div className="mb-4">
      <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
        <h5 className="mb-0 me-auto">{t('admin.checkpoints.title')} <span className="text-muted fw-normal">({checkpoints.length})</span></h5>
        <button
          type="button"
          className={`btn btn-sm ${showImport ? 'btn-secondary' : 'btn-outline-secondary'}`}
          onClick={() => setShowImport(prev => !prev)}
          aria-expanded={showImport}
        >
          {t('admin.checkpoints.importButton')}
        </button>
        <button type="button" className="btn btn-sm btn-primary" onClick={() => setFormFor('new')}>
          + {t('admin.checkpoints.new')}
        </button>
      </div>

      {showImport && (
        <div className="card card-body mb-3">
          <form onSubmit={handleImport}>
            <div className="d-flex align-items-center gap-2 mb-2">
              <h6 className="mb-0 me-auto">{t('admin.checkpoints.importTitle')}</h6>
              <button type="button" className="btn btn-sm btn-link p-0" onClick={() => setShowHelpModal(true)}>
                {t('admin.checkpoints.importHelpTitle')}
              </button>
              <button type="button" className="btn-close" aria-label={t('admin.close')} onClick={() => setShowImport(false)} />
            </div>
            <FilePickerButton
              id="checkpoint-file-input"
              accept=".json"
              onChange={handleFileChange}
              disabled={importing}
              fileName={selectedFile?.name}
              className="mb-2"
            />
            {importError && <div className="alert alert-danger">{importError}</div>}
            <button className="btn btn-primary btn-sm" type="submit" disabled={importing || !selectedFile}>
              {importing ? t('admin.checkpoints.importing') : t('admin.checkpoints.import')}
            </button>
            <div className="small text-muted mt-2">{t('admin.checkpoints.importHelp')}</div>
          </form>
        </div>
      )}

      <div className="row g-3 mb-2">
        <div className="col-lg-6">
          {checkpoints.length === 0 ? (
            <div className="text-muted">{t('admin.checkpoints.none')}</div>
          ) : (
            <div className="list-group">
              {checkpoints.map(cp => {
                const cpId = cp.id ?? cp.checkpoint_id;
                const point = forMap(cp);
                const excerpt = plainExcerpt(cp.description);
                return (
                  <button
                    key={cpId}
                    type="button"
                    className="list-group-item list-group-item-action admin-item-row"
                    onClick={() => setFormFor(cp)}
                  >
                    <span className="d-flex align-items-center gap-2">
                      <strong className="text-truncate">{point.title}</strong>
                      <span className="badge bg-secondary flex-shrink-0">{cp.numOfPoints} {t('admin.common.pointsShort')}</span>
                      {(point.latitude === null || point.longitude === null) && (
                        <span className="badge bg-warning-subtle text-warning-emphasis flex-shrink-0">{t('admin.checkpoints.noPosition')}</span>
                      )}
                    </span>
                    {excerpt && <span className="d-block small text-muted text-truncate">{excerpt}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="col-lg-6">
          <CheckpointMap
            checkpoints={mapCheckpoints}
            onCheckpointClick={(cp) => setFormFor(checkpoints.find(item => (item.id ?? item.checkpoint_id) === cp.id) ?? cp)}
            className="admin-checkpoints-overview-map"
          />
          <div className="form-text">{t('admin.checkpoints.overviewMapHelp')}</div>
        </div>
      </div>

      {formFor !== null && (
        <CheckpointFormModal
          checkpoint={formFor === 'new' ? null : forMap(formFor)}
          checkpoints={mapCheckpoints}
          onSave={handleSave}
          onDelete={handleDelete}
          onCancel={() => setFormFor(null)}
        >
          {formFor !== 'new' && (
            <TranslationManager
              entityType="checkpoint"
              entityId={formFor.id ?? formFor.checkpoint_id}
              entityName={formFor.name ?? formFor.title}
              fields={{ title: t('admin.translationManager.fieldTitle'), description: t('admin.translationManager.fieldDescription') }}
              supportedLanguages={supportedLanguages}
            />
          )}
        </CheckpointFormModal>
      )}

      {/* Help Modal */}
      {showHelpModal && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{t('admin.checkpoints.importHelpTitle')}</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowHelpModal(false)}
                  aria-label="Close"
                ></button>
              </div>
              <div className="modal-body">
                <h6>{t('admin.checkpoints.importHelpFormat')}</h6>
                <p className="text-muted">{t('admin.checkpoints.importHelpDescription')}</p>

                <h6 className="mt-3">{t('admin.checkpoints.importHelpFields')}</h6>
                <ul>
                  <li><strong>title</strong> {t('admin.checkpoints.importHelpFieldTitle')}</li>
                  <li><strong>description</strong> {t('admin.checkpoints.importHelpFieldDesc')}</li>
                  <li><strong>lat, latitude, y</strong> {t('admin.checkpoints.importHelpFieldLat')}</li>
                  <li><strong>lng, longitude, x</strong> {t('admin.checkpoints.importHelpFieldLng')}</li>
                  <li><strong>numOfPoints</strong> {t('admin.checkpoints.importHelpFieldPoints')}</li>
                  <li><strong>translations</strong> {t('admin.checkpoints.importHelpFieldTranslations')}</li>
                </ul>

                <h6 className="mt-3">{t('admin.checkpoints.importHelpExample')}</h6>
                <pre className="bg-light p-3 rounded border" style={{ fontSize: '12px', overflow: 'auto' }}>{`[
  {
    "title": "Main Square",
    "description": "Central gathering point",
    "lat": 50.0755,
    "lng": 14.4378,
    "numOfPoints": 10,
    "translations": [
      {
        "language": "cs",
        "title": "Staroměstské náměstí",
        "description": "Hlavní sraz"
      },
      {
        "language": "de",
        "title": "Hauptplatz",
        "description": "Zentraler Treffpunkt"
      }
    ]
  },
  {
    "title": "City Hall",
    "description": "Administrative building",
    "latitude": 50.0860,
    "longitude": 14.4300,
    "numOfPoints": 5
  }
]`}</pre>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowHelpModal(false)}
                >
                  {t('admin.checkpoints.cancel')}
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