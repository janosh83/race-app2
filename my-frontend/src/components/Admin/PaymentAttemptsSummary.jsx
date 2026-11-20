import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { adminApi } from '../../services/adminApi';
import { formatShortDateTime } from '../../utils/dateRange';
import { logger } from '../../utils/logger';
import { formatMoney } from '../../utils/money';

import StatTile from './StatTile';

const EMPTY_FILTERS = { status: '', teamId: '', dateFrom: '', dateTo: '' };
const EMAIL_STATUSES = ['pending', 'sent', 'delivered', 'opened', 'failed', 'bounced', 'blocked'];
const RETRYABLE_EMAIL = ['failed', 'bounced', 'blocked'];

const attemptBadge = (status) => ({
  confirmed: 'bg-success-subtle text-success-emphasis',
  pending: 'bg-warning-subtle text-warning-emphasis',
  failed: 'bg-danger-subtle text-danger-emphasis',
}[status] || 'bg-secondary-subtle text-secondary-emphasis');

const emailBadge = (status) => {
  if (['sent', 'delivered', 'opened'].includes(status)) return 'bg-success-subtle text-success-emphasis';
  if (RETRYABLE_EMAIL.includes(status)) return 'bg-danger-subtle text-danger-emphasis';
  return 'bg-secondary-subtle text-secondary-emphasis';
};

const attemptKeyOf = (attempt) => attempt.id || attempt.stripe_session_id || `${attempt.teamId}-${attempt.created_at || ''}`;

