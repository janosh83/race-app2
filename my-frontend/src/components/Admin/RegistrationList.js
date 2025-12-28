import React, { useEffect, useState } from 'react';
import { adminApi } from '../../services/adminApi';
import TeamCreation from './TeamCreation';
import RegistrationImporter from './RegistrationImporter';

// Single-page management for registrations, teams, and categories
export default function RegistrationList({ raceId }) {
  const [registrations, setRegistrations] = useState([]);
  const [teams, setTeams] = useState([]);
  const [raceCategories, setRaceCategories] = useState([]);
  const [users, setUsers] = useState([]);

  const [loading, setLoading] = useState(false);
  const [metaLoading, setMetaLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formError, setFormError] = useState(null);

  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [savingRegistration, setSavingRegistration] = useState(false);

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
      const [teamsPayload, catsPayload, usersPayload] = await Promise.all([
        adminApi.getTeams(),
        adminApi.getRaceCategories(raceId),
        adminApi.getUsers(),
      ]);
      const t = Array.isArray(teamsPayload) ? teamsPayload : (teamsPayload?.data || []);
      const c = Array.isArray(catsPayload) ? catsPayload : (catsPayload?.data || []);
      const u = Array.isArray(usersPayload) ? usersPayload : (usersPayload?.data || []);
      setTeams(t || []);
      setRaceCategories(c || []);
      setUsers(u || []);
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

  const handleDeleteRegistration = async (teamId) => {    if (!window.confirm('Are you sure you want to delete this registration?')) {
      return;
    }
    try {
      await adminApi.deleteRegistration(raceId, teamId);
      await loadRegistrations();
    } catch (err) {
      console.error('Failed to delete registration', err);
      setError('Failed to delete registration');
    }
  };

  const handleRegister = async () => {    setFormError(null);
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
        <div className="col-12">
          <TeamCreation
            teams={teams}
            users={users}
            onTeamCreated={async (created) => {
              await loadMeta();
              if (created?.id) setSelectedTeamId(created.id.toString());
            }}
            onMembersAdded={loadMeta}
          />
        </div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-12">
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

        <div className="border rounded p-3 mb-3">
        {loading && <div className="mb-3">Loading registrations…</div>}

        <h5 className="mb-3">Current Registrations</h5>

        <table className="table table-sm">
          <thead>
            <tr>
              <th>Team</th>
              <th>Category</th>
              <th>Members</th>
              <th style={{ width: 100 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(!registrations || registrations.length === 0) && (
              <tr><td colSpan="4" className="text-muted">No registrations</td></tr>
            )}
            {registrations.map((reg, idx) => {
              const teamName = reg.name || reg.team?.name || `#${reg.id ?? reg.team_id ?? idx}`;
              const teamId = reg.team_id || reg.id;
              const categoryName = reg.race_category || reg.category || reg.category_name || '';
              const members = Array.isArray(reg.members) ? reg.members : (reg.team?.members || []);
              const membersDisplay = (members || []).length > 0
                ? members.map(m => m.name || m.email || `#${m.id}`).join(', ')
                : '—';
              return (
                <tr key={reg.id ?? reg.team_id ?? idx}>
                  <td>{teamName}</td>
                  <td>{categoryName}</td>
                  <td className="text-muted small">{membersDisplay}</td>
                  <td>
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => handleDeleteRegistration(teamId)}
                      title="Delete registration"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <hr className="my-4" />
        
        <RegistrationImporter
          raceId={raceId}
          teams={teams}
          users={users}
          registrations={registrations}
          raceCategories={raceCategories}
          onImportComplete={() => {
            loadRegistrations();
            loadMeta();
          }}
        />
      </div>
    </div>
  );
}