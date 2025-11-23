import React, { useEffect, useState } from 'react';
import { adminApi } from '../../services/adminApi';

export default function RegistrationList({ race }) {
  const [registrations, setRegistrations] = useState([]);
  const [teams, setTeams] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    if (!race || (!race.id && !race.race_id)) return;
    setLoading(true);
    setError(null);
    const raceId = race.id ?? race.race_id;
    try {
      // use adminApi for registrations, teams and categories
      const [regs, teamsData, cats] = await Promise.allSettled([
        adminApi.getRegistrations(raceId),
        adminApi.listTeams(),
        adminApi.listCategories(),
      ]);

      setRegistrations(regs.status === 'fulfilled' ? regs.value || [] : []);
      setTeams(teamsData.status === 'fulfilled' ? teamsData.value || [] : []);
      setCategories(cats.status === 'fulfilled' ? cats.value || [] : []);
    } catch (err) {
      setError('Failed to load registrations');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [race]);

  const refresh = () => load();

  const handleUpdateCategory = async (teamId, newCategoryId) => {
    const raceId = race.id ?? race.race_id;
    try {
      await adminApi.updateRegistration(raceId, {
        action: 'update',
        team_id: teamId,
        race_category_id: newCategoryId,
      });
      await refresh();
    } catch (err) {
      alert('Update failed');
      console.error(err);
    }
  };

  const handleDelete = async (teamId) => {
    if (!window.confirm('Remove registration for this team?')) return;
    const raceId = race.id ?? race.race_id;
    try {
      await adminApi.updateRegistration(raceId, {
        action: 'delete',
        team_id: teamId,
      });
      await refresh();
    } catch (err) {
      alert('Delete failed');
      console.error(err);
    }
  };

  const [newTeamId, setNewTeamId] = useState('');
  const [newCategoryId, setNewCategoryId] = useState('');

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newTeamId || !newCategoryId) return alert('Select team and category');
    const raceId = race.id ?? race.race_id;
    try {
      await adminApi.updateRegistration(raceId, {
        action: 'add',
        team_id: newTeamId,
        race_category_id: newCategoryId,
      });
      setNewTeamId('');
      setNewCategoryId('');
      await refresh();
    } catch (err) {
      alert('Add failed');
      console.error(err);
    }
  };

  if (!race) return null;

  return (
    <div className="mt-3">
      <h4>Registrations for {race.name || race.title || `#${race.id ?? race.race_id}`}</h4>

      {loading && <div>Loading…</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card mb-3">
        <div className="card-body">
          <form onSubmit={handleAdd} className="row g-2 align-items-center">
            <div className="col-auto">
              <select className="form-select" value={newTeamId} onChange={e => setNewTeamId(e.target.value)}>
                <option value="">Select team...</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="col-auto">
              <select className="form-select" value={newCategoryId} onChange={e => setNewCategoryId(e.target.value)}>
                <option value="">Select category...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="col-auto">
              <button className="btn btn-success" type="submit">Add registration</button>
            </div>
            <div className="col-auto ms-auto">
              <button type="button" className="btn btn-outline-secondary" onClick={refresh}>Refresh</button>
            </div>
          </form>
        </div>
      </div>

      <table className="table table-sm">
        <thead>
          <tr>
            <th>Team</th>
            <th>Category</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {registrations.length === 0 && (
            <tr><td colSpan="3" className="text-muted">No registrations</td></tr>
          )}
          {registrations.map(reg => {
            const team = reg.team || teams.find(t => t.id === reg.team_id) || { id: reg.team_id, name: `#${reg.team_id}` };
            const currentCatId = reg.race_category ?? reg.race_category_id;
            return (
              <tr key={team.id}>
                <td>{team.name}</td>
                <td>
                  <select
                    className="form-select form-select-sm"
                    defaultValue={currentCatId || ''}
                    onChange={e => handleUpdateCategory(team.id, e.target.value)}
                  >
                    <option value="">Select category</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </td>
                <td>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(team.id)}>Remove</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}