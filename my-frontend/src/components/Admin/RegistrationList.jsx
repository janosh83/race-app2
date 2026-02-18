import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../../services/adminApi';
import TeamCreation from './TeamCreation';
import RegistrationImporter from './RegistrationImporter';
import { logger } from '../../utils/logger';

// Single-page management for registrations, teams, and categories
export default function RegistrationList({ raceId }) {
  const { t } = useTranslation();
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
  const [sendingEmails, setSendingEmails] = useState(false);

  const loadRegistrations = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await adminApi.getRegistrations(raceId);
      const regs = Array.isArray(payload) ? payload : (payload?.data || payload?.results || payload?.registrations || []);
      setRegistrations(regs || []);
    } catch (err) {
      logger.error('ADMIN', 'Failed to load registrations', err);
      setError(t('admin.registrations.errorLoad'));
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
      logger.error('ADMIN', 'Failed to load teams or categories', err);
      setError(t('admin.registrations.errorLoadMeta'));
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

  const handleDeleteRegistration = async (teamId) => {    if (!window.confirm(t('admin.registrations.confirmDelete'))) {
      return;
    }
    try {
      await adminApi.deleteRegistration(raceId, teamId);
      await loadRegistrations();
    } catch (err) {
      logger.error('ADMIN', 'Failed to delete registration', err);
      setError(t('admin.registrations.errorDelete'));
    }
  };

  const handleRegister = async () => {    setFormError(null);
    if (!selectedTeamId || !selectedCategoryId) {
      setFormError(t('admin.registrations.formErrorSelect'));
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
      logger.error('ADMIN', 'Failed to register team', err);
      setFormError(t('admin.registrations.errorRegister'));
    } finally {
      setSavingRegistration(false);
    }
  };

  const handleSendEmails = async () => {
    if (!window.confirm(t('admin.registrations.confirmSendEmails'))) {
      return;
    }
    setSendingEmails(true);
    setError(null);
    try {
      const result = await adminApi.sendRegistrationEmails(raceId);
      alert(t('admin.registrations.emailsSent', { sent: result.sent, failed: result.failed }));
    } catch (err) {
      logger.error('ADMIN', 'Failed to send emails', err);
      setError(t('admin.registrations.errorSendEmails'));
    } finally {
      setSendingEmails(false);
    }
  };


  const refreshAll = () => {
    loadRegistrations();
    loadMeta();
  };

  const handleToggleDisqualification = async (teamId, current) => {
    try {
      await adminApi.setDisqualification(raceId, teamId, !current);
      await loadRegistrations();
    } catch (err) {
      logger.error('ADMIN', 'Failed to toggle disqualification', err);
      setError(t('admin.registrations.errorToggleDisqualification'));
    }
  };

  if (!raceId) return null;

  return (
    <div className="mt-3">
      <div className="d-flex align-items-center mb-2">
        <h4 className="me-3">{t('admin.registrations.title')}</h4>
        <button type="button" className="btn btn-sm btn-outline-secondary ms-auto" onClick={refreshAll}>{t('admin.registrations.refresh')}</button>
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
            <h5 className="mb-3">{t('admin.registrations.registerCardTitle')}</h5>
            <div className="mb-2">
              <label className="form-label">{t('admin.registrations.teamLabel')}</label>
              <select
                className="form-select"
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                disabled={metaLoading}
              >
                {(teams || []).map(team => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
                {(!teams || teams.length === 0) && <option value="">{t('admin.registrations.noTeams')}</option>}
              </select>
            </div>
            <div className="mb-3">
              <label className="form-label">{t('admin.registrations.categoryLabel')}</label>
              <select
                className="form-select"
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                disabled={metaLoading}
              >
                {(raceCategories || []).map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
                {(!raceCategories || raceCategories.length === 0) && <option value="">{t('admin.registrations.noCategories')}</option>}
              </select>
            </div>
            <button
              type="button"
              className="btn btn-success"
              disabled={savingRegistration || !selectedTeamId || !selectedCategoryId}
              onClick={handleRegister}
            >
              {savingRegistration ? t('admin.registrations.registering') : t('admin.registrations.registerButton')}
            </button>
            {metaLoading && <div className="mt-2 text-muted small">{t('admin.registrations.loadingMeta')}</div>}
          </div>
        </div>
      </div>

        <div className="border rounded p-3 mb-3">
        {loading && <div className="mb-3">{t('admin.registrations.loadingRegistrations')}</div>}

        <h5 className="mb-3">{t('admin.registrations.currentRegistrations')}</h5>

        <table className="table table-sm">
          <thead>
            <tr>
              <th>{t('admin.registrations.tableTeam')}</th>
              <th>{t('admin.registrations.tableCategory')}</th>
              <th>{t('admin.registrations.tableMembers')}</th>
              <th>{t('admin.registrations.tableEmailSent')}</th>
              <th>{t('admin.registrations.tableDisqualified')}</th>
              <th style={{ width: 140 }}>{t('admin.registrations.tableActions')}</th>
            </tr>
          </thead>
          <tbody>
            {(!registrations || registrations.length === 0) && (
              <tr><td colSpan="6" className="text-muted">{t('admin.registrations.noRegistrations')}</td></tr>
            )}
            {registrations.map((reg, idx) => {
              const teamName = reg.name || reg.team?.name || `#${reg.id ?? reg.team_id ?? idx}`;
              const teamId = reg.team_id || reg.id;
              const categoryName = reg.race_category || reg.category || reg.category_name || '';
              const members = Array.isArray(reg.members) ? reg.members : (reg.team?.members || []);
              const membersDisplay = (members || []).length > 0
                ? members.map(m => m.name || m.email || `#${m.id}`).join(', ')
                : '—';
              const emailSent = reg.email_sent || false;
              const disqualified = !!reg.disqualified;
              return (
                <tr key={reg.id ?? reg.team_id ?? idx}>
                  <td>{teamName}</td>
                  <td>{categoryName}</td>
                  <td className="text-muted small">{membersDisplay}</td>
                  <td>
                    {emailSent ? (
                      <span className="badge bg-success">{t('admin.registrations.emailSent')}</span>
                    ) : (
                      <span className="badge bg-secondary">{t('admin.registrations.notSent')}</span>
                    )}
                  </td>
                  <td>
                    {disqualified ? (
                      <span className="badge bg-danger">{t('admin.registrations.disqualified')}</span>
                    ) : (
                      <span className="badge bg-success">{t('admin.registrations.eligible')}</span>
                    )}
                  </td>
                  <td>
                    <button
                      className="btn btn-sm btn-outline-warning me-2"
                      onClick={() => handleToggleDisqualification(teamId, disqualified)}
                      title={disqualified ? t('admin.registrations.reinstateTitle') : t('admin.registrations.disqualifyTitle')}
                    >
                      {disqualified ? t('admin.registrations.reinstate') : t('admin.registrations.disqualify')}
                    </button>
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => handleDeleteRegistration(teamId)}
                      title={t('admin.registrations.deleteRegistration')}
                    >
                      {t('admin.registrations.delete')}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="d-flex justify-content-end mt-3">
          <button
            className="btn btn-primary"
            onClick={handleSendEmails}
            disabled={sendingEmails || !registrations || registrations.length === 0}
          >
            {sendingEmails ? t('admin.registrations.sending') : t('admin.registrations.sendEmails')}
          </button>
        </div>

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