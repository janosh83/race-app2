import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { adminApi } from '../../services/adminApi';
import { logger } from '../../utils/logger';
import LanguageFlagsDisplay from '../LanguageFlagsDisplay';

import TranslationManager from './TranslationManager';

export default function CategoryForm({ raceId, supportedLanguages = [] }) {
  const { t } = useTranslation();
  const [allCategories, setAllCategories] = useState([]);
  const [assigned, setAssigned] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [newName, setNewName] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [categoryTranslations, setCategoryTranslations] = useState({});

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [cats, raceCats] = await Promise.all([
        adminApi.listCategories(),
        adminApi.getRaceCategories(raceId),
      ]);
      setAllCategories(Array.isArray(cats) ? cats : (cats?.data || []));
      setAssigned(Array.isArray(raceCats) ? raceCats : (raceCats?.data || []));
    } catch (err) {
      logger.error('ADMIN', 'Failed to load categories', err);
      setError(t('admin.categoryForm.errorLoad'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (raceId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raceId]);

  useEffect(() => {
    const fetchAllTranslations = async () => {
      const uniqueCategoryIds = [...new Set([...allCategories, ...assigned].map(cat => cat.id).filter(Boolean))];
      const currentIds = Object.keys(categoryTranslations).map(Number);
      const idsToFetch = uniqueCategoryIds.filter(id => !currentIds.includes(id));

      if (idsToFetch.length === 0) {
        const removedIds = currentIds.filter(id => !uniqueCategoryIds.includes(id));
        if (removedIds.length > 0) {
          setCategoryTranslations(prev => {
            const cleanedMap = { ...prev };
            removedIds.forEach(id => delete cleanedMap[id]);
            return cleanedMap;
          });
        }
        return;
      }

      const newTranslations = {};
      for (const categoryId of idsToFetch) {
        try {
          const data = await adminApi.getCategoryTranslations(categoryId);
          newTranslations[categoryId] = Array.isArray(data) ? data : (data?.data || []);
        } catch (e) {
          logger.error('ADMIN', `Failed to load translations for category ${categoryId}`, e);
          newTranslations[categoryId] = [];
        }
      }

      setCategoryTranslations(prev => ({ ...prev, ...newTranslations }));
    };

    if (allCategories.length > 0 || assigned.length > 0) {
      fetchAllTranslations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCategories.map(c => c.id).join(','), assigned.map(c => c.id).join(',')]);

  const isAssigned = (catId) => assigned.some(c => c.id === catId);

  const assign = async (catId) => {
    try {
      await adminApi.addRaceCategory(raceId, catId);
      await load();
    } catch (err) {
      logger.error('ADMIN', 'Failed to assign category', err);
      setError(t('admin.categoryForm.errorAssign'));
    }
  };

  const unassign = async (catId) => {
    if (!window.confirm(t('admin.categoryForm.unassignConfirm'))) return;
    try {
      await adminApi.removeRaceCategory(raceId, catId);
      await load();
    } catch (err) {
      logger.error('ADMIN', 'Failed to unassign category', err);
      setError(t('admin.categoryForm.errorUnassign'));
    }
  };

  const createAndAssign = async (assignAfter = false) => {
    if (!newName.trim()) return;
    try {
      const created = await adminApi.createCategory({ name: newName.trim() });
      setNewName('');
      await load();
      if (assignAfter && created && created.id) {
        await adminApi.addRaceCategory(raceId, created.id);
        await load();
      }
    } catch (err) {
      logger.error('ADMIN', 'Failed to create category', err);
      setError(t('admin.categoryForm.errorCreate'));
    }
  };

  if (!raceId) return null;

  const renderCategoryItem = (cat) => {
    const catId = cat.id;
    const assignedToRace = isAssigned(catId);
    const isExpanded = expandedId === catId;
    const translations = categoryTranslations[catId] || [];
    const translationLanguages = translations.map(item => item.language);

    return (
      <li key={catId} className="list-group-item">
        <div className="d-flex justify-content-between align-items-start">
          <div
            className="flex-grow-1"
            style={{ cursor: 'pointer' }}
            onClick={() => setExpandedId(isExpanded ? null : catId)}
          >
            <div className="d-flex align-items-center gap-2">
              <span className="me-1">{isExpanded ? '▼' : '▶'}</span>
              <strong>{cat.name}</strong>
              <span className={`badge ${assignedToRace ? 'bg-success' : 'bg-secondary'}`}>
                {assignedToRace ? t('admin.categoryForm.assignedToRace') : t('admin.categoryForm.allCategories')}
              </span>
              {translationLanguages.length > 0 && (
                <LanguageFlagsDisplay
                  languages={translationLanguages}
                  flagWidth={20}
                  flagHeight={14}
                />
              )}
            </div>
          </div>
        </div>

        {isExpanded && (
          <div className="mt-3 pt-3 border-top">
            <div className="mb-3 d-flex justify-content-between align-items-start gap-2">
              <div className="small">
                <strong>{t('admin.translationManager.fieldDescription')}:</strong>{' '}
                {cat.description || <span className="text-muted">—</span>}
              </div>
              <div>
                {assignedToRace ? (
                  <button className="btn btn-sm btn-outline-danger" onClick={() => unassign(catId)}>{t('admin.categoryForm.unassign')}</button>
                ) : (
                  <button className="btn btn-sm btn-primary" onClick={() => assign(catId)}>{t('admin.categoryForm.assign')}</button>
                )}
              </div>
            </div>

            <TranslationManager
              entityType="category"
              entityId={catId}
              entityName={cat.name}
              fields={{ name: t('admin.translationManager.fieldName'), description: t('admin.translationManager.fieldDescription') }}
              supportedLanguages={supportedLanguages}
            />
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="mt-3">
      <div className="d-flex align-items-center mb-2">
        <h4 className="me-3">{t('admin.categoryForm.title')}</h4>
        <button className="btn btn-sm btn-outline-secondary ms-auto" onClick={load}>{t('admin.categoryForm.refresh')}</button>
      </div>

      {loading && <div>{t('admin.categoryForm.loading')}</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="row">
        <div className="col-12 mb-3">
          <h5>{t('admin.categoryForm.allCategories')}</h5>
          <ul className="list-group">
            {allCategories.map(renderCategoryItem)}
            {allCategories.length === 0 && <li className="list-group-item text-muted">{t('admin.categoryForm.noCategories')}</li>}
          </ul>
        </div>

        <div className="col-12">
          <div className="card p-3">
            <h6>{t('admin.categoryForm.createNew')}</h6>
            <div className="input-group">
              <input className="form-control" placeholder={t('admin.categoryForm.categoryName')} value={newName} onChange={e => setNewName(e.target.value)} />
              <button className="btn btn-primary" onClick={() => createAndAssign(false)}>{t('admin.categoryForm.create')}</button>
              <button className="btn btn-success" onClick={() => createAndAssign(true)}>{t('admin.categoryForm.createAssign')}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
