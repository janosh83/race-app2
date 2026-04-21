import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { adminApi } from '../../services/adminApi';
import { logger } from '../../utils/logger';

import RegistrationImporter from './RegistrationImporter';

// Single-page management for registrations, teams, and categories
export default function RegistrationList({ raceId, race }) {
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
  const [sendingTeamEmailId, setSendingTeamEmailId] = useState(null);
  const [expandedPayments, setExpandedPayments] = useState({});
  const [paymentTimelineState, setPaymentTimelineState] = useState({});

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

  const handleSendEmailForTeam = async (teamId, teamName) => {
    if (!window.confirm(t('admin.registrations.confirmSendTeamEmail', { team: teamName }))) {
      return;
    }
    setSendingTeamEmailId(teamId);
    setError(null);
    try {
      const result = await adminApi.sendRegistrationEmails(raceId, { team_id: teamId });
      alert(t('admin.registrations.teamEmailSent', { team: teamName, sent: result.sent, failed: result.failed }));
      await loadRegistrations();
    } catch (err) {
      logger.error('ADMIN', 'Failed to send registration email for team', err);
      setError(t('admin.registrations.errorSendTeamEmail', { team: teamName }));
    } finally {
      setSendingTeamEmailId(null);
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

  const handleRetryPayment = async (teamId, paymentType) => {
    setError(null);
    try {
      const result = await adminApi.retryRegistrationPayment(raceId, teamId, paymentType);
      if (result?.checkout_url) {
        window.open(result.checkout_url, '_blank', 'noopener,noreferrer');
      }
      await loadRegistrations();
    } catch (err) {
      logger.error('ADMIN', 'Failed to retry payment', err);
      setError(t('admin.registrations.errorRetryPayment'));
    }
  };

  const handleMarkPayment = async (teamId, paymentType, confirmed) => {
    setError(null);
    try {
      await adminApi.markRegistrationPayment(raceId, teamId, paymentType, confirmed);
      await loadRegistrations();
    } catch (err) {
      logger.error('ADMIN', 'Failed to mark payment state', err);
      setError(t('admin.registrations.errorMarkPayment'));
    }
  };

  const handleReconcilePayment = async (teamId, paymentType) => {
    setError(null);
    try {
      await adminApi.reconcileRegistrationPayment(raceId, teamId, paymentType);
      await loadRegistrations();
    } catch (err) {
      logger.error('ADMIN', 'Failed to reconcile payment', err);
      setError(t('admin.registrations.errorReconcilePayment'));
    }
  };

  const togglePaymentDetails = (teamId) => {
    setExpandedPayments(prev => ({ ...prev, [teamId]: !prev[teamId] }));
  };

  const updatePaymentTimelineState = (teamId, patch) => {
    setPaymentTimelineState(prev => ({
      ...prev,
      [teamId]: {
        status: prev[teamId]?.status || 'all',
        order: prev[teamId]?.order || 'newest',
        ...patch,
      },
    }));
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
              <th>{t('admin.registrations.tablePayment')}</th>
              <th>{t('admin.registrations.tableDisqualified')}</th>
              <th style={{ width: 220 }}>{t('admin.registrations.tableActions')}</th>
            </tr>
          </thead>
          <tbody>
            {(!registrations || registrations.length === 0) && (
              <tr><td colSpan="7" className="text-muted">{t('admin.registrations.noRegistrations')}</td></tr>
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
              const paymentConfirmed = !!reg.payment_confirmed;
              const paymentDetails = reg.payment_details || {};
              const attempts = Array.isArray(paymentDetails.attempts) ? paymentDetails.attempts : [];
              const showPaymentDetails = !!expandedPayments[teamId];
              const timelineState = paymentTimelineState[teamId] || { status: 'all', order: 'newest' };
              const paymentMode = paymentDetails.mode;
              const paymentItems = paymentMode === 'team'
                ? [{ type: 'team', paid: !!paymentDetails.team_paid }]
                : [
                    { type: 'driver', paid: !!paymentDetails.driver_paid },
                    { type: 'codriver', paid: !!paymentDetails.codriver_paid },
                  ];
              const filteredAttempts = (attempts || []).filter(attempt => (
                timelineState.status === 'all' || (attempt.status || '').toLowerCase() === timelineState.status
              ));
              const sortedAttempts = [...filteredAttempts].sort((left, right) => {
                const leftValue = new Date(left.confirmed_at || left.created_at || 0).getTime();
                const rightValue = new Date(right.confirmed_at || right.created_at || 0).getTime();
                return timelineState.order === 'oldest' ? leftValue - rightValue : rightValue - leftValue;
              });

              const getPaymentTypeLabel = (type) => {
                if (type === 'driver') return t('admin.registrations.paymentTypeDriver');
                if (type === 'codriver') return t('admin.registrations.paymentTypeCodriver');
                return t('admin.registrations.paymentTypeTeam');
              };
              return (
                <React.Fragment key={reg.id ?? reg.team_id ?? idx}>
                  <tr>
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
                      {paymentConfirmed ? (
                        <span className="badge bg-success">{t('admin.registrations.paymentPaid')}</span>
                      ) : (
                        <span className="badge bg-warning text-dark">{t('admin.registrations.paymentUnpaid')}</span>
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
                        className="btn btn-sm btn-outline-secondary me-2 mb-1"
                        onClick={() => togglePaymentDetails(teamId)}
                        title={t('admin.registrations.paymentDetails')}
                      >
                        {showPaymentDetails ? t('admin.registrations.hideDetails') : t('admin.registrations.showDetails')}
                      </button>
                      <button
                        className="btn btn-sm btn-outline-warning me-2 mb-1"
                        onClick={() => handleToggleDisqualification(teamId, disqualified)}
                        title={disqualified ? t('admin.registrations.reinstateTitle') : t('admin.registrations.disqualifyTitle')}
                      >
                        {disqualified ? t('admin.registrations.reinstate') : t('admin.registrations.disqualify')}
                      </button>
                      <button
                        className="btn btn-sm btn-outline-primary me-2 mb-1"
                        onClick={() => handleSendEmailForTeam(teamId, teamName)}
                        title={t('admin.registrations.sendTeamEmailTitle', { team: teamName })}
                        disabled={sendingEmails || sendingTeamEmailId === teamId || emailSent || !paymentConfirmed || members.length === 0}
                      >
                        {sendingTeamEmailId === teamId ? t('admin.registrations.sending') : t('admin.registrations.sendTeamEmail')}
                      </button>
                      <button
                        className="btn btn-sm btn-outline-danger mb-1"
                        onClick={() => handleDeleteRegistration(teamId)}
                        title={t('admin.registrations.deleteRegistration')}
                      >
                        {t('admin.registrations.delete')}
                      </button>
                    </td>
                  </tr>
                  {showPaymentDetails && (
                    <tr>
                      <td colSpan="7" className="bg-light">
                        <div className="small text-muted mb-2">
                          {t('admin.registrations.paymentMode')}: {paymentDetails.mode || '—'}
                          {' · '}
                          {t('admin.registrations.driverPaid')}: {paymentDetails.driver_paid ? t('common.yes') : t('common.no')}
                          {' · '}
                          {t('admin.registrations.codriverPaid')}: {paymentDetails.codriver_paid ? t('common.yes') : t('common.no')}
                        </div>
                        <div className="d-flex flex-wrap gap-2 mb-2">
                          {paymentItems.map(item => (
                            <div key={item.type} className="border rounded p-2 bg-white">
                              <div className="fw-semibold small mb-2">{getPaymentTypeLabel(item.type)}</div>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary me-2"
                                onClick={() => handleRetryPayment(teamId, item.type)}
                                disabled={item.paid}
                              >
                                {t('admin.registrations.retryPayment')}
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-info me-2"
                                onClick={() => handleReconcilePayment(teamId, item.type)}
                              >
                                {t('admin.registrations.reconcilePayment')}
                              </button>
                              {item.paid ? (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-warning"
                                  onClick={() => handleMarkPayment(teamId, item.type, false)}
                                >
                                  {t('admin.registrations.markUnpaid')}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-success"
                                  onClick={() => handleMarkPayment(teamId, item.type, true)}
                                >
                                  {t('admin.registrations.markPaid')}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                          <span className="small text-muted">{t('admin.registrations.timelineFilter')}</span>
                          <select
                            className="form-select form-select-sm"
                            style={{ width: 180 }}
                            value={timelineState.status}
                            onChange={(e) => updatePaymentTimelineState(teamId, { status: e.target.value })}
                          >
                            <option value="all">{t('admin.registrations.timelineStatusAll')}</option>
                            <option value="confirmed">{t('admin.registrations.timelineStatusConfirmed')}</option>
                            <option value="pending">{t('admin.registrations.timelineStatusPending')}</option>
                            <option value="failed">{t('admin.registrations.timelineStatusFailed')}</option>
                          </select>
                          <span className="small text-muted">{t('admin.registrations.timelineSort')}</span>
                          <select
                            className="form-select form-select-sm"
                            style={{ width: 180 }}
                            value={timelineState.order}
                            onChange={(e) => updatePaymentTimelineState(teamId, { order: e.target.value })}
                          >
                            <option value="newest">{t('admin.registrations.timelineSortNewest')}</option>
                            <option value="oldest">{t('admin.registrations.timelineSortOldest')}</option>
                          </select>
                        </div>
                        <div className="table-responsive">
                          <table className="table table-sm table-bordered mb-0">
                            <thead>
                              <tr>
                                <th>{t('admin.registrations.attemptType')}</th>
                                <th>{t('admin.registrations.attemptStatus')}</th>
                                <th>{t('admin.registrations.attemptAmount')}</th>
                                <th>{t('admin.registrations.attemptCreated')}</th>
                                <th>{t('admin.registrations.attemptConfirmed')}</th>
                                <th>{t('admin.registrations.attemptSession')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sortedAttempts.length === 0 && (
                                <tr>
                                  <td colSpan="6" className="text-muted">{t('admin.registrations.noPaymentAttempts')}</td>
                                </tr>
                              )}
                              {sortedAttempts.map(attempt => (
                                <tr key={attempt.id || attempt.stripe_session_id}>
                                  <td>{getPaymentTypeLabel(attempt.payment_type || 'team')}</td>
                                  <td>{attempt.status || '—'}</td>
                                  <td>{attempt.amount_cents ? `${attempt.amount_cents / 100} ${attempt.currency || ''}` : '—'}</td>
                                  <td>{attempt.created_at ? new Date(attempt.created_at).toLocaleString() : '—'}</td>
                                  <td>{attempt.confirmed_at ? new Date(attempt.confirmed_at).toLocaleString() : '—'}</td>
                                  <td className="text-muted">{attempt.stripe_session_id || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
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
          race={race}
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