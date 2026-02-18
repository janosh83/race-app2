import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../../services/adminApi';
import Toast from '../Toast';
import { logger } from '../../utils/logger';

export default function Users() {
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formError, setFormError] = useState(null);
  const [toast, setToast] = useState(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    password: '',
    isAdmin: false
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await adminApi.getUsers();
      const list = Array.isArray(payload) ? payload : (payload?.data || []);
      setUsers(list || []);
    } catch (err) {
      logger.error('ADMIN', 'Failed to load users', err);
      setError(t('admin.users.errorLoad'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    setFormError(null);
    if (!email.trim() || !password.trim()) {
      setFormError(t('admin.users.errorEmailPasswordRequired'));
      return;
    }
    setSaving(true);
    try {
      await adminApi.createUser({
        name: name.trim(),
        email: email.trim(),
        password: password.trim(),
        is_administrator: isAdmin,
      });
      setName('');
      setEmail('');
      setPassword('');
      setIsAdmin(false);
      await load();
    } catch (err) {
      logger.error('ADMIN', 'Failed to create user', err);
      setFormError(t('admin.users.errorCreate'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm(t('admin.users.confirmDelete'))) return;
    try {
      await adminApi.deleteUser(userId);
      setUsers(users.filter(u => u.id !== userId));
    } catch (err) {
      logger.error('ADMIN', 'Failed to delete user', err);
      setError(t('admin.users.errorDelete'));
    }
  };

  const handleEdit = (user) => {
    setEditingId(user.id);
    setEditForm({
      name: user.name || '',
      email: user.email || '',
      password: '',
      isAdmin: user.is_administrator || false
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
        name: editForm.name,
        email: editForm.email,
        is_administrator: editForm.isAdmin
      };
      // Only include password if provided
      if (editForm.password.trim()) {
        payload.password = editForm.password;
      }
      await adminApi.updateUser(editingId, payload);
      setUsers(users.map(u => u.id === editingId ? { ...u, ...payload } : u));
      setEditingId(null);
      setToast({
        message: t('admin.users.updateSuccess'),
        type: 'success',
        duration: 5000
      });
    } catch (err) {
      logger.error('ADMIN', 'Failed to update user', err);
      setToast({
        message: t('admin.users.updateFailed', { message: err?.message || t('admin.common.unknownError') }),
        type: 'error',
        duration: 5000
      });
    }
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditForm({
      name: '',
      email: '',
      password: '',
      isAdmin: false
    });
  };

  return (
    <div className="mt-3">
      <div className="d-flex align-items-center mb-3">
        <h3 className="mb-0">{t('admin.users.title')}</h3>
        <button className="btn btn-sm btn-outline-secondary ms-auto" onClick={load}>{t('admin.users.refresh')}</button>
      </div>

      {formError && <div className="alert alert-warning py-2">{formError}</div>}
      {error && <div className="alert alert-danger py-2">{error}</div>}

      <div className="card mb-3">
        <div className="card-body">
          <h5 className="card-title">{t('admin.users.createTitle')}</h5>
          <div className="row g-2 align-items-end">
            <div className="col-md-3">
              <label className="form-label">{t('admin.users.name')}</label>
              <input className="form-control" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="col-md-3">
              <label className="form-label">{t('admin.users.email')}</label>
              <input className="form-control" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="col-md-3">
              <label className="form-label">{t('admin.users.password')}</label>
              <input className="form-control" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="col-md-2 form-check mt-4 ms-2">
              <input
                id="isAdmin"
                className="form-check-input"
                type="checkbox"
                checked={isAdmin}
                onChange={(e) => setIsAdmin(e.target.checked)}
              />
              <label className="form-check-label" htmlFor="isAdmin">{t('admin.users.admin')}</label>
            </div>
            <div className="col-md-1">
              <button className="btn btn-primary w-100" disabled={saving} onClick={handleCreate}>
                {saving ? t('admin.users.saving') : t('admin.users.create')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div>{t('admin.users.loading')}</div>
      ) : (
        <table className="table table-sm">
          <thead>
            <tr>
              <th>{t('admin.users.name')}</th>
              <th>{t('admin.users.email')}</th>
              <th>{t('admin.users.admin')}</th>
              <th>{t('admin.users.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {(!users || users.length === 0) && (
              <tr><td colSpan="4" className="text-muted">{t('admin.users.noUsers')}</td></tr>
            )}
            {users.map(user => (
              <tr key={user.id}>
                <td>{user.name || '—'}</td>
                <td>{user.email}</td>
                <td>{user.is_administrator ? t('admin.teamCreation.adminYes') : t('admin.teamCreation.adminNo')}</td>
                <td>
                  <button className="btn btn-sm btn-primary me-2" onClick={() => handleEdit(user)}>{t('admin.users.edit')}</button>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(user.id)}>{t('admin.users.delete')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Edit Modal */}
      {editingId !== null && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{t('admin.users.editTitle')}</h5>
                <button type="button" className="btn-close" onClick={handleEditCancel}></button>
              </div>
              <form onSubmit={handleEditSubmit}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">{t('admin.users.name')}</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editForm.name}
                      onChange={(e) => handleEditChange('name', e.target.value)}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">{t('admin.users.email')}</label>
                    <input
                      type="email"
                      className="form-control"
                      value={editForm.email}
                      onChange={(e) => handleEditChange('email', e.target.value)}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">{t('admin.users.passwordHint')}</label>
                    <input
                      type="password"
                      className="form-control"
                      value={editForm.password}
                      onChange={(e) => handleEditChange('password', e.target.value)}
                      placeholder={t('admin.users.passwordPlaceholder')}
                    />
                  </div>
                  <div className="form-check">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id="editAdmin"
                      checked={editForm.isAdmin}
                      onChange={(e) => handleEditChange('isAdmin', e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="editAdmin">
                      {t('admin.users.administrator')}
                    </label>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={handleEditCancel}>{t('admin.users.cancel')}</button>
                  <button type="submit" className="btn btn-primary">{t('admin.users.saveChanges')}</button>
                </div>
              </form>
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
      )}    </div>
  );
}