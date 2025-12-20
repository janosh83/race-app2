import React, { useEffect, useState } from 'react';
import { adminApi } from '../../services/adminApi';

// Single-page management for registrations, teams, and categories
export default function RegistrationList({ raceId }) {
  const [registrations, setRegistrations] = useState([]);
  const [teams, setTeams] = useState([]);
  const [raceCategories, setRaceCategories] = useState([]);

  const [loading, setLoading] = useState(false);
  const [metaLoading, setMetaLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formError, setFormError] = useState(null);

  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [memberIds, setMemberIds] = useState('');

  const [savingRegistration, setSavingRegistration] = useState(false);
  const [savingTeam, setSavingTeam] = useState(false);
  const [savingMembers, setSavingMembers] = useState(false);

  const loadRegistrations = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await adminApi.getRegistrations(raceId);
      const regs = Array.isArray(payload) ? payload : (payload?.data || payload?.results || payload?.registrations || []);
      setRegistrations(regs || []);
    } catch (err) {
      console.error(err);
      setError('Failed to load registrations');
    } finally {
      setLoading(false);
    }
  };

  const loadMeta = async () => {
    setMetaLoading(true);
    setError(null);
    try {
      const [teamsPayload, catsPayload] = await Promise.all([
        adminApi.getTeams(),
        adminApi.getRaceCategories(raceId),
      ]);
      const t = Array.isArray(teamsPayload) ? teamsPayload : (teamsPayload?.data || []);
      const c = Array.isArray(catsPayload) ? catsPayload : (catsPayload?.data || []);
      setTeams(t || []);
      setRaceCategories(c || []);
      if (!selectedTeamId && (t || []).length > 0) setSelectedTeamId((t[0]?.id ?? '').toString());
      if (!selectedCategoryId && (c || []).length > 0) setSelectedCategoryId((c[0]?.id ?? '').toString());
    } catch (err) {
      console.error('Failed to load teams or categories', err);
      setError('Failed to load teams or categories');
    } finally {
      setMetaLoading(false);
    }
  };

  useEffect(() => {
    if (raceId) {
      loadRegistrations();
      loadMeta();
    } else {
      setRegistrations([]);
      setTeams([]);
      setRaceCategories([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raceId]);

  const handleCreateTeam = async () => {
    setFormError(null);
    const name = newTeamName.trim();
    if (!name) return;
    setSavingTeam(true);
    try {
      const created = await adminApi.createTeam({ name });
      setNewTeamName('');
      await loadMeta();
      if (created?.id) setSelectedTeamId(created.id.toString());
    } catch (err) {
      console.error('Failed to create team', err);
      setFormError('Failed to create team');
    } finally {
      setSavingTeam(false);
    }
  };

  const handleAddMembers = async () => {
    setFormError(null);
    if (!selectedTeamId) {
      setFormError('Select a team first');
      return;
    }
    const ids = memberIds
      .split(',')
      .map(s => parseInt(s.trim(), 10))
      .filter(n => Number.isInteger(n));
    if (ids.length === 0) {
      setFormError('Provide at least one user ID');
      return;
    }
    setSavingMembers(true);
    try {
      await adminApi.addTeamMembers(Number(selectedTeamId), { user_ids: ids });
      setMemberIds('');
    } catch (err) {
      console.error('Failed to add members', err);
      setFormError('Failed to add members');
    } finally {
      setSavingMembers(false);
    }
  };

  const handleRegister = async () => {
    setFormError(null);
    if (!selectedTeamId || !selectedCategoryId) {
      setFormError('Select a team and a category');
      return;
    }
    setSavingRegistration(true);
    try {
      await adminApi.addRegistration(raceId, {
        team_id: Number(selectedTeamId),
        race_category_id: Number(selectedCategoryId),
      });
      await loadRegistrations();
    } catch (err) {
      console.error('Failed to register team', err);
      setFormError('Failed to register team');
    } finally {
      setSavingRegistration(false);
    }
  };

  const refreshAll = () => {
    loadRegistrations();
    loadMeta();
  };

  if (!raceId) return null;

  return (
    <div className="mt-3">
      <div className="d-flex align-items-center mb-2">
        <h4 className="me-3">Registrations & Race Categories</h4>
        <button type="button" className="btn btn-sm btn-outline-secondary ms-auto" onClick={refreshAll}>Refresh</button>
      </div>

      {formError && <div className="alert alert-warning py-2 mb-3">{formError}</div>}
      {error && <div className="alert alert-danger py-2 mb-3">{error}</div>}

      <div className="row g-3 mb-3">
        <div className="col-lg-6">
          <div className="card h-100 p-3">
            <h5 className="mb-3">Create team</h5>
            <div className="mb-2">
              <label className="form-label">Team name</label>
              <input
                className="form-control"
                placeholder="Team name"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={savingTeam}
              onClick={handleCreateTeam}
            >
              {savingTeam ? 'Creating…' : 'Create team'}
            </button>

            <hr />
            <h6 className="mb-2">Add members (user IDs)</h6>
            <div className="mb-2">
              <label className="form-label">User IDs (comma separated)</label>
              <input
                className="form-control"
                placeholder="e.g. 1, 2, 3"
                value={memberIds}
                onChange={(e) => setMemberIds(e.target.value)}
              />
            </div>
            <div className="mb-2">
              <label className="form-label">Team</label>
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
            </div>
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

        <div className="col-lg-6">
          <div className="card h-100 p-3">
            <h5 className="mb-3">Register team to race</h5>
            <div className="mb-2">
              <label className="form-label">Team</label>
              <select
                className="form-select"
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                disabled={metaLoading}
              >
                {(teams || []).map(team => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
                {(!teams || teams.length === 0) && <option value="">No teams</option>}
              </select>
            </div>
            <div className="mb-3">
              <label className="form-label">Race category</label>
              <select
                className="form-select"
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                disabled={metaLoading}
              >
                {(raceCategories || []).map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
                {(!raceCategories || raceCategories.length === 0) && <option value="">No categories</option>}
              </select>
            </div>
            <button
              type="button"
              className="btn btn-success"
              disabled={savingRegistration || !selectedTeamId || !selectedCategoryId}
              onClick={handleRegister}
            >
              {savingRegistration ? 'Registering…' : 'Register team'}
            </button>
            {metaLoading && <div className="mt-2 text-muted small">Loading teams and categories…</div>}
          </div>
        </div>
      </div>

      {loading && <div>Loading registrations…</div>}

      <table className="table table-sm">
        <thead>
          <tr>
            <th>Team</th>
            <th>Category</th>
          </tr>
        </thead>
        <tbody>
          {(!registrations || registrations.length === 0) && (
            <tr><td colSpan="2" className="text-muted">No registrations</td></tr>
          )}
          {registrations.map((reg, idx) => {
            const teamName = reg.name || reg.team?.name || `#${reg.id ?? reg.team_id ?? idx}`;
            const categoryName = reg.race_category || reg.category || reg.category_name || '';
            return (
              <tr key={reg.id ?? reg.team_id ?? idx}>
                <td>{teamName}</td>
                <td>{categoryName}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}