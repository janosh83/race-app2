import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { adminApi } from '../../services/adminApi';
import { formatDateRange } from '../../utils/dateRange';
import { logger } from '../../utils/logger';

const TEAMS_PAGE_SIZE = 20;

const memberLabel = (member) => member.name || member.email || `#${member.id}`;

// The races a team is registered for, each linking to that race's
// Registrations tab.
function TeamRaces({ teamId }) {
  const { t } = useTranslation();
  const [registrations, setRegistrations] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    adminApi.getTeamRegistrations(teamId)
      .then(data => { if (!cancelled) setRegistrations(Array.isArray(data) ? data : []); })
      .catch(err => {
        logger.error('ADMIN', 'Failed to load team registrations', err);
        if (!cancelled) setFailed(true);
      });
    return () => { cancelled = true; };
  }, [teamId]);

  return (
    <div className="mb-3">
      <div className="form-label">
        {t('admin.teams.races')}
        {registrations && <span className="text-muted"> ({registrations.length})</span>}
      </div>
      {failed && <div className="small text-danger">{t('admin.teams.racesFailed')}</div>}
      {!failed && !registrations && <div className="small text-muted">{t('admin.teams.racesLoading')}</div>}
      {registrations?.length === 0 && <div className="small text-muted">{t('admin.teams.noRaces')}</div>}
      {registrations?.length > 0 && (
        <ul className="list-group">
          {registrations.map(reg => (
            <li key={reg.race_id} className="list-group-item d-flex flex-wrap align-items-center gap-2">
              <Link to={`/admin?race=${reg.race_id}&section=registrations`} className="fw-semibold">
                {reg.race_name}
              </Link>
              <span className="small text-muted">
                {[reg.race_category, formatDateRange(reg.start_logging_at, reg.end_logging_at)].filter(Boolean).join(' · ')}
              </span>
              <span className="ms-auto d-flex gap-1">
                <span className={`badge ${reg.payment_confirmed ? 'bg-success-subtle text-success-emphasis' : 'bg-warning-subtle text-warning-emphasis'}`}>
                  {reg.payment_confirmed ? t('admin.registrations.paymentPaid') : t('admin.registrations.paymentUnpaid')}
                </span>
                {reg.disqualified && <span className="badge bg-danger">{t('admin.registrations.disqualified')}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Create a team or edit one: its name and members. Members are picked from
// all users (searchable); the chosen ones show on top and can be removed.
// `onSave({ name, userIds })` and `onDelete()` return promises; the dialog
// stays open if they reject, showing the error's `message`. Delete asks to
// confirm inside the dialog.
function TeamDialog({ team, members, users, onSave, onDelete, onCancel }) {
  const { t } = useTranslation();
  const isNew = !team;
  const [name, setName] = useState(team?.name || '');
  const [memberIds, setMemberIds] = useState(members.map(member => member.id));
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [dialogError, setDialogError] = useState(null);

  const usersById = new Map(users.map(user => [user.id, user]));
  members.forEach(member => { if (!usersById.has(member.id)) usersById.set(member.id, member); });
  const term = search.trim().toLowerCase();
  const matchingUsers = users.filter(user => (
    !term || (user.name || '').toLowerCase().includes(term) || (user.email || '').toLowerCase().includes(term)
  ));

  const toggle = (userId) => setMemberIds(prev => (
    prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
  ));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setDialogError(null);
    try {
      await onSave({ name: name.trim(), userIds: memberIds });
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
    <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} role="dialog" aria-modal="true" aria-labelledby="team-dialog-title">
      <div className="modal-dialog modal-lg modal-fullscreen-sm-down modal-dialog-scrollable">
        <form className="modal-content" onSubmit={handleSubmit}>
          <div className="modal-header">
            <h5 className="modal-title" id="team-dialog-title">
              {isNew ? t('admin.teams.newTitle') : t('admin.teams.editTitle')}
            </h5>
            <button type="button" className="btn-close" aria-label={t('admin.close')} onClick={onCancel}></button>
          </div>
          <div className="modal-body">
            {dialogError && <div className="alert alert-danger py-2" role="alert">{dialogError}</div>}
            <div className="mb-3">
              <label className="form-label" htmlFor="team-name">{t('admin.teamCreation.teamName')}</label>
              <input
                id="team-name"
                type="text"
                className="form-control"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                autoFocus={isNew}
              />
            </div>

            <div className="mb-2">
              <div className="form-label">
                {t('admin.teamCreation.tableMembers')} <span className="text-muted">({memberIds.length})</span>
              </div>
              {memberIds.length === 0 ? (
                <div className="small text-muted">{t('admin.teams.noMembers')}</div>
              ) : (
                <div className="d-flex flex-wrap gap-1">
                  {memberIds.map(id => {
                    const user = usersById.get(id) || { id };
                    return (
                      <span key={id} className="badge rounded-pill text-bg-light border d-inline-flex align-items-center gap-1 fw-normal fs-6">
                        {memberLabel(user)}
                        <button
                          type="button"
                          className="btn-close admin-chip-close"
                          aria-label={t('admin.teams.removeMember', { name: memberLabel(user) })}
                          onClick={() => toggle(id)}
                        />
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            {!isNew && <TeamRaces teamId={team.id} />}

            <label className="form-label mt-2" htmlFor="team-user-search">{t('admin.teams.addMembers')}</label>
            <input
              id="team-user-search"
              type="search"
              className="form-control mb-2"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('admin.teamCreation.searchPlaceholder')}
            />
            <div className="list-group admin-team-user-list">
              {matchingUsers.length === 0 && (
                <div className="list-group-item text-muted small">{t('admin.teamCreation.noUsers')}</div>
              )}
              {matchingUsers.map(user => (
                <label key={user.id} className="list-group-item list-group-item-action d-flex align-items-center gap-2">
                  <input
                    type="checkbox"
                    className="form-check-input mt-0 flex-shrink-0"
                    checked={memberIds.includes(user.id)}
                    onChange={() => toggle(user.id)}
                  />
                  <span className="text-truncate">{user.name || '—'}</span>
                  <span className="text-muted small text-truncate ms-auto">{user.email}</span>
                </label>
              ))}
            </div>
          </div>
          {confirmingDelete ? (
            <div className="modal-footer justify-content-between bg-danger-subtle">
              <span className="small text-danger-emphasis">
                {t('admin.teams.deleteConfirm', { name: team.name })}
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
              {!isNew && (
                <button type="button" className="btn btn-outline-danger me-auto" onClick={() => setConfirmingDelete(true)}>
                  {t('admin.teams.delete')}
                </button>
              )}
              <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>{t('admin.users.cancel')}</button>
              <button type="submit" className="btn btn-primary" disabled={saving || !name.trim()}>
                {saving
                  ? t('admin.users.saving')
                  : (isNew ? t('admin.teamCreation.create') : t('admin.users.saveChanges'))}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

// All teams, list first: search, pages of 20, a row opens the team dialog
// (edit or delete); "+ New team" opens it empty.
export default function TeamManagement() {
  const { t } = useTranslation();
  const [teams, setTeams] = useState([]);
  const [teamsPage, setTeamsPage] = useState(1);
  const [teamSearch, setTeamSearch] = useState('');
  const [users, setUsers] = useState([]);
  const [totalTeams, setTotalTeams] = useState(0);
  const [teamMembers, setTeamMembers] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dialogTeam, setDialogTeam] = useState(null); // null | 'new' | team

  const load = async (pageToLoad) => {
    setLoading(true);
    setError(null);
    try {
      const [pagedTeamsPayload, usersPayload] = await Promise.all([
        adminApi.getTeams({
          page: pageToLoad,
          per_page: TEAMS_PAGE_SIZE,
          search: teamSearch.trim() || undefined,
        }),
        adminApi.getUsers(),
      ]);

      const teamsList = Array.isArray(pagedTeamsPayload) ? pagedTeamsPayload : (pagedTeamsPayload?.data || []);
      const total = Array.isArray(pagedTeamsPayload) ? teamsList.length : Number(pagedTeamsPayload?.meta?.total || 0);
      const usersList = Array.isArray(usersPayload) ? usersPayload : (usersPayload?.data || []);
      setTeams(teamsList);
      setTotalTeams(total);
      setUsers(usersList);

      const memberPairs = await Promise.all(
        teamsList.map(async (team) => {
          try {
            const membersPayload = await adminApi.getTeamMembers(team.id);
            const members = Array.isArray(membersPayload) ? membersPayload : (membersPayload?.data || []);
            return [team.id, members];
          } catch (err) {
            logger.error('ADMIN', `Failed to load members for team ${team.id}`, err);
            return [team.id, []];
          }
        })
      );

      setTeamMembers(Object.fromEntries(memberPairs));
    } catch (err) {
      logger.error('ADMIN', 'Failed to load teams', err);
      setError(t('admin.teamCreation.errorLoadTeams'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(teamsPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamsPage, teamSearch]);

  useEffect(() => {
    setTeamsPage(1);
  }, [teamSearch]);

  const teamsTotalPages = Math.max(1, Math.ceil(totalTeams / TEAMS_PAGE_SIZE));
  const teamsPageStartIndex = totalTeams === 0 ? 0 : ((teamsPage - 1) * TEAMS_PAGE_SIZE) + 1;
  const teamsPageEndIndex = Math.min((teamsPage - 1) * TEAMS_PAGE_SIZE + teams.length, totalTeams);

  useEffect(() => {
    if (teamsPage > teamsTotalPages) {
      setTeamsPage(teamsTotalPages);
    }
  }, [teamsPage, teamsTotalPages]);

  const handleSave = async ({ name, userIds }) => {
    setError(null);
    try {
      if (dialogTeam === 'new') {
        const created = await adminApi.createTeam({ name });
        if (created?.id && userIds.length > 0) {
          await adminApi.updateTeam(created.id, { user_ids: userIds });
        }
      } else {
        await adminApi.updateTeam(dialogTeam.id, { name, user_ids: userIds });
      }
      setDialogTeam(null);
      await load(teamsPage);
    } catch (err) {
      logger.error('ADMIN', 'Failed to save team', err);
      throw new Error(dialogTeam === 'new'
        ? t('admin.teamCreation.errorCreate')
        : t('admin.users.updateFailed', { message: err?.message || t('admin.common.unknownError') }));
    }
  };

  const handleDelete = async () => {
    try {
      await adminApi.deleteTeam(dialogTeam.id);
    } catch (err) {
      logger.error('ADMIN', 'Failed to delete team', err);
      const code = err?.payload?.code;
      if (code === 'team_has_registrations') throw new Error(t('admin.teams.deleteBlockedRegistrations'));
      if (code === 'team_has_visits') throw new Error(t('admin.teams.deleteBlockedVisits'));
      throw new Error(t('admin.teams.deleteFailed', { message: err?.message || t('admin.common.unknownError') }));
    }
    setDialogTeam(null);
    await load(teamsPage);
  };

  return (
    <div className="mt-3">
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <h2 className="h4 mb-0 me-auto">
          {t('admin.teams.title')} <span className="text-muted fw-normal">({totalTeams})</span>
        </h2>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setDialogTeam('new')}>
          {t('admin.teams.newTeam')}
        </button>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={() => load(teamsPage)}
          title={t('admin.teamCreation.refresh')}
          aria-label={t('admin.teamCreation.refresh')}
        >
          ↻
        </button>
      </div>

      {error && <div className="alert alert-danger py-2 mb-3">{error}</div>}

      <input
        type="search"
        className="form-control mb-3 admin-list-search"
        placeholder={t('admin.teamCreation.searchTeamsPlaceholder')}
        aria-label={t('admin.teamCreation.searchTeams')}
        value={teamSearch}
        onChange={(e) => setTeamSearch(e.target.value)}
      />

      {loading && teams.length === 0 && <div className="text-muted mb-3">{t('admin.teamCreation.loadingTeams')}</div>}

      <table className="table table-hover align-middle admin-teams-table">
        <thead>
          <tr>
            <th>{t('admin.teamCreation.teamName')}</th>
            <th>{t('admin.teamCreation.tableMembers')}</th>
          </tr>
        </thead>
        <tbody>
          {!loading && teams.length === 0 && (
            <tr>
              <td colSpan="2" className="text-muted">{t('admin.registrations.noTeams')}</td>
            </tr>
          )}
          {teams.map((team) => {
            const members = teamMembers[team.id] || [];
            return (
              // The whole row opens the team; the name is the keyboard control.
              <tr key={team.id} className="admin-race-row" onClick={() => setDialogTeam(team)}>
                <td>
                  <button
                    type="button"
                    className="btn btn-link p-0 fw-semibold text-start text-decoration-none"
                    onClick={(e) => { e.stopPropagation(); setDialogTeam(team); }}
                  >
                    {team.name}
                  </button>
                </td>
                <td className="small">
                  <span className="badge rounded-pill text-bg-light border me-2">{members.length}</span>
                  <span className="text-muted">
                    {members.length > 0 ? members.map(memberLabel).join(', ') : t('admin.teams.noMembers')}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {totalTeams > TEAMS_PAGE_SIZE && (
        <div className="d-flex align-items-center justify-content-between mt-2">
          <small className="text-muted">
            {t('admin.common.paginationShowing', {
              from: teamsPageStartIndex,
              to: teamsPageEndIndex,
              total: totalTeams,
            })}
          </small>
          <div className="btn-group" role="group" aria-label={t('admin.common.paginationAria')}>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              disabled={teamsPage <= 1}
              onClick={() => setTeamsPage((prev) => Math.max(1, prev - 1))}
            >
              {t('admin.common.paginationPrev')}
            </button>
            <span className="btn btn-sm btn-light disabled">
              {teamsPage} / {teamsTotalPages}
            </span>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              disabled={teamsPage >= teamsTotalPages}
              onClick={() => setTeamsPage((prev) => Math.min(teamsTotalPages, prev + 1))}
            >
              {t('admin.common.paginationNext')}
            </button>
          </div>
        </div>
      )}

      {dialogTeam !== null && (
        <TeamDialog
          team={dialogTeam === 'new' ? null : dialogTeam}
          members={dialogTeam === 'new' ? [] : (teamMembers[dialogTeam.id] || [])}
          users={users}
          onSave={handleSave}
          onDelete={handleDelete}
          onCancel={() => setDialogTeam(null)}
        />
      )}
    </div>
  );
}
