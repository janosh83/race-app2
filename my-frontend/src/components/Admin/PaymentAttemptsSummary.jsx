import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { adminApi } from '../../services/adminApi';
import { logger } from '../../utils/logger';

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export default function PaymentAttemptsSummary({ raceId }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [reconcilingAttemptKey, setReconcilingAttemptKey] = useState(null);
  const [emailLogsLoading, setEmailLogsLoading] = useState(false);
  const [emailLogs, setEmailLogs] = useState([]);
  const [retryingFailedEmails, setRetryingFailedEmails] = useState(false);
  const [retryingEmailLogId, setRetryingEmailLogId] = useState(null);
  const [emailLogFilters, setEmailLogFilters] = useState({
    status: '',
    teamId: '',
    dateFrom: '',
    dateTo: '',
  });

  const loadRegistrations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await adminApi.getRegistrations(raceId);
      const data = Array.isArray(payload)
        ? payload
        : (payload?.data || payload?.results || payload?.registrations || []);
      setRegistrations(Array.isArray(data) ? data : []);
    } catch (err) {
      logger.error('ADMIN', 'Failed to load payment attempts summary', err);
      setError(t('admin.paymentAttemptsSummary.errorLoad'));
    } finally {
      setLoading(false);
    }
  }, [raceId, t]);

  const loadEmailLogs = useCallback(async () => {
    setEmailLogsLoading(true);
    try {
      const params = {
        page: 1,
        page_size: 100,
        template_type: 'registration_confirmation',
      };

      if (emailLogFilters.status) params.status = emailLogFilters.status;
      if (emailLogFilters.teamId) params.team_id = emailLogFilters.teamId;
      if (emailLogFilters.dateFrom) params.date_from = emailLogFilters.dateFrom;
      if (emailLogFilters.dateTo) params.date_to = emailLogFilters.dateTo;

      const payload = await adminApi.getRegistrationEmailLogs(raceId, params);
      const items = Array.isArray(payload) ? payload : (payload?.data || []);
      setEmailLogs(items);
    } catch (err) {
      logger.error('ADMIN', 'Failed to load registration email logs', err);
      setError(t('admin.paymentAttemptsSummary.errorLoadEmailLogs'));
      setEmailLogs([]);
    } finally {
      setEmailLogsLoading(false);
    }
  }, [raceId, t, emailLogFilters]);

  useEffect(() => {
    if (!raceId) {
      setRegistrations([]);
      setEmailLogs([]);
      return;
    }

    loadRegistrations();
    loadEmailLogs();
  }, [raceId, loadRegistrations, loadEmailLogs]);

  const handleReconcileAttempt = async (attempt) => {
    const teamId = attempt?.teamId;
    if (!teamId) return;

    const attemptKey = attempt?.id || attempt?.stripe_session_id || `${teamId}-${attempt?.created_at || ''}`;
    const paymentType = attempt?.payment_type || 'team';

    setReconcilingAttemptKey(attemptKey);
    setError(null);
    try {
      await adminApi.reconcileRegistrationPayment(
        raceId,
        teamId,
        paymentType,
        attempt?.stripe_session_id,
      );
      await loadRegistrations();
      await loadEmailLogs();
    } catch (err) {
      logger.error('ADMIN', 'Failed to reconcile payment from summary table', err);
      setError(t('admin.registrations.errorReconcilePayment'));
    } finally {
      setReconcilingAttemptKey(null);
    }
  };

  const handleRetryFailedEmails = async () => {
    setRetryingFailedEmails(true);
    setError(null);
    try {
      await adminApi.retryFailedRegistrationEmails(raceId, { limit: 100 });
      await loadEmailLogs();
      await loadRegistrations();
    } catch (err) {
      logger.error('ADMIN', 'Failed to retry failed registration emails', err);
      setError(t('admin.paymentAttemptsSummary.errorRetryFailedEmails'));
    } finally {
      setRetryingFailedEmails(false);
    }
  };

  const handleEmailFilterChange = (key, value) => {
    setEmailLogFilters((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleApplyEmailFilters = async () => {
    await loadEmailLogs();
  };

  const handleClearEmailFilters = async () => {
    setEmailLogFilters({
      status: '',
      teamId: '',
      dateFrom: '',
      dateTo: '',
    });
  };

  const handleRetryEmailLog = async (log) => {
    if (!log?.id) return;
    setRetryingEmailLogId(log.id);
    setError(null);
    try {
      await adminApi.retryRegistrationEmailLog(raceId, log.id);
      await loadEmailLogs();
      await loadRegistrations();
    } catch (err) {
      logger.error('ADMIN', 'Failed to retry email log row', err);
      setError(t('admin.paymentAttemptsSummary.errorRetryEmailLog'));
    } finally {
      setRetryingEmailLogId(null);
    }
  };

  useEffect(() => {
    loadEmailLogs();
  }, [emailLogFilters, loadEmailLogs]);

  const summary = useMemo(() => {
    const allAttempts = [];

    for (const reg of registrations || []) {
      const attempts = Array.isArray(reg?.payment_details?.attempts) ? reg.payment_details.attempts : [];
      const teamName = reg?.name || reg?.team?.name || `#${reg?.team_id || reg?.id || '—'}`;

      for (const attempt of attempts) {
        allAttempts.push({
          ...attempt,
          teamName,
          teamId: reg?.team_id || reg?.id || null,
        });
      }
    }

    const statusCounts = {};
    for (const attempt of allAttempts) {
      const statusKey = (attempt?.status || 'unknown').toLowerCase();
      statusCounts[statusKey] = (statusCounts[statusKey] || 0) + 1;
    }

    const sortedAttempts = [...allAttempts].sort((left, right) => {
      const leftValue = new Date(left.confirmed_at || left.created_at || 0).getTime();
      const rightValue = new Date(right.confirmed_at || right.created_at || 0).getTime();
      return rightValue - leftValue;
    });

    return {
      registeredTeams: (registrations || []).length,
      total: allAttempts.length,
      uniqueTeams: new Set(allAttempts.map(item => item.teamId || item.teamName)).size,
      latest: sortedAttempts[0] || null,
      statusCounts,
      recentAttempts: sortedAttempts,
    };
  }, [registrations]);

  if (!raceId) return null;

  return (
    <div className="mt-3">
      <div className="d-flex align-items-center mb-3">
        <h4 className="me-3 mb-0">{t('admin.paymentAttemptsSummary.title')}</h4>
      </div>

      {loading && <div className="mb-3">{t('admin.paymentAttemptsSummary.loading')}</div>}
      {error && <div className="alert alert-danger py-2 mb-3">{error}</div>}

      <div className="row g-3 mb-3">
        <div className="col-12 col-md-4">
          <div className="card h-100">
            <div className="card-body">
              <div className="text-muted small">{t('admin.paymentAttemptsSummary.registeredTeams')}</div>
              <div className="display-6 fw-semibold">{summary.registeredTeams}</div>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="card h-100">
            <div className="card-body">
              <div className="text-muted small">{t('admin.paymentAttemptsSummary.totalAttempts')}</div>
              <div className="display-6 fw-semibold">{summary.total}</div>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="card h-100">
            <div className="card-body">
              <div className="text-muted small">{t('admin.paymentAttemptsSummary.uniqueTeams')}</div>
              <div className="display-6 fw-semibold">{summary.uniqueTeams}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-12 col-lg-6">
          <div className="card h-100">
            <div className="card-body">
              <h5 className="card-title">{t('admin.paymentAttemptsSummary.statusBreakdown')}</h5>
              <table className="table table-sm mb-0">
                <thead>
                  <tr>
                    <th>{t('admin.registrations.attemptStatus')}</th>
                    <th>{t('admin.paymentAttemptsSummary.count')}</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(summary.statusCounts).length === 0 && (
                    <tr>
                      <td colSpan="2" className="text-muted">{t('admin.registrations.noPaymentAttempts')}</td>
                    </tr>
                  )}
                  {Object.entries(summary.statusCounts)
                    .sort((a, b) => b[1] - a[1])
                    .map(([status, count]) => (
                      <tr key={status}>
                        <td>{status}</td>
                        <td>{count}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="col-12 col-lg-6">
          <div className="card h-100">
            <div className="card-body">
              <h5 className="card-title">{t('admin.paymentAttemptsSummary.latestAttempt')}</h5>
              <div className="fw-semibold">{formatDate(summary.latest?.confirmed_at || summary.latest?.created_at)}</div>
              <div className="small text-muted mt-1">
                {summary.latest
                  ? `${summary.latest.teamName} • ${summary.latest.status || t('admin.paymentAttemptsSummary.unknownStatus')}`
                  : '—'}
              </div>
            </div>
          </div>
        </div>

      </div>

      <div className="row g-3 mb-3">
        <div className="col-12">
          <div className="card h-100">
            <div className="card-body">
              <h5 className="card-title">{t('admin.paymentAttemptsSummary.recentAttempts')}</h5>
              <div className="table-responsive">
                <table className="table table-sm mb-0">
                  <thead>
                    <tr>
                      <th>{t('admin.registrations.tableTeam')}</th>
                      <th>{t('admin.registrations.attemptStatus')}</th>
                      <th>{t('admin.registrations.attemptAmount')}</th>
                      <th>{t('admin.registrations.attemptCreated')}</th>
                      <th>{t('admin.registrations.tableActions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.recentAttempts.length === 0 && (
                      <tr>
                        <td colSpan="5" className="text-muted">{t('admin.registrations.noPaymentAttempts')}</td>
                      </tr>
                    )}
                    {summary.recentAttempts.map((attempt, index) => (
                      <tr key={`${attempt.id || attempt.stripe_session_id || index}`}>
                        <td>{attempt.teamName}</td>
                        <td>{attempt.status || t('admin.paymentAttemptsSummary.unknownStatus')}</td>
                        <td>
                          {attempt.amount_cents
                            ? `${attempt.amount_cents / 100} ${(attempt.currency || '').toUpperCase()}`
                            : '—'}
                        </td>
                        <td>{formatDate(attempt.created_at)}</td>
                        <td>
                          {((attempt.status || '').toLowerCase() !== 'confirmed') ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-info"
                              disabled={
                                reconcilingAttemptKey === (attempt.id || attempt.stripe_session_id || `${attempt.teamId}-${attempt.created_at || ''}`)
                                || !attempt.teamId
                              }
                              onClick={() => handleReconcileAttempt(attempt)}
                            >
                              {t('admin.registrations.reconcilePayment')}
                            </button>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-12">
          <div className="card h-100">
            <div className="card-body">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <h5 className="card-title mb-0">{t('admin.paymentAttemptsSummary.emailTrackingTitle')}</h5>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={handleRetryFailedEmails}
                  disabled={retryingFailedEmails}
                >
                  {retryingFailedEmails
                    ? t('admin.paymentAttemptsSummary.retryingFailedEmails')
                    : t('admin.paymentAttemptsSummary.retryFailedEmails')}
                </button>
              </div>

              <div className="row g-2 mb-3">
                <div className="col-12 col-md-3">
                  <label className="form-label small mb-1">{t('admin.paymentAttemptsSummary.filterStatus')}</label>
                  <select
                    className="form-select form-select-sm"
                    value={emailLogFilters.status}
                    onChange={(event) => handleEmailFilterChange('status', event.target.value)}
                  >
                    <option value="">{t('admin.paymentAttemptsSummary.filterAnyStatus')}</option>
                    {['pending', 'sent', 'delivered', 'opened', 'failed', 'bounced', 'blocked'].map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-md-2">
                  <label className="form-label small mb-1">{t('admin.paymentAttemptsSummary.filterTeamId')}</label>
                  <input
                    type="number"
                    min="1"
                    className="form-control form-control-sm"
                    value={emailLogFilters.teamId}
                    onChange={(event) => handleEmailFilterChange('teamId', event.target.value)}
                    placeholder="1"
                  />
                </div>

                <div className="col-12 col-md-3">
                  <label className="form-label small mb-1">{t('admin.paymentAttemptsSummary.filterDateFrom')}</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={emailLogFilters.dateFrom}
                    onChange={(event) => handleEmailFilterChange('dateFrom', event.target.value)}
                  />
                </div>

                <div className="col-12 col-md-3">
                  <label className="form-label small mb-1">{t('admin.paymentAttemptsSummary.filterDateTo')}</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={emailLogFilters.dateTo}
                    onChange={(event) => handleEmailFilterChange('dateTo', event.target.value)}
                  />
                </div>

                <div className="col-12 col-md-1 d-flex align-items-end">
                  <div className="d-flex gap-1 w-100">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary w-100"
                      onClick={handleApplyEmailFilters}
                    >
                      {t('admin.paymentAttemptsSummary.applyFilters')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-light w-100"
                      onClick={handleClearEmailFilters}
                    >
                      {t('admin.paymentAttemptsSummary.clearFilters')}
                    </button>
                  </div>
                </div>
              </div>

              {emailLogsLoading && <div className="small text-muted mb-2">{t('admin.paymentAttemptsSummary.loading')}</div>}

              <div className="table-responsive">
                <table className="table table-sm mb-0">
                  <thead>
                    <tr>
                      <th>{t('admin.paymentAttemptsSummary.team')}</th>
                      <th>{t('admin.paymentAttemptsSummary.emailAddress')}</th>
                      <th>{t('admin.paymentAttemptsSummary.emailStatus')}</th>
                      <th>{t('admin.paymentAttemptsSummary.emailAttempts')}</th>
                      <th>{t('admin.paymentAttemptsSummary.lastAttempt')}</th>
                      <th>{t('admin.paymentAttemptsSummary.lastError')}</th>
                      <th>{t('admin.paymentAttemptsSummary.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emailLogs.length === 0 && (
                      <tr>
                        <td colSpan="7" className="text-muted">{t('admin.paymentAttemptsSummary.noEmailLogs')}</td>
                      </tr>
                    )}
                    {emailLogs.map((log) => (
                      <tr key={log.id}>
                        <td>{log.team_name || (log.team_id ? `#${log.team_id}` : '—')}</td>
                        <td>{log.email_address || '—'}</td>
                        <td>{log.status || '—'}</td>
                        <td>{log.attempt_count || 0}</td>
                        <td>{formatDate(log.last_attempted_at)}</td>
                        <td className="text-muted">{log.error_message || '—'}</td>
                        <td>
                          {['failed', 'bounced', 'blocked'].includes((log.status || '').toLowerCase()) ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-warning"
                              disabled={retryingEmailLogId === log.id}
                              onClick={() => handleRetryEmailLog(log)}
                            >
                              {retryingEmailLogId === log.id
                                ? t('admin.paymentAttemptsSummary.retryingEmailLog')
                                : t('admin.paymentAttemptsSummary.retryEmailLog')}
                            </button>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
