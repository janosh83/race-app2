import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../../services/adminApi';
import Toast from '../Toast';
import TranslationManager from './TranslationManager';
import LanguageFlagsDisplay from '../LanguageFlagsDisplay';
import { logger } from '../../utils/logger';

export default function CheckpointList({ checkpoints = [], onRemove = () => {}, raceId = null, onImported = () => {}, onUpdate = () => {}, supportedLanguages = [] }) {
  const { t } = useTranslation();
  const [selectedFile, setSelectedFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [checkpointTranslations, setCheckpointTranslations] = useState({});
  const [toast, setToast] = useState(null);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    latitude: '',
    longitude: '',
    numOfPoints: ''
  });

  // Fetch translations for all checkpoints
  useEffect(() => {
    const fetchAllTranslations = async () => {
      const checkpointIds = checkpoints.map(cp => cp.id ?? cp.checkpoint_id).filter(Boolean);
      const currentIds = Object.keys(checkpointTranslations).map(Number);
      
      // Only fetch for checkpoints we don't have translations for yet
      const idsToFetch = checkpointIds.filter(id => !currentIds.includes(id));
      
      if (idsToFetch.length === 0) {
        // Clean up translations for removed checkpoints
        const removedIds = currentIds.filter(id => !checkpointIds.includes(id));
        if (removedIds.length > 0) {
          setCheckpointTranslations(prev => {
            const cleanedMap = { ...prev };
            removedIds.forEach(id => delete cleanedMap[id]);
            return cleanedMap;
          });
        }
        return;
      }
      
      const newTranslations = {};
      for (const cpId of idsToFetch) {
        try {
          const data = await adminApi.getCheckpointTranslations(cpId);
          newTranslations[cpId] = Array.isArray(data) ? data : (data?.data || []);
        } catch (e) {
          logger.error('ADMIN', `Failed to load translations for checkpoint ${cpId}`, e);
          newTranslations[cpId] = [];
        }
      }
      
      setCheckpointTranslations(prev => ({ ...prev, ...newTranslations }));
    };

    if (checkpoints.length > 0) {
      fetchAllTranslations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkpoints.map(cp => cp.id ?? cp.checkpoint_id).join(',')]);

  const handleDelete = async (id) => {
    if (!window.confirm(t('admin.checkpoints.deleteConfirm'))) return;
    try {
      await adminApi.deleteCheckpoint(id);
      onRemove(id);
      setToast({
        message: t('admin.checkpoints.deleted'),
        type: 'success',
        duration: 5000
      });
    } catch (err) {
      logger.error('ADMIN', 'Failed to delete checkpoint', err);
      setToast({
        message: t('admin.checkpoints.deleteFailed', { message: err?.message || t('admin.common.unknownError') }),
        type: 'error',
        duration: 5000
      });
    }
  };

  const handleEdit = (checkpoint) => {
    setEditingId(checkpoint.id ?? checkpoint.checkpoint_id);
    setEditForm({
      title: checkpoint.name ?? checkpoint.title ?? '',
      description: checkpoint.description ?? '',
      latitude: checkpoint.lat ?? checkpoint.latitude ?? '',
      longitude: checkpoint.lng ?? checkpoint.longitude ?? '',
      numOfPoints: checkpoint.numOfPoints ?? 0
    });
  };

  const handleEditChange = (field, value) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        title: editForm.title,
        description: editForm.description,
        latitude: editForm.latitude ? parseFloat(editForm.latitude) : null,
        longitude: editForm.longitude ? parseFloat(editForm.longitude) : null,
        numOfPoints: editForm.numOfPoints ? parseInt(editForm.numOfPoints) : 0
      };
      await adminApi.updateCheckpoint(editingId, payload);
      onUpdate(editingId, payload);
      setEditingId(null);
      setToast({
        message: t('admin.checkpoints.updated'),
        type: 'success',
        duration: 5000
      });
    } catch (err) {
      logger.error('ADMIN', 'Failed to update checkpoint', err);
      setToast({
        message: t('admin.checkpoints.updateFailed', { message: err?.message || t('admin.common.unknownError') }),
        type: 'error',
        duration: 5000
      });
    }
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditForm({
      title: '',
      description: '',
      latitude: '',
      longitude: '',
      numOfPoints: ''
    });
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

  return (
    <div className="mb-3">
      <h5>{t('admin.checkpoints.title')}</h5>

      <div className="mb-2">
        {checkpoints.length === 0 ? (
          <div className="text-muted">{t('admin.checkpoints.none')}</div>
        ) : (
          <div className="list-group">
            {checkpoints.map(cp => {
              const cpId = cp.id ?? cp.checkpoint_id;
              const isExpanded = expandedId === cpId;
              const translations = checkpointTranslations[cpId] || [];
              const translationLanguages = translations.map(t => t.language);
              
              return (
                <div key={cpId} className="list-group-item">
                  <div className="d-flex justify-content-between align-items-start">
                    <div className="flex-grow-1" style={{ cursor: 'pointer' }} onClick={() => setExpandedId(isExpanded ? null : cpId)}>
                      <div className="d-flex align-items-center gap-2">
                        <span className="me-1">{isExpanded ? '▼' : '▶'}</span>
                        <strong>{cp.name ?? cp.title}</strong>
                        {translationLanguages.length > 0 && (
                          <LanguageFlagsDisplay 
                            languages={translationLanguages}
                            flagWidth={20}
                            flagHeight={14}
                          />
                        )}
                        <span className="badge bg-secondary">{cp.numOfPoints} pts</span>
                      </div>
                    </div>
                    <div className="d-flex gap-1">
                      <button className="btn btn-sm btn-outline-primary" onClick={(e) => { e.stopPropagation(); handleEdit(cp); }}>{t('admin.translationManager.edit')}</button>
                      <button className="btn btn-sm btn-outline-danger" onClick={(e) => { e.stopPropagation(); handleDelete(cpId); }}>{t('admin.translationManager.delete')}</button>
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-top">
                      <div className="row">
                        <div className="col-md-6">
                          <h6 className="text-muted small">{t('admin.checkpoints.details')}</h6>
                          <dl className="row small">
                            <dt className="col-sm-4">{t('admin.checkpoints.labelDescription')}</dt>
                            <dd className="col-sm-8">{cp.description || <span className="text-muted">—</span>}</dd>
                            
                            <dt className="col-sm-4">{t('admin.checkpoints.labelCoordinates')}</dt>
                            <dd className="col-sm-8">
                              {(cp.lat ?? cp.latitude ?? cp.y) && (cp.lng ?? cp.longitude ?? cp.x)
                                ? `${cp.lat ?? cp.latitude ?? cp.y}, ${cp.lng ?? cp.longitude ?? cp.x}`
                                : <span className="text-muted">—</span>}
                            </dd>
                            
                            <dt className="col-sm-4">{t('admin.checkpoints.labelPoints')}</dt>
                            <dd className="col-sm-8">{cp.numOfPoints}</dd>
                          </dl>
                        </div>
                        
                        <div className="col-md-6">
                          <h6 className="text-muted small">{t('admin.checkpoints.translations')}</h6>
                          <TranslationManager
                            entityType="checkpoint"
                            entityId={cpId}
                            entityName={cp.name ?? cp.title}
                            fields={{ title: t('admin.translationManager.fieldTitle'), description: t('admin.translationManager.fieldDescription') }}
                            supportedLanguages={supportedLanguages}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingId !== null && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{t('admin.checkpoints.editTitle')}</h5>
                <button type="button" className="btn-close" onClick={handleEditCancel}></button>
              </div>
              <form onSubmit={handleEditSubmit}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">{t('admin.checkpoints.fieldTitle')}</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editForm.title}
                      onChange={(e) => handleEditChange('title', e.target.value)}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">{t('admin.checkpoints.fieldDescription')}</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      value={editForm.description}
                      onChange={(e) => handleEditChange('description', e.target.value)}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">{t('admin.checkpoints.fieldLatitude')}</label>
                    <input
                      type="number"
                      step="0.0001"
                      className="form-control"
                      value={editForm.latitude}
                      onChange={(e) => handleEditChange('latitude', e.target.value)}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">{t('admin.checkpoints.fieldLongitude')}</label>
                    <input
                      type="number"
                      step="0.0001"
                      className="form-control"
                      value={editForm.longitude}
                      onChange={(e) => handleEditChange('longitude', e.target.value)}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">{t('admin.checkpoints.fieldPoints')}</label>
                    <input
                      type="number"
                      className="form-control"
                      value={editForm.numOfPoints}
                      onChange={(e) => handleEditChange('numOfPoints', e.target.value)}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={handleEditCancel}>{t('admin.checkpoints.cancel')}</button>
                  <button type="submit" className="btn btn-primary">{t('admin.checkpoints.saveChanges')}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="card card-body">
        <form onSubmit={handleImport}>
          <label className="form-label">{t('admin.checkpoints.importTitle')}</label>
          <input
            id="checkpoint-file-input"
            type="file"
            accept=".json"
            className="form-control mb-2"
            onChange={handleFileChange}
            disabled={importing}
          />
          {importError && <div className="alert alert-danger">{importError}</div>}
          <div className="d-flex gap-2">
            <button className="btn btn-primary" type="submit" disabled={importing || !selectedFile}>
              {importing ? t('admin.checkpoints.importing') : t('admin.checkpoints.import')}
            </button>
            <button 
              type="button" 
              className="btn btn-outline-secondary" 
              onClick={() => {
                setSelectedFile(null);
                const fileInput = document.getElementById('checkpoint-file-input');
                if (fileInput) fileInput.value = '';
              }} 
              disabled={importing || !selectedFile}
            >
              {t('admin.checkpoints.clear')}
            </button>
          </div>
          <div className="small text-muted mt-2">
            {t('admin.checkpoints.importHelp')}
          </div>
        </form>
      </div>

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