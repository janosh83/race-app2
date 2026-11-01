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

// `placeholders`: the original text per field, shown in the empty input.
// `defaultLanguage`: the race's language, the one the original texts are
// written in; it is not offered as a translation.
function TranslationManager({ raceId: _raceId, entityType, entityId, entityName, fields = {}, placeholders = {}, supportedLanguages = SUPPORTED_LANGUAGES, defaultLanguage = null }) {
  const { t } = useTranslation();
  const [translations, setTranslations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editingLanguage, setEditingLanguage] = useState(null);
  const [formData, setFormData] = useState({});
  const [confirmingDelete, setConfirmingDelete] = useState(null); // language

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
    setConfirmingDelete(null);
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
  const missingLanguages = supportedLanguages.filter(lang => !existingLanguages.includes(lang) && lang !== defaultLanguage);

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
                          placeholder={placeholders[key] || undefined}
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
                          placeholder={placeholders[key] || undefined}
                        />
                      )}
                    </div>
                  ))}
                </div>
                <div className="d-flex gap-2">
                  <button type="button" className="btn btn-sm btn-primary" onClick={handleSave}>{t('admin.translationManager.save')}</button>
                  <button type="button" className="btn btn-sm btn-secondary" onClick={() => { setEditingLanguage(null); setFormData({}); }}>{t('admin.translationManager.cancel')}</button>
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
                      {confirmingDelete === trans.language ? (
                        <div className="d-flex flex-wrap align-items-center justify-content-end gap-1">
                          <span className="small text-danger-emphasis me-1">
                            {t('admin.translationManager.deleteConfirm', { language: LANGUAGE_LABELS[trans.language] || trans.language })}
                          </span>
                          <button type="button" className="btn btn-sm btn-outline-secondary py-0" onClick={() => setConfirmingDelete(null)}>
                            {t('admin.teams.keep')}
                          </button>
                          <button type="button" className="btn btn-sm btn-danger py-0" onClick={() => handleDelete(trans.language)}>
                            {t('admin.teams.deleteYes')}
                          </button>
                        </div>
                      ) : (
                        <div className="d-flex gap-1">
                          <button type="button" className="btn btn-sm btn-outline-primary py-0" onClick={() => handleEdit(trans)}>
                            {t('admin.translationManager.edit')}
                          </button>
                          <button type="button" className="btn btn-sm btn-outline-danger py-0" onClick={() => setConfirmingDelete(trans.language)}>
                            {t('admin.translationManager.delete')}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {defaultLanguage && (
                <p className="small text-muted mb-2">
                  {t('admin.translationManager.originalLanguage', { language: LANGUAGE_LABELS[defaultLanguage] || defaultLanguage })}
                </p>
              )}
              {missingLanguages.length > 0 && (
                <>
                  <h6 className="mb-2 text-muted small">{t('admin.translationManager.addTitle')}</h6>
                  <div className="d-flex gap-1">
                    {missingLanguages.map(lang => (
                      <button
                        key={lang}
                        type="button"
                        className="btn btn-sm btn-outline-primary"
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
