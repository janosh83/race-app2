import React, { useEffect, useState } from 'react';
import { adminApi } from '../../services/adminApi';

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
  const [newTeamName, setNewTeamName] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState([]);

  const [savingRegistration, setSavingRegistration] = useState(false);
  const [savingTeam, setSavingTeam] = useState(false);
  const [savingMembers, setSavingMembers] = useState(false);
  // import state
  const [importRows, setImportRows] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importReport, setImportReport] = useState(null);

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
    const ids = selectedUserIds.filter(n => Number.isInteger(n));
    if (ids.length === 0) {
      setFormError('Select at least one user');
      return;
    }
    setSavingMembers(true);
    try {
      await adminApi.addTeamMembers(Number(selectedTeamId), { user_ids: ids });
      setSelectedUserIds([]);
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

  const handleDeleteRegistration = async (teamId) => {
    if (!window.confirm('Are you sure you want to delete this registration?')) {
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

  // helpers for import
  const slugify = (s) => {
    if (!s) return '';
    return s
      .toString()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const parseDelimited = (text) => {
    const hasTabs = text.includes('\t');
    const delim = hasTabs ? '\t' : ',';
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length === 0) return [];
    const headers = lines[0].split(delim).map(h => h.trim());
    const idxOf = (names) => headers.findIndex(h => names.includes(h));
    const idxEmail = idxOf(['E-mailová adresa', 'E-mail', 'Email', 'email']);
    const idxName = idxOf(['Tvoje jméno', 'Jméno', 'Name', 'name']);
    const idxTeam = idxOf(['Jméno posádky', 'Team', 'Tým', 'team', 'posádka']);
    const idxCat = idxOf(['kategorie', 'Kategorie', 'category', 'race_category']);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(delim);
      const email = (parts[idxEmail] || '').trim();
      const name = (parts[idxName] || '').trim();
      const team = (parts[idxTeam] || '').trim();
      const category = (parts[idxCat] || '').trim();
      if (!email || !team) continue;
      rows.push({ email, name, team, category });
    }
    return rows;
  };

  const handleImportFile = async (file) => {
    setImportReport(null);
    if (!file) { setImportRows([]); return; }
    const text = await file.text();
    const rows = parseDelimited(text);
    setImportRows(rows);
  };

  const runImport = async () => {
    if (!raceId) return;
    if (importRows.length === 0) {
      setFormError('No rows to import');
      return;
    }
    setImporting(true);
    setFormError(null);
    const report = {
      createdUsers: [],
      existingUsers: [],
      createdTeams: [],
      existingTeams: [],
      createdRegistrations: [],
      addedMembers: [],
      missingCategories: [],
      errors: [],
    };

    // Build maps for quick lookups
    const usersByEmail = new Map((users || []).map(u => [String(u.email).toLowerCase(), u]));
    const teamByName = new Map((teams || []).map(t => [String(t.name).toLowerCase(), t]));
    const regByTeamId = new Map();
    (registrations || []).forEach(r => {
      const id = r.team_id || r.id; // API shape varies
      if (id) regByTeamId.set(id, r);
    });
    const catBySlug = new Map((raceCategories || []).map(c => [slugify(c.name), c]));
    const catByNameLower = new Map((raceCategories || []).map(c => [String(c.name).toLowerCase(), c]));

    // Group rows by team name
    const grouped = new Map();
    for (const row of importRows) {
      const key = row.team.toLowerCase();
      if (!grouped.has(key)) grouped.set(key, { team: row.team, category: row.category, members: [] });
      grouped.get(key).members.push({ email: row.email, name: row.name });
      // If multiple categories appear for one team, keep the first and note mismatch
      const g = grouped.get(key);
      if (!g.category && row.category) g.category = row.category;
      if (g.category && row.category && g.category !== row.category) {
        report.errors.push(`Team ${row.team} has multiple categories: '${g.category}' vs '${row.category}' (using first)`);
      }
    }

    try {
      for (const [, g] of grouped) {
        // ensure team
        let team = teamByName.get(g.team.toLowerCase());
        if (!team) {
          try {
            const created = await adminApi.createTeam({ name: g.team });
            team = created;
            teamByName.set(g.team.toLowerCase(), created);
            report.createdTeams.push(g.team);
          } catch (e) {
            report.errors.push(`Failed to create team '${g.team}': ${e?.message || e}`);
            continue;
          }
        } else {
          report.existingTeams.push(g.team);
        }

        // ensure registration (category)
        let cat = null;
        if (g.category) {
          cat = catBySlug.get(slugify(g.category)) || catByNameLower.get(g.category.toLowerCase()) || null;
          if (!cat) {
            report.missingCategories.push({ team: g.team, category: g.category });
          }
        }
        const teamId = team.id;
        const alreadyReg = regByTeamId.has(teamId);
        if (!alreadyReg && cat) {
          try {
            await adminApi.addRegistration(raceId, { team_id: teamId, race_category_id: cat.id });
            report.createdRegistrations.push({ team: g.team, category: cat.name });
            // update map
            regByTeamId.set(teamId, { team_id: teamId, category: cat.name });
          } catch (e) {
            report.errors.push(`Failed to register team '${g.team}' to category '${cat?.name || g.category}': ${e?.message || e}`);
          }
        }

        // ensure users and add to team
        const memberIds = [];
        for (const m of g.members) {
          const emailKey = String(m.email).toLowerCase();
          let u = usersByEmail.get(emailKey);
          if (!u) {
            // create user with random password
            const tempPwd = Math.random().toString(36).slice(-8) + 'A!9';
            try {
              const createdU = await adminApi.createUser({ name: m.name || '', email: m.email, password: tempPwd, is_administrator: false });
              u = createdU;
              usersByEmail.set(emailKey, createdU);
              report.createdUsers.push(m.email);
            } catch (e) {
              report.errors.push(`Failed to create user '${m.email}': ${e?.message || e}`);
              continue;
            }
          } else {
            report.existingUsers.push(m.email);
          }
          if (u?.id) memberIds.push(u.id);
        }
        const uniqueIds = Array.from(new Set(memberIds));
        if (uniqueIds.length > 0) {
          try {
            await adminApi.addTeamMembers(teamId, { user_ids: uniqueIds });
            report.addedMembers.push({ team: g.team, count: uniqueIds.length });
          } catch (e) {
            report.errors.push(`Failed adding members to team '${g.team}': ${e?.message || e}`);
          }
        }
      }
      // refresh lists
      await Promise.all([loadRegistrations(), loadMeta()]);
    } finally {
      setImportReport(report);
      setImporting(false);
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
          <div className="card h-100 p-3">
            <h5 className="mb-3">Create team</h5>
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

            <hr />
            <h6 className="mb-2">Import teams & members (CSV/TSV)</h6>
            <div className="mb-2">
              <div className="input-group">
                <input
                  type="file"
                  accept=".csv,.tsv,text/csv,text/tab-separated-values"
                  className="form-control"
                  onChange={(e) => handleImportFile(e.target.files?.[0])}
                />
                <button
                  type="button"
                  className="btn btn-success"
                  disabled={importing || importRows.length === 0}
                  onClick={runImport}
                >
                  {importing ? 'Importing…' : 'Import' }
                </button>
              </div>
            </div>
            {importReport && (
              <div className="mt-3">
                <h6>Import report</h6>
                <ul className="small">
                  <li><strong>Teams created:</strong> {importReport.createdTeams.length}</li>
                  <li><strong>Registrations created:</strong> {importReport.createdRegistrations.length}</li>
                  <li><strong>Users created:</strong> {importReport.createdUsers.length}</li>
                  <li><strong>Existing users matched:</strong> {importReport.existingUsers.length}</li>
                  <li><strong>Members added:</strong> {importReport.addedMembers.reduce((a,b)=>a+b.count,0)}</li>
                  {importReport.missingCategories.length > 0 && (
                    <li className="text-warning"><strong>Missing categories:</strong> {importReport.missingCategories.map(m => `${m.team} (${m.category})`).join('; ')}</li>
                  )}
                  {importReport.errors.length > 0 && (
                    <li className="text-danger"><strong>Errors:</strong> {importReport.errors.join(' | ')}</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>

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

      {loading && <div>Loading registrations…</div>}

      <h5 className="mt-4 mb-3">Current Registrations</h5>

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
    </div>
  );
}