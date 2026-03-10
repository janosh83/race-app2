import React, { useEffect, useMemo, useState } from 'react';
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

  useEffect(() => {
    if (!raceId) {
      setRegistrations([]);
      return;
    }

    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await adminApi.getRegistrations(raceId);
        const data = Array.isArray(payload)
          ? payload
          : (payload?.data || payload?.results || payload?.registrations || []);
        if (!mounted) return;
        setRegistrations(Array.isArray(data) ? data : []);
      } catch (err) {
        logger.error('ADMIN', 'Failed to load payment attempts summary', err);
        if (!mounted) return;
        setError(t('admin.paymentAttemptsSummary.errorLoad'));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [raceId, t]);

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
        <div className="col-12 col-lg-6">
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
                    </tr>
                  </thead>
                  <tbody>
                    {summary.recentAttempts.length === 0 && (
                      <tr>
                        <td colSpan="4" className="text-muted">{t('admin.registrations.noPaymentAttempts')}</td>
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
