import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { adminApi } from '../../services/adminApi';
import { readStoredUser } from '../../utils/currentUser';
import { logger } from '../../utils/logger';
import Toast from '../Toast';

const USERS_PAGE_SIZE = 20;
const LANGUAGES = ['en', 'cs', 'de'];

// Create a user or edit one. `onSave(payload)` and `onDelete()` return
// promises; the dialog stays open if they reject, showing the error's
// `message`. Delete asks to confirm inside the dialog and is not offered for
// the signed-in admin.
function UserDialog({ user, isSelf, onSave, onDelete, onCancel }) {
  const { t } = useTranslation();
  const isNew = !user;
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    password: '',
    preferredLanguage: user?.preferred_language || '',
    isAdmin: !!user?.is_administrator,
  });
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [dialogError, setDialogError] = useState(null);

  const set = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      is_administrator: form.isAdmin,
    };
    if (form.preferredLanguage) payload.preferred_language = form.preferredLanguage;
    if (form.password.trim()) payload.password = form.password;
    setSaving(true);
    setDialogError(null);
    try {
      await onSave(payload);
    } catch (err) {
      setDialogError(err.message); // keep the dialog and the changes
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    setDialogError(null);
    try {
      await onDelete();
    } catch (err) {
      setDialogError(err.message);
      setConfirmingDelete(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} role="dialog" aria-modal="true" aria-labelledby="user-dialog-title">
      <div className="modal-dialog modal-fullscreen-sm-down modal-dialog-scrollable">
        <form className="modal-content" onSubmit={handleSubmit}>
          <div className="modal-header">
            <h5 className="modal-title" id="user-dialog-title">
              {isNew ? t('admin.users.newTitle') : t('admin.users.editTitle')}
            </h5>
            <button type="button" className="btn-close" aria-label={t('admin.close')} onClick={onCancel}></button>
          </div>
          <div className="modal-body">
            {dialogError && <div className="alert alert-danger py-2" role="alert">{dialogError}</div>}
            <div className="mb-3">
              <label className="form-label" htmlFor="user-name">{t('admin.users.name')}</label>
              <input id="user-name" type="text" className="form-control" value={form.name} onChange={set('name')} autoFocus={isNew} />
            </div>
            <div className="mb-3">
              <label className="form-label" htmlFor="user-email">{t('admin.users.email')}</label>
              <input id="user-email" type="email" className="form-control" value={form.email} onChange={set('email')} required />
            </div>
            <div className="mb-3">
              <label className="form-label" htmlFor="user-password">{t('admin.users.password')}</label>
              <input
                id="user-password"
                type="password"
                className="form-control"
                value={form.password}
                onChange={set('password')}
                required={isNew}
                autoComplete="new-password"
                aria-describedby={isNew ? undefined : 'user-password-help'}
              />
              {!isNew && <div id="user-password-help" className="form-text">{t('admin.users.passwordKeepHelp')}</div>}
            </div>
            <div className="mb-3">
              <label className="form-label" htmlFor="user-language">{t('admin.users.preferredLanguage')}</label>
              <select id="user-language" className="form-select" value={form.preferredLanguage} onChange={set('preferredLanguage')}>
                <option value="">—</option>
                {LANGUAGES.map(lang => <option key={lang} value={lang}>{lang.toUpperCase()}</option>)}
              </select>
            </div>
            <div className="form-check form-switch">
              <input
                id="user-admin"
                type="checkbox"
                role="switch"
                className="form-check-input"
                checked={form.isAdmin}
                onChange={set('isAdmin')}
                disabled={isSelf}
                aria-describedby="user-admin-help"
              />
              <label className="form-check-label" htmlFor="user-admin">{t('admin.users.administrator')}</label>
              <div id="user-admin-help" className="form-text">
                {isSelf ? t('admin.users.selfAdminHelp') : t('admin.users.adminHelp')}
              </div>
            </div>
          </div>
          {confirmingDelete ? (
            <div className="modal-footer justify-content-between bg-danger-subtle">
              <span className="small text-danger-emphasis">
                {t('admin.users.deleteConfirm', { name: user.name || user.email })}
              </span>
              <div className="d-flex gap-2">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setConfirmingDelete(false)} disabled={saving}>
                  {t('admin.teams.keep')}
                </button>
                <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={saving}>
                  {t('admin.teams.deleteYes')}
                </button>
              </div>
            </div>
          ) : (
            <div className="modal-footer">
              {!isNew && !isSelf && (
                <button type="button" className="btn btn-outline-danger me-auto" onClick={() => setConfirmingDelete(true)}>
                  {t('admin.users.deleteUser')}
                </button>
              )}
              <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>{t('admin.users.cancel')}</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? t('admin.users.saving') : (isNew ? t('admin.users.create') : t('admin.users.saveChanges'))}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

// All users, list first: search, pages of 20, a row opens the user dialog
// (edit or delete); "+ New user" opens it empty.
export default function Users() {
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [usersPage, setUsersPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [userSearch, setUserSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [dialogUser, setDialogUser] = useState(null); // null | 'new' | user
  const currentUserId = readStoredUser()?.id;

  const load = useCallback(async (pageToLoad) => {
    setLoading(true);
    setError(null);
    try {
      const payload = await adminApi.getUsers({
        page: pageToLoad,
        per_page: USERS_PAGE_SIZE,
        search: userSearch.trim() || undefined,
      });
      const list = Array.isArray(payload) ? payload : (payload?.data || []);
      const total = Array.isArray(payload) ? list.length : Number(payload?.meta?.total || 0);
      setUsers(list || []);
      setTotalUsers(total);
    } catch (err) {
      logger.error('ADMIN', 'Failed to load users', err);
      setError(t('admin.users.errorLoad'));
    } finally {
      setLoading(false);
    }
  }, [t, userSearch]);

  useEffect(() => {
    load(usersPage);
  }, [load, usersPage]);

  useEffect(() => {
    setUsersPage(1);
  }, [userSearch]);

  const usersTotalPages = Math.max(1, Math.ceil(totalUsers / USERS_PAGE_SIZE));
  const usersPageStartIndex = totalUsers === 0 ? 0 : ((usersPage - 1) * USERS_PAGE_SIZE) + 1;
  const usersPageEndIndex = Math.min((usersPage - 1) * USERS_PAGE_SIZE + users.length, totalUsers);

  useEffect(() => {
    if (usersPage > usersTotalPages) {
      setUsersPage(usersTotalPages);
    }
  }, [usersPage, usersTotalPages]);

  const showSuccess = (message) => setToast({ message, type: 'success', duration: 4000 });

  const handleSave = async (payload) => {
    const isNew = dialogUser === 'new';
    try {
      if (isNew) {
        await adminApi.createUser(payload);
      } else {
        await adminApi.updateUser(dialogUser.id, payload);
      }
    } catch (err) {
      logger.error('ADMIN', 'Failed to save user', err);
      if (err?.status === 409) throw new Error(t('admin.users.errorEmailTaken'));
      throw new Error(isNew
        ? t('admin.users.errorCreate')
        : t('admin.users.updateFailed', { message: err?.message || t('admin.common.unknownError') }));
    }
    setDialogUser(null);
    showSuccess(isNew ? t('admin.users.createSuccess') : t('admin.users.updateSuccess'));
    await load(usersPage);
  };

  const handleDelete = async () => {
    try {
      await adminApi.deleteUser(dialogUser.id);
    } catch (err) {
      logger.error('ADMIN', 'Failed to delete user', err);
      throw new Error(t('admin.users.errorDelete'));
    }
    setDialogUser(null);
    showSuccess(t('admin.users.deleteSuccess'));
    await load(usersPage);
  };

  return (
    <div className="mt-3">
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <h2 className="h4 mb-0 me-auto">
          {t('admin.users.title')} <span className="text-muted fw-normal">({totalUsers})</span>
        </h2>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setDialogUser('new')}>
          {t('admin.users.newUser')}
        </button>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={() => load(usersPage)}
          title={t('admin.users.refresh')}
          aria-label={t('admin.users.refresh')}
        >
          ↻
        </button>
      </div>

      {error && <div className="alert alert-danger py-2 mb-3">{error}</div>}

      <input
        type="search"
        className="form-control mb-3 admin-list-search"
        placeholder={t('admin.users.searchPlaceholder')}
        aria-label={t('admin.users.searchUsers')}
        value={userSearch}
        onChange={(e) => setUserSearch(e.target.value)}
      />

      {loading && users.length === 0 && <div className="text-muted mb-3">{t('admin.users.loading')}</div>}

      <table className="table table-hover align-middle">
        <thead>
          <tr>
            <th>{t('admin.users.name')}</th>
            <th>{t('admin.users.email')}</th>
            <th className="d-none d-md-table-cell">{t('admin.users.language')}</th>
          </tr>
        </thead>
        <tbody>
          {!loading && users.length === 0 && (
            <tr><td colSpan="3" className="text-muted">{t('admin.users.noUsers')}</td></tr>
          )}
          {users.map(user => (
            // The whole row opens the user; the name is the keyboard control.
            <tr key={user.id} className="admin-race-row" onClick={() => setDialogUser(user)}>
              <td>
                <button
                  type="button"
                  className="btn btn-link p-0 fw-semibold text-start text-decoration-none"
                  onClick={(e) => { e.stopPropagation(); setDialogUser(user); }}
                >
                  {user.name || '—'}
                </button>
                {user.is_administrator && (
                  <span className="badge bg-primary-subtle text-primary-emphasis ms-2">{t('admin.users.admin')}</span>
                )}
                {user.id === currentUserId && (
                  <span className="badge text-bg-light border ms-1">{t('admin.users.you')}</span>
                )}
              </td>
              <td className="small text-muted text-break">{user.email}</td>
              <td className="d-none d-md-table-cell small">{user.preferred_language ? user.preferred_language.toUpperCase() : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {totalUsers > USERS_PAGE_SIZE && (
        <div className="d-flex align-items-center justify-content-between mt-2">
          <small className="text-muted">
            {t('admin.common.paginationShowing', {
              from: usersPageStartIndex,
              to: usersPageEndIndex,
              total: totalUsers,
            })}
          </small>
          <div className="btn-group" role="group" aria-label={t('admin.common.paginationAria')}>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              disabled={usersPage <= 1}
              onClick={() => setUsersPage((prev) => Math.max(1, prev - 1))}
            >
              {t('admin.common.paginationPrev')}
            </button>
            <span className="btn btn-sm btn-light disabled">
              {usersPage} / {usersTotalPages}
            </span>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              disabled={usersPage >= usersTotalPages}
              onClick={() => setUsersPage((prev) => Math.min(usersTotalPages, prev + 1))}
            >
              {t('admin.common.paginationNext')}
            </button>
          </div>
        </div>
      )}

      {dialogUser !== null && (
        <UserDialog
          user={dialogUser === 'new' ? null : dialogUser}
          isSelf={dialogUser !== 'new' && dialogUser.id === currentUserId}
          onSave={handleSave}
          onDelete={handleDelete}
          onCancel={() => setDialogUser(null)}
        />
      )}

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
