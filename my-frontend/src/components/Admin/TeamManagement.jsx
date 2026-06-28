import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { adminApi } from '../../services/adminApi';
import { logger } from '../../utils/logger';

import TeamCreation from './TeamCreation';

const TEAMS_PAGE_SIZE = 20;

export default function TeamManagement() {
  const { t } = useTranslation();
  const [teams, setTeams] = useState([]);
  const [allTeams, setAllTeams] = useState([]);
  const [teamsPage, setTeamsPage] = useState(1);
  const [users, setUsers] = useState([]);
  const [totalTeams, setTotalTeams] = useState(0);
  const [teamMembers, setTeamMembers] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = async (pageToLoad) => {
    setLoading(true);
    setError(null);
    try {
      const [pagedTeamsPayload, allTeamsPayload, usersPayload] = await Promise.all([
        adminApi.getTeams({ page: pageToLoad, per_page: TEAMS_PAGE_SIZE }),
        adminApi.getTeams(),
        adminApi.getUsers(),
      ]);

      const teamsList = Array.isArray(pagedTeamsPayload) ? pagedTeamsPayload : (pagedTeamsPayload?.data || []);
      const total = Array.isArray(pagedTeamsPayload) ? teamsList.length : Number(pagedTeamsPayload?.meta?.total || 0);
      const allTeamsList = Array.isArray(allTeamsPayload) ? allTeamsPayload : (allTeamsPayload?.data || []);
      const usersList = Array.isArray(usersPayload) ? usersPayload : (usersPayload?.data || []);
      setTeams(teamsList);
      setTotalTeams(total);
      setAllTeams(allTeamsList);
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
  }, [teamsPage]);

  const teamsTotalPages = Math.max(1, Math.ceil(totalTeams / TEAMS_PAGE_SIZE));
  const teamsPageStartIndex = totalTeams === 0 ? 0 : ((teamsPage - 1) * TEAMS_PAGE_SIZE) + 1;
  const teamsPageEndIndex = Math.min((teamsPage - 1) * TEAMS_PAGE_SIZE + teams.length, totalTeams);

  useEffect(() => {
    if (teamsPage > teamsTotalPages) {
      setTeamsPage(teamsTotalPages);
    }
  }, [teamsPage, teamsTotalPages]);

  return (
    <div className="mt-3">
      <div className="d-flex align-items-center mb-2">
        <h4 className="me-3">{t('admin.teamCreation.title')}</h4>
        <button className="btn btn-sm btn-outline-secondary ms-auto" onClick={() => load(teamsPage)}>{t('admin.teamCreation.refresh')}</button>
      </div>

      {error && <div className="alert alert-danger py-2 mb-3">{error}</div>}
      {loading && <div className="mb-3">{t('admin.teamCreation.loadingTeams')}</div>}

      <div className="mb-3">
        <TeamCreation
          teams={allTeams}
          users={users}
          onTeamCreated={() => load(teamsPage)}
          onMembersAdded={() => load(teamsPage)}
        />
      </div>

      <div className="border rounded p-3">
        <h5 className="mb-3">{t('admin.teamCreation.allTeams')}</h5>
        <table className="table table-sm">
          <thead>
            <tr>
              <th style={{ width: 80 }}>#</th>
              <th>{t('admin.teamCreation.teamName')}</th>
              <th>{t('admin.teamCreation.tableMembers')}</th>
              <th style={{ width: 120 }}>{t('admin.teamCreation.tableMemberCount')}</th>
            </tr>
          </thead>
          <tbody>
            {teams.length === 0 && (
              <tr>
                <td colSpan="4" className="text-muted">{t('admin.registrations.noTeams')}</td>
              </tr>
            )}
            {teams.map((team) => {
              const members = teamMembers[team.id] || [];
              const membersDisplay = members.length > 0
                ? members.map((member) => member.name || `#${member.id}`).join(', ')
                : '—';
              return (
                <tr key={team.id}>
                  <td>{team.id}</td>
                  <td>{team.name}</td>
                  <td className="text-muted small">{membersDisplay}</td>
                  <td>{members.length}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {totalTeams > 0 && (
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
      </div>
    </div>
  );
}
