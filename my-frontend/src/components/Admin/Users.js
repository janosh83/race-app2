import React, { useEffect, useState } from 'react';
import { adminApi } from '../../services/adminApi';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formError, setFormError] = useState(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await adminApi.getUsers();
      const list = Array.isArray(payload) ? payload : (payload?.data || []);
      setUsers(list || []);
    } catch (err) {
      console.error('Failed to load users', err);
      setError('Failed to load users');
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
      setFormError('Email and password are required');
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
      console.error('Failed to create user', err);
      setFormError('Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('Delete this user?')) return;
    try {
      await adminApi.deleteUser(userId);
      setUsers(users.filter(u => u.id !== userId));
    } catch (err) {
      console.error('Failed to delete user', err);
      setError('Failed to delete user');
    }
  };

  return (
    <div className="mt-3">
      <div className="d-flex align-items-center mb-3">
        <h3 className="mb-0">Users</h3>
        <button className="btn btn-sm btn-outline-secondary ms-auto" onClick={load}>Refresh</button>
      </div>

      {formError && <div className="alert alert-warning py-2">{formError}</div>}
      {error && <div className="alert alert-danger py-2">{error}</div>}

      <div className="card mb-3">
        <div className="card-body">
          <h5 className="card-title">Create user</h5>
          <div className="row g-2 align-items-end">
            <div className="col-md-3">
              <label className="form-label">Name</label>
              <input className="form-control" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="col-md-3">
              <label className="form-label">Email</label>
              <input className="form-control" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="col-md-3">
              <label className="form-label">Password</label>
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
              <label className="form-check-label" htmlFor="isAdmin">Admin</label>
            </div>
            <div className="col-md-1">
              <button className="btn btn-primary w-100" disabled={saving} onClick={handleCreate}>
                {saving ? 'Saving…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div>Loading users…</div>
      ) : (
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Admin</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(!users || users.length === 0) && (
              <tr><td colSpan="4" className="text-muted">No users</td></tr>
            )}
            {users.map(user => (
              <tr key={user.id}>
                <td>{user.name || '—'}</td>
                <td>{user.email}</td>
                <td>{user.is_administrator ? 'Yes' : 'No'}</td>
                <td>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(user.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
