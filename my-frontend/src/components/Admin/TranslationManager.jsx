import React, { useState, useEffect } from 'react';
import { adminApi } from '../../services/adminApi';
import { SUPPORTED_LANGUAGES, LANGUAGE_LABELS } from '../../config/languages';

function TranslationManager({ raceId, entityType, entityId, entityName, fields = {} }) {
  const [translations, setTranslations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editingLanguage, setEditingLanguage] = useState(null);
  const [formData, setFormData] = useState({});

  const apiMethods = {
    race: { get: adminApi.getRaceTranslations, create: adminApi.createRaceTranslation, update: adminApi.updateRaceTranslation, delete: adminApi.deleteRaceTranslation },
    checkpoint: { get: adminApi.getCheckpointTranslations, create: adminApi.createCheckpointTranslation, update: adminApi.updateCheckpointTranslation, delete: adminApi.deleteCheckpointTranslation },
    task: { get: adminApi.getTaskTranslations, create: adminApi.createTaskTranslation, update: adminApi.updateTaskTranslation, delete: adminApi.deleteTaskTranslation },
    category: { get: adminApi.getCategoryTranslations, create: adminApi.createCategoryTranslation, update: adminApi.updateCategoryTranslation, delete: adminApi.deleteCategoryTranslation }
  };

  useEffect(() => {
    if (!entityId) return;
    fetchTranslations();
  }, [entityId, entityType]);

  const fetchTranslations = async () => {
    setLoading(true);
    setError(null);
    try {
      const methods = apiMethods[entityType];
      const data = await methods.get(entityId);
      setTranslations(Array.isArray(data) ? data : (data?.data || []));
    } catch (err) {
      console.error('Failed to fetch translations', err);
      setError('Failed to load translations');
    } finally {
      setLoading(false);
    }
  };

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
      const methods = apiMethods[entityType];
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
      console.error('Failed to save translation', err);
      setError('Failed to save translation');
    }
  };

  const handleDelete = async (language) => {
    if (!window.confirm(`Delete ${LANGUAGE_LABELS[language]} translation?`)) return;
    setError(null);
    try {
      const methods = apiMethods[entityType];
      await methods.delete(entityId, language);
      await fetchTranslations();
    } catch (err) {
      console.error('Failed to delete translation', err);
      setError('Failed to delete translation');
    }
  };

  const fieldLabels = fields || { name: 'Name', title: 'Title', description: 'Description' };
  const existingLanguages = translations.map(t => t.language);
  const missingLanguages = SUPPORTED_LANGUAGES.filter(lang => !existingLanguages.includes(lang));

  if (!entityId) {
    return <div className="text-muted">Select an item to manage translations</div>;
  }

  return (
    <div className="card">
      <div className="card-header bg-light">
        <h6 className="mb-0">Translations for {entityName}</h6>
      </div>
      <div className="card-body">
        {error && <div className="alert alert-danger alert-sm mb-2">{error}</div>}
        {loading && <div className="text-muted">Loading translations…</div>}

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
                  <button className="btn btn-sm btn-primary" onClick={handleSave}>Save</button>
                  <button className="btn btn-sm btn-secondary" onClick={() => { setEditingLanguage(null); setFormData({}); }}>Cancel</button>
                </div>
              </div>
            ) : null}

            <div>
              <h6 className="mb-2 text-muted small">Existing Translations</h6>
              {existingLanguages.length === 0 ? (
                <p className="text-muted small">No translations yet</p>
              ) : (
                <div className="list-group list-group-sm mb-3">
                  {translations.map(trans => (
                    <div key={trans.language} className="list-group-item d-flex justify-content-between align-items-center">
                      <div>
                        <strong className="small">{LANGUAGE_LABELS[trans.language]}</strong>
                        <div className="text-muted small">
                          {trans.name || trans.title || '(no name/title)'}
                        </div>
                      </div>
                      <div className="d-flex gap-1">
                        <button
                          className="btn btn-xs btn-outline-primary"
                          onClick={() => handleEdit(trans)}
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-xs btn-outline-danger"
                          onClick={() => handleDelete(trans.language)}
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {missingLanguages.length > 0 && (
                <>
                  <h6 className="mb-2 text-muted small">Add Translation</h6>
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
