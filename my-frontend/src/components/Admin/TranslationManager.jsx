import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { SUPPORTED_LANGUAGES, LANGUAGE_LABELS } from '../../config/languages';
import { adminApi } from '../../services/adminApi';
import { logger } from '../../utils/logger';


const API_METHODS = {
  race: { get: adminApi.getRaceTranslations, create: adminApi.createRaceTranslation, update: adminApi.updateRaceTranslation, delete: adminApi.deleteRaceTranslation },
  checkpoint: { get: adminApi.getCheckpointTranslations, create: adminApi.createCheckpointTranslation, update: adminApi.updateCheckpointTranslation, delete: adminApi.deleteCheckpointTranslation },
  task: { get: adminApi.getTaskTranslations, create: adminApi.createTaskTranslation, update: adminApi.updateTaskTranslation, delete: adminApi.deleteTaskTranslation },
  category: { get: adminApi.getCategoryTranslations, create: adminApi.createCategoryTranslation, update: adminApi.updateCategoryTranslation, delete: adminApi.deleteCategoryTranslation }
};

function TranslationManager({ raceId: _raceId, entityType, entityId, entityName, fields = {}, supportedLanguages = SUPPORTED_LANGUAGES }) {
  const { t } = useTranslation();
  const [translations, setTranslations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editingLanguage, setEditingLanguage] = useState(null);
  const [formData, setFormData] = useState({});

  const fetchTranslations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const methods = API_METHODS[entityType];
      const data = await methods.get(entityId);
      setTranslations(Array.isArray(data) ? data : (data?.data || []));
    } catch (err) {
      logger.error('ADMIN', 'Failed to fetch translations', err);
      setError(t('admin.translationManager.errorLoad'));
    } finally {
      setLoading(false);
    }
  }, [entityId, entityType, t]);

  useEffect(() => {
    if (!entityId) return;
    fetchTranslations();
  }, [entityId, fetchTranslations]);

  const handleEdit = (translation) => {
    setEditingLanguage(translation.language);
    setFormData({ ...translation });
  };

  const handleCreate = (language) => {
    setEditingLanguage(language);
    setFormData({ language });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!editingLanguage) return;
    setError(null);
    try {
      const methods = API_METHODS[entityType];
      const isNew = !translations.some(t => t.language === editingLanguage);

      if (isNew) {
        await methods.create(entityId, editingLanguage, formData);
      } else {
        await methods.update(entityId, editingLanguage, formData);
      }

      await fetchTranslations();
      setEditingLanguage(null);
      setFormData({});
    } catch (err) {
      logger.error('ADMIN', 'Failed to save translation', err);
      setError(t('admin.translationManager.saveError'));
    }
  };

  const handleDelete = async (language) => {
    if (!window.confirm(t('admin.translationManager.deleteConfirm', { language: LANGUAGE_LABELS[language] || language }))) return;
    setError(null);
    try {
      const methods = API_METHODS[entityType];
      await methods.delete(entityId, language);
      await fetchTranslations();
    } catch (err) {
      logger.error('ADMIN', 'Failed to delete translation', err);
      setError(t('admin.translationManager.deleteError'));
    }
  };

  const fieldLabels = Object.keys(fields || {}).length > 0
    ? fields
    : {
        name: t('admin.translationManager.fieldName'),
        title: t('admin.translationManager.fieldTitle'),
        description: t('admin.translationManager.fieldDescription')
      };
  const existingLanguages = translations.map(t => t.language);
  const missingLanguages = supportedLanguages.filter(lang => !existingLanguages.includes(lang));

  if (!entityId) {
    return <div className="text-muted">{t('admin.translationManager.selectItem')}</div>;
  }

  return (
    <div className="card">
      <div className="card-header bg-light">
        <h6 className="mb-0">{t('admin.translationManager.title', { name: entityName })}</h6>
      </div>
      <div className="card-body">
        {error && <div className="alert alert-danger alert-sm mb-2">{error}</div>}
        {loading && <div className="text-muted">{t('admin.translationManager.loading')}</div>}

        {!loading && (
          <>
            {editingLanguage ? (
              <div className="border rounded p-3 mb-3 bg-light">
                <h6 className="mb-3">{LANGUAGE_LABELS[editingLanguage]}</h6>
                <div className="mb-3">
                  {Object.entries(fieldLabels).map(([key, label]) => (
                    <div key={key} className="mb-2">
                      <label htmlFor={`trans-${key}`} className="form-label small">{label}</label>
                      {key === 'description' ? (
                        <textarea
                          id={`trans-${key}`}
                          className="form-control form-control-sm"
                          name={key}
                          value={formData[key] || ''}
                          onChange={handleInputChange}
                          rows="3"
                        />
                      ) : (
                        <input
                          id={`trans-${key}`}
                          type="text"
                          className="form-control form-control-sm"
                          name={key}
                          value={formData[key] || ''}
                          onChange={handleInputChange}
                        />
                      )}
                    </div>
                  ))}
                </div>
                <div className="d-flex gap-2">
                  <button className="btn btn-sm btn-primary" onClick={handleSave}>{t('admin.translationManager.save')}</button>
                  <button className="btn btn-sm btn-secondary" onClick={() => { setEditingLanguage(null); setFormData({}); }}>{t('admin.translationManager.cancel')}</button>
                </div>
              </div>
            ) : null}

            <div>
              <h6 className="mb-2 text-muted small">{t('admin.translationManager.existingTitle')}</h6>
              {existingLanguages.length === 0 ? (
                <p className="text-muted small">{t('admin.translationManager.noTranslations')}</p>
              ) : (
                <div className="list-group list-group-sm mb-3">
                  {translations.map(trans => (
                    <div key={trans.language} className="list-group-item d-flex justify-content-between align-items-center">
                      <div>
                        <strong className="small">{LANGUAGE_LABELS[trans.language]}</strong>
                        <div className="text-muted small">
                          {trans.name || trans.title || t('admin.translationManager.noNameTitle')}
                        </div>
                      </div>
                      <div className="d-flex gap-1">
                        <button
                          className="btn btn-xs btn-outline-primary"
                          onClick={() => handleEdit(trans)}
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        >
                          {t('admin.translationManager.edit')}
                        </button>
                        <button
                          className="btn btn-xs btn-outline-danger"
                          onClick={() => handleDelete(trans.language)}
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        >
                          {t('admin.translationManager.delete')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {missingLanguages.length > 0 && (
                <>
                  <h6 className="mb-2 text-muted small">{t('admin.translationManager.addTitle')}</h6>
                  <div className="d-flex gap-1">
                    {missingLanguages.map(lang => (
                      <button
                        key={lang}
                        className="btn btn-sm btn-outline-success"
                        onClick={() => handleCreate(lang)}
                      >
                        + {LANGUAGE_LABELS[lang]}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default TranslationManager;
