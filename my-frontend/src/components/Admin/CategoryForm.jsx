import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { adminApi } from '../../services/adminApi';
import { logger } from '../../utils/logger';

export default function CategoryForm({ raceId }) {
  const { t } = useTranslation();
  const [allCategories, setAllCategories] = useState([]);
  const [assigned, setAssigned] = useState([]); // array of category objects assigned to race
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [newName, setNewName] = useState('');

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

  return (
    <div className="mt-3">
      <div className="d-flex align-items-center mb-2">
        <h4 className="me-3">{t('admin.categoryForm.title')}</h4>
        <button className="btn btn-sm btn-outline-secondary ms-auto" onClick={load}>{t('admin.categoryForm.refresh')}</button>
      </div>

      {loading && <div>{t('admin.categoryForm.loading')}</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="row">
        <div className="col-md-6">
          <h5>{t('admin.categoryForm.allCategories')}</h5>
          <ul className="list-group">
            {allCategories.map(cat => (
              <li key={cat.id} className="list-group-item d-flex justify-content-between align-items-center">
                <div>{cat.name}</div>
                <div>
                  {isAssigned(cat.id) ? (
                    <button className="btn btn-sm btn-outline-danger" onClick={() => unassign(cat.id)}>{t('admin.categoryForm.unassign')}</button>
                  ) : (
                    <button className="btn btn-sm btn-primary" onClick={() => assign(cat.id)}>{t('admin.categoryForm.assign')}</button>
                  )}
                </div>
              </li>
            ))}
            {allCategories.length === 0 && <li className="list-group-item text-muted">{t('admin.categoryForm.noCategories')}</li>}
          </ul>
        </div>

        <div className="col-md-6">
          <h5>{t('admin.categoryForm.assignedToRace')}</h5>
          <ul className="list-group mb-3">
            {assigned.map(cat => (
              <li key={cat.id} className="list-group-item d-flex justify-content-between align-items-center">
                <div>{cat.name}</div>
                <button className="btn btn-sm btn-outline-danger" onClick={() => unassign(cat.id)}>{t('admin.categoryForm.unassign')}</button>
              </li>
            ))}
            {assigned.length === 0 && <li className="list-group-item text-muted">{t('admin.categoryForm.noAssigned')}</li>}
          </ul>

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