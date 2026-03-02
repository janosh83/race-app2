import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { adminApi } from '../../services/adminApi';
import { logger } from '../../utils/logger';

import TeamCreation from './TeamCreation';

export default function TeamManagement() {
  const { t } = useTranslation();
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [teamMembers, setTeamMembers] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [teamsPayload, usersPayload] = await Promise.all([
        adminApi.getTeams(),
        adminApi.getUsers(),
      ]);

      const teamsList = Array.isArray(teamsPayload) ? teamsPayload : (teamsPayload?.data || []);
      const usersList = Array.isArray(usersPayload) ? usersPayload : (usersPayload?.data || []);
      setTeams(teamsList);
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
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mt-3">
      <div className="d-flex align-items-center mb-2">
        <h4 className="me-3">{t('admin.teamCreation.title')}</h4>
        <button className="btn btn-sm btn-outline-secondary ms-auto" onClick={load}>{t('admin.teamCreation.refresh')}</button>
      </div>

      {error && <div className="alert alert-danger py-2 mb-3">{error}</div>}
      {loading && <div className="mb-3">{t('admin.teamCreation.loadingTeams')}</div>}

      <div className="mb-3">
        <TeamCreation
          teams={teams}
          users={users}
          onTeamCreated={load}
          onMembersAdded={load}
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
      </div>
    </div>
  );
}
