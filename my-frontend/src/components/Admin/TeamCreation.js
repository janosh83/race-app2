import React, { useState } from 'react';
import { adminApi } from '../../services/adminApi';

export default function TeamCreation({ teams, users, onTeamCreated, onMembersAdded }) {
  const [newTeamName, setNewTeamName] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [savingTeam, setSavingTeam] = useState(false);
  const [savingMembers, setSavingMembers] = useState(false);
  const [error, setError] = useState(null);

  const handleCreateTeam = async () => {
    setError(null);
    const name = newTeamName.trim();
    if (!name) return;
    setSavingTeam(true);
    try {
      const created = await adminApi.createTeam({ name });
      setNewTeamName('');
      if (onTeamCreated) onTeamCreated(created);
      if (created?.id) setSelectedTeamId(created.id.toString());
    } catch (err) {
      console.error('Failed to create team', err);
      setError('Failed to create team');
    } finally {
      setSavingTeam(false);
    }
  };

  const handleAddMembers = async () => {
    setError(null);
    if (!selectedTeamId) {
      setError('Select a team first');
      return;
    }
    const ids = selectedUserIds.filter(n => Number.isInteger(n));
    if (ids.length === 0) {
      setError('Select at least one user');
      return;
    }
    setSavingMembers(true);
    try {
      await adminApi.addTeamMembers(Number(selectedTeamId), { user_ids: ids });
      setSelectedUserIds([]);
      if (onMembersAdded) onMembersAdded();
    } catch (err) {
      console.error('Failed to add members', err);
      setError('Failed to add members');
    } finally {
      setSavingMembers(false);
    }
  };

  return (
    <div className="card h-100 p-3">
      <h5 className="mb-3">Create team</h5>
      
      {error && <div className="alert alert-danger py-2 mb-2">{error}</div>}
      
      <div className="mb-2">
        <label className="form-label">Team name</label>
        <div className="input-group">
          <input
            className="form-control"
            placeholder="Team name"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-primary"
            disabled={savingTeam}
            onClick={handleCreateTeam}
          >
            {savingTeam ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>

      <hr />
      <h6 className="mb-2">Add members by user name</h6>
      <div className="mb-2">
        <label className="form-label">Search users</label>
        <input
          className="form-control"
          placeholder="Type name or email to filter"
          value={userSearch}
          onChange={(e) => setUserSearch(e.target.value)}
        />
      </div>
      <div className="border rounded mb-2" style={{ maxHeight: 220, overflowY: 'auto' }}>
        <table className="table table-sm mb-0">
          <thead>
            <tr>
              <th style={{ width: 40 }}></th>
              <th>Name</th>
              <th>Email</th>
              <th>Admin</th>
            </tr>
          </thead>
          <tbody>
            {(users || [])
              .filter(u => {
                const q = userSearch.trim().toLowerCase();
                if (!q) return true;
                return (
                  (u.name || '').toLowerCase().includes(q) ||
                  (u.email || '').toLowerCase().includes(q)
                );
              })
              .map(u => {
                const checked = selectedUserIds.includes(u.id);
                return (
                  <tr key={u.id}>
                    <td>
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={checked}
                        onChange={(e) => {
                          const isOn = e.target.checked;
                          setSelectedUserIds(prev => {
                            if (isOn) return [...prev, u.id];
                            return prev.filter(id => id !== u.id);
                          });
                        }}
                      />
                    </td>
                    <td>{u.name || '—'}</td>
                    <td>{u.email}</td>
                    <td>{u.is_administrator ? 'Yes' : 'No'}</td>
                  </tr>
                );
              })}
            {(!users || users.length === 0) && (
              <tr><td colSpan={4} className="text-muted">No users</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mb-2">
        <label className="form-label">Team</label>
        <div className="input-group">
          <select
            className="form-select"
            value={selectedTeamId}
            onChange={(e) => setSelectedTeamId(e.target.value)}
          >
            {(teams || []).map(team => (
              <option key={team.id} value={team.id}>{team.name}</option>
            ))}
            {(!teams || teams.length === 0) && <option value="">No teams</option>}
          </select>
          <button
            type="button"
            className="btn btn-outline-primary"
            disabled={savingMembers || !selectedTeamId}
            onClick={handleAddMembers}
          >
            {savingMembers ? 'Adding…' : 'Add members'}
          </button>
        </div>
      </div>
    </div>
  );
}