export default function PaymentAttemptsSummary({ raceId }) {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [reconcilingAttemptKey, setReconcilingAttemptKey] = useState(null);
  const [emailLogsLoading, setEmailLogsLoading] = useState(false);
  const [emailLogs, setEmailLogs] = useState([]);
  const [retryingFailedEmails, setRetryingFailedEmails] = useState(false);
  const [retryingEmailLogId, setRetryingEmailLogId] = useState(null);
  const [emailLogFilters, setEmailLogFilters] = useState(EMPTY_FILTERS);

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

    const attemptKey = attemptKeyOf(attempt);
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

  const filtersActive = Object.values(emailLogFilters).some(Boolean);

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
      paidTeams: (registrations || []).filter(reg => reg?.payment_confirmed).length,
      total: allAttempts.length,
      latest: sortedAttempts[0] || null,
      statusCounts,
      recentAttempts: sortedAttempts,
    };
  }, [registrations]);

  const teamOptions = useMemo(() => (registrations || [])
    .map(reg => ({ id: reg?.team_id || reg?.id, name: reg?.name || reg?.team?.name || `#${reg?.team_id || reg?.id}` }))
    .filter(team => team.id)
    .sort((a, b) => a.name.localeCompare(b.name)), [registrations]);

  if (!raceId) return null;

  const date = (value) => formatShortDateTime(value);
  const attemptsNeedingAction = summary.recentAttempts.some(a => (a.status || '').toLowerCase() !== 'confirmed');
  const emailsNeedingAction = emailLogs.some(log => RETRYABLE_EMAIL.includes((log.status || '').toLowerCase()));
  const statusEntries = Object.entries(summary.statusCounts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="mt-3">
      <div className="d-flex align-items-center gap-2 mb-3">
        <h2 className="h4 mb-0 me-auto">{t('admin.paymentAttemptsSummary.title')}</h2>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={() => { loadRegistrations(); loadEmailLogs(); }}
          title={t('admin.paymentAttemptsSummary.refresh')}
          aria-label={t('admin.paymentAttemptsSummary.refresh')}
        >
          ↻
        </button>
      </div>

      {loading && <div className="mb-3 text-muted">{t('admin.paymentAttemptsSummary.loading')}</div>}
      {error && <div className="alert alert-danger py-2 mb-3">{error}</div>}

      <div className="row row-cols-2 row-cols-lg-4 g-2 mb-4">
        <StatTile label={t('admin.paymentAttemptsSummary.registeredTeams')}>
          <div className="fs-4 fw-semibold">{summary.registeredTeams}</div>
        </StatTile>
        <StatTile label={t('admin.paymentAttemptsSummary.paidTeams')}>
          <div className="fs-4 fw-semibold">
            {summary.paidTeams}
            <span className="fs-6 text-muted fw-normal"> / {summary.registeredTeams}</span>
          </div>
        </StatTile>
        <StatTile label={t('admin.paymentAttemptsSummary.totalAttempts')}>
          <div className="fs-4 fw-semibold">{summary.total}</div>
          <div className="d-flex flex-wrap gap-1">
            {statusEntries.map(([status, count]) => (
              <span key={status} className={`badge ${attemptBadge(status)}`}>{status} {count}</span>
            ))}
          </div>
        </StatTile>
        <StatTile label={t('admin.paymentAttemptsSummary.latestAttempt')}>
          <div className="fw-semibold mt-1">{summary.latest ? date(summary.latest.confirmed_at || summary.latest.created_at) : '—'}</div>
          {summary.latest && <div className="small text-muted text-truncate">{summary.latest.teamName}</div>}
        </StatTile>
      </div>

      <section className="mb-4">
        <h3 className="h5">{t('admin.paymentAttemptsSummary.recentAttempts')}</h3>
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0">
            <thead>
              <tr>
                <th>{t('admin.registrations.tableTeam')}</th>
                <th>{t('admin.registrations.attemptStatus')}</th>
                <th>{t('admin.registrations.attemptAmount')}</th>
                <th>{t('admin.registrations.attemptCreated')}</th>
                {attemptsNeedingAction && <th>{t('admin.registrations.tableActions')}</th>}
              </tr>
            </thead>
            <tbody>
              {summary.recentAttempts.length === 0 && (
                <tr>
                  <td colSpan="5" className="text-muted">{t('admin.registrations.noPaymentAttempts')}</td>
                </tr>
              )}
              {summary.recentAttempts.map((attempt, index) => {
                const status = (attempt.status || '').toLowerCase();
                return (
                  <tr key={`${attempt.id || attempt.stripe_session_id || index}`}>
                    <td>{attempt.teamName}</td>
                    <td>
                      <span className={`badge ${attemptBadge(status)}`}>{attempt.status || t('admin.paymentAttemptsSummary.unknownStatus')}</span>
                    </td>
                    <td className="text-nowrap">
                      {attempt.amount_cents ? formatMoney(attempt.amount_cents, attempt.currency, i18n.language) : '—'}
                    </td>
                    <td className="text-nowrap">{date(attempt.created_at)}</td>
                    {attemptsNeedingAction && (
                      <td>
                        {status !== 'confirmed' && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-info"
                            disabled={reconcilingAttemptKey === attemptKeyOf(attempt) || !attempt.teamId}
                            onClick={() => handleReconcileAttempt(attempt)}
                          >
                            {t('admin.registrations.reconcilePayment')}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-3">
        <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
          <h3 className="h5 mb-0 me-auto">{t('admin.paymentAttemptsSummary.emailTrackingTitle')}</h3>
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

        <div className="d-flex flex-wrap align-items-end gap-2 mb-3 admin-email-filters">
          <div>
            <label className="form-label small mb-1" htmlFor="email-filter-status">{t('admin.paymentAttemptsSummary.filterStatus')}</label>
            <select
              id="email-filter-status"
              className="form-select form-select-sm"
              value={emailLogFilters.status}
              onChange={(event) => handleEmailFilterChange('status', event.target.value)}
            >
              <option value="">{t('admin.paymentAttemptsSummary.filterAnyStatus')}</option>
              {EMAIL_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label small mb-1" htmlFor="email-filter-team">{t('admin.paymentAttemptsSummary.filterTeam')}</label>
            <select
              id="email-filter-team"
              className="form-select form-select-sm"
              value={emailLogFilters.teamId}
              onChange={(event) => handleEmailFilterChange('teamId', event.target.value)}
            >
              <option value="">{t('admin.paymentAttemptsSummary.filterAnyTeam')}</option>
              {teamOptions.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label small mb-1" htmlFor="email-filter-from">{t('admin.paymentAttemptsSummary.filterDateFrom')}</label>
            <input
              id="email-filter-from"
              type="date"
              className="form-control form-control-sm"
              value={emailLogFilters.dateFrom}
              onChange={(event) => handleEmailFilterChange('dateFrom', event.target.value)}
            />
          </div>
          <div>
            <label className="form-label small mb-1" htmlFor="email-filter-to">{t('admin.paymentAttemptsSummary.filterDateTo')}</label>
            <input
              id="email-filter-to"
              type="date"
              className="form-control form-control-sm"
              value={emailLogFilters.dateTo}
              onChange={(event) => handleEmailFilterChange('dateTo', event.target.value)}
            />
          </div>
          {filtersActive && (
            <button type="button" className="btn btn-sm btn-link" onClick={() => setEmailLogFilters(EMPTY_FILTERS)}>
              {t('admin.paymentAttemptsSummary.clearFilters')}
            </button>
          )}
        </div>

        {emailLogsLoading && <div className="small text-muted mb-2">{t('admin.paymentAttemptsSummary.loading')}</div>}

        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0">
            <thead>
              <tr>
                <th>{t('admin.paymentAttemptsSummary.team')}</th>
                <th>{t('admin.paymentAttemptsSummary.emailAddress')}</th>
                <th>{t('admin.paymentAttemptsSummary.emailStatus')}</th>
                <th>{t('admin.paymentAttemptsSummary.emailAttempts')}</th>
                <th>{t('admin.paymentAttemptsSummary.lastAttempt')}</th>
                <th>{t('admin.paymentAttemptsSummary.lastError')}</th>
                {emailsNeedingAction && <th>{t('admin.paymentAttemptsSummary.actions')}</th>}
              </tr>
            </thead>
            <tbody>
              {emailLogs.length === 0 && (
                <tr>
                  <td colSpan="7" className="text-muted">{t('admin.paymentAttemptsSummary.noEmailLogs')}</td>
                </tr>
              )}
              {emailLogs.map((log) => {
                const status = (log.status || '').toLowerCase();
                return (
                  <tr key={log.id}>
                    <td>{log.team_name || (log.team_id ? `#${log.team_id}` : '—')}</td>
                    <td className="text-break">{log.email_address || '—'}</td>
                    <td><span className={`badge ${emailBadge(status)}`}>{log.status || '—'}</span></td>
                    <td>{log.attempt_count || 0}</td>
                    <td className="text-nowrap">{date(log.last_attempted_at)}</td>
                    <td className="small text-muted">{log.error_message || '—'}</td>
                    {emailsNeedingAction && (
                      <td>
                        {RETRYABLE_EMAIL.includes(status) && (
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
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
