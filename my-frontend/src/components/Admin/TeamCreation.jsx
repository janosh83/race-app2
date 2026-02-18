import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../../services/adminApi';
import { logger } from '../../utils/logger';

export default function TeamCreation({ teams, users, onTeamCreated, onMembersAdded }) {
  const { t } = useTranslation();
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
      logger.error('ADMIN', 'Failed to create team', err);
      setError(t('admin.teamCreation.errorCreate'));
    } finally {
      setSavingTeam(false);
    }
  };

  const handleAddMembers = async () => {
    setError(null);
    if (!selectedTeamId) {
      setError(t('admin.teamCreation.errorSelectTeam'));
      return;
    }
    const ids = selectedUserIds.filter(n => Number.isInteger(n));
    if (ids.length === 0) {
      setError(t('admin.teamCreation.errorSelectUsers'));
      return;
    }
    setSavingMembers(true);
    try {
      await adminApi.addTeamMembers(Number(selectedTeamId), { user_ids: ids });
      setSelectedUserIds([]);
      if (onMembersAdded) onMembersAdded();
    } catch (err) {
      logger.error('ADMIN', 'Failed to add members', err);
      setError(t('admin.teamCreation.errorAddMembers'));
    } finally {
      setSavingMembers(false);
    }
  };

  return (
    <div className="card h-100 p-3">
      <h5 className="mb-3">{t('admin.teamCreation.title')}</h5>
      
      {error && <div className="alert alert-danger py-2 mb-2">{error}</div>}
      
      <div className="mb-2">
        <label className="form-label">{t('admin.teamCreation.teamName')}</label>
        <div className="input-group">
          <input
            className="form-control"
            placeholder={t('admin.teamCreation.teamName')}
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-primary"
            disabled={savingTeam}
            onClick={handleCreateTeam}
          >
            {savingTeam ? t('admin.teamCreation.creating') : t('admin.teamCreation.create')}
          </button>
        </div>
      </div>

      <hr />
      <h6 className="mb-2">{t('admin.teamCreation.addMembersTitle')}</h6>
      <div className="mb-2">
        <label className="form-label">{t('admin.teamCreation.searchUsers')}</label>
        <input
          className="form-control"
          placeholder={t('admin.teamCreation.searchPlaceholder')}
          value={userSearch}
          onChange={(e) => setUserSearch(e.target.value)}
        />
      </div>
      <div className="border rounded mb-2" style={{ maxHeight: 220, overflowY: 'auto' }}>
        <table className="table table-sm mb-0">
          <thead>
            <tr>
              <th style={{ width: 40 }}></th>
              <th>{t('admin.teamCreation.tableName')}</th>
              <th>{t('admin.teamCreation.tableEmail')}</th>
              <th>{t('admin.teamCreation.tableAdmin')}</th>
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
                    <td>{u.is_administrator ? t('admin.teamCreation.adminYes') : t('admin.teamCreation.adminNo')}</td>
                  </tr>
                );
              })}
            {(!users || users.length === 0) && (
              <tr><td colSpan={4} className="text-muted">{t('admin.teamCreation.noUsers')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mb-2">
        <label className="form-label">{t('admin.teamCreation.teamLabel')}</label>
        <div className="input-group">
          <select
            className="form-select"
            value={selectedTeamId}
            onChange={(e) => setSelectedTeamId(e.target.value)}
          >
            {(teams || []).map(team => (
              <option key={team.id} value={team.id}>{team.name}</option>
            ))}
            {(!teams || teams.length === 0) && <option value="">{t('admin.registrations.noTeams')}</option>}
          </select>
          <button
            type="button"
            className="btn btn-outline-primary"
            disabled={savingMembers || !selectedTeamId}
            onClick={handleAddMembers}
          >
            {savingMembers ? t('admin.teamCreation.adding') : t('admin.teamCreation.addMembers')}
          </button>
        </div>
      </div>
    </div>
  );
}
