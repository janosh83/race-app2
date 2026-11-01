import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { adminApi } from '../../services/adminApi';
import { logger } from '../../utils/logger';
import { formatMoney } from '../../utils/money';

import RegistrationImporter from './RegistrationImporter';

// Registrations of a race: the list first, filtered by payment, email or
// disqualification and searchable by team or member; registering a team,
// import, export and registration emails live in the toolbar. A row's
// details hold its category, members, payments and other actions.
export default function RegistrationList({ raceId, race }) {
  const { t, i18n } = useTranslation();
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
  const [paymentAssigneeState, setPaymentAssigneeState] = useState({});
  const [editRegistrationState, setEditRegistrationState] = useState({});
  const [savingEditRegistrationTeamId, setSavingEditRegistrationTeamId] = useState(null);
  const [editMembersState, setEditMembersState] = useState({});
  const [memberPickerState, setMemberPickerState] = useState({});
  const [savingMembersTeamId, setSavingMembersTeamId] = useState(null);
  const [panel, setPanel] = useState(null); // 'register' | 'import' | null
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState(null);
  // Delete asks in the registration's details: { teamId, deleting, error }.
  const [deleteState, setDeleteState] = useState(null);

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

  // Called after the admin confirmed in the registration's details; a
  // refusal (e.g. the team logged visits) shows right there.
  const handleDeleteRegistration = async (teamId) => {
    setDeleteState({ teamId, deleting: true, error: null });
    try {
      await adminApi.deleteRegistration(raceId, teamId);
      setDeleteState(null);
      await loadRegistrations();
    } catch (err) {
      logger.error('ADMIN', 'Failed to delete registration', err);
      setDeleteState({
        teamId,
        deleting: false,
        error: err?.payload?.code === 'registration_has_visits'
          ? t('admin.registrations.errorDeleteHasVisits', { count: err.payload.visits })
          : t('admin.registrations.errorDelete'),
      });
    }
  };

  const handleRegister = async () => {
    setFormError(null);
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
      setPanel(null);
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
      setNotice(t('admin.registrations.emailsSent', { sent: result.sent, failed: result.failed }));
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
      setNotice(t('admin.registrations.teamEmailSent', { team: teamName, sent: result.sent, failed: result.failed }));
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

  const handleMarkPayment = async (teamId, paymentType, confirmed, userId) => {
    setError(null);
    try {
      await adminApi.markRegistrationPayment(raceId, teamId, paymentType, confirmed, userId);
      await loadRegistrations();
    } catch (err) {
      logger.error('ADMIN', 'Failed to mark payment state', err);
      setError(t('admin.registrations.errorMarkPayment'));
    }
  };

  const getDefaultAssigneeId = (item, paymentType) => {
    if (paymentType === 'driver') {
      return item.paymentDetails?.driver_member?.id || '';
    }
    if (paymentType === 'codriver') {
      return item.paymentDetails?.codriver_member?.id || '';
    }
    return '';
  };

  const getSelectedAssigneeId = (item, paymentType) => {
    const explicit = paymentAssigneeState[item.teamId]?.[paymentType];
    if (explicit !== undefined) return explicit;
    return getDefaultAssigneeId(item, paymentType);
  };

  const setSelectedAssigneeId = (teamId, paymentType, userId) => {
    setPaymentAssigneeState(prev => ({
      ...prev,
      [teamId]: {
        ...prev[teamId],
        [paymentType]: userId,
      },
    }));
  };

  const formatMemberLabel = (member) => {
    if (!member) return '—';
    if (member.name && member.email) return `${member.name} (${member.email})`;
    return member.name || member.email || '—';
  };

  const getOtherRoleType = (paymentType) => {
    if (paymentType === 'driver') return 'codriver';
    if (paymentType === 'codriver') return 'driver';
    return null;
  };

  const getIsAssigneeConflict = (item, paymentType) => {
    const otherRole = getOtherRoleType(paymentType);
    if (!otherRole) return false;
    const currentAssignee = String(getSelectedAssigneeId(item, paymentType) || '');
    const otherAssignee = String(getSelectedAssigneeId(item, otherRole) || '');
    return !!currentAssignee && !!otherAssignee && currentAssignee === otherAssignee;
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

  const updateRegistrationEditState = (originalTeamId, patch, defaults) => {
    setEditRegistrationState(prev => ({
      ...prev,
      [originalTeamId]: {
        raceCategoryId: prev[originalTeamId]?.raceCategoryId ?? defaults.raceCategoryId,
        ...patch,
      },
    }));
  };

  const handleSaveRegistrationEdit = async (item) => {
    const defaults = {
      raceCategoryId: String(item.currentRaceCategoryId || ''),
    };
    const state = editRegistrationState[item.teamId] || defaults;
    const nextTeamId = Number(item.teamId);
    const nextCategoryId = Number(state.raceCategoryId);

    if (!nextTeamId || !nextCategoryId) {
      setError(t('admin.registrations.formErrorSelect'));
      return;
    }

    setSavingEditRegistrationTeamId(item.teamId);
    setError(null);
    try {
      await adminApi.updateRegistration(raceId, item.teamId, {
        team_id: nextTeamId,
        race_category_id: nextCategoryId,
      });
      setExpandedPayments(prev => {
        const next = { ...prev };
        delete next[item.teamId];
        next[item.teamId] = true;
        return next;
      });
      await loadRegistrations();
    } catch (err) {
      logger.error('ADMIN', 'Failed to update registration', err);
      setError(err?.message || t('admin.registrations.errorRegister'));
    } finally {
      setSavingEditRegistrationTeamId(null);
    }
  };

  const updateMembersEditState = (teamId, memberIds) => {
    setEditMembersState(prev => ({
      ...prev,
      [teamId]: memberIds,
    }));
  };

  const getDraftMemberIds = (item) => (
    (editMembersState[item.teamId] ?? item.members.map(member => String(member.id))).map(String)
  );

  const getAssigneeMembers = (item) => {
    const seen = new Set();
    const selected = [];
    const draftIds = getDraftMemberIds(item);

    for (const memberId of draftIds) {
      const id = String(memberId);
      if (seen.has(id)) continue;
      const user = (users || []).find(candidate => String(candidate.id) === id);
      if (user) {
        selected.push(user);
      } else {
        const fallback = (item.members || []).find(member => String(member.id) === id);
        if (fallback) selected.push(fallback);
      }
      seen.add(id);
    }

    return selected;
  };

  const getMaxTeamMembers = (item) => {
    const rowMax = Number(item.raceMaxTeamSize);
    if (Number.isInteger(rowMax) && rowMax > 0) return rowMax;
    const raceMax = Number(race?.max_team_size);
    if (Number.isInteger(raceMax) && raceMax > 0) return raceMax;
    return null;
  };

  const handleAddDraftMember = (item) => {
    const candidateId = memberPickerState[item.teamId];
    if (!candidateId) return;
    const draftIds = getDraftMemberIds(item);
    if (draftIds.includes(String(candidateId))) return;

    const maxMembers = getMaxTeamMembers(item);
    if (maxMembers && draftIds.length >= maxMembers) {
      setError(t('admin.registrations.maxMembersReached', { max: maxMembers }));
      return;
    }

    updateMembersEditState(item.teamId, [...draftIds, String(candidateId)]);
    setMemberPickerState(prev => ({ ...prev, [item.teamId]: '' }));
  };

  const handleRemoveDraftMember = (item, memberId) => {
    const draftIds = getDraftMemberIds(item).filter(id => id !== String(memberId));
    updateMembersEditState(item.teamId, draftIds);
  };

  const handleResetDraftMembers = (item) => {
    updateMembersEditState(item.teamId, item.members.map(member => String(member.id)));
    setMemberPickerState(prev => ({ ...prev, [item.teamId]: '' }));
  };

  const handleSaveMembersEdit = async (item) => {
    const currentIds = (item.members || []).map(member => Number(member.id)).filter(Boolean);
    const selectedIds = (editMembersState[item.teamId] ?? currentIds)
      .map(Number)
      .filter(Boolean);

    const maxMembers = getMaxTeamMembers(item);
    if (maxMembers && selectedIds.length > maxMembers) {
      setError(t('admin.registrations.maxMembersReached', { max: maxMembers }));
      return;
    }

    setSavingMembersTeamId(item.teamId);
    setError(null);
    try {
      await adminApi.removeAllTeamMembers(item.teamId);
      if (selectedIds.length > 0) {
        await adminApi.addTeamMembers(item.teamId, { user_ids: selectedIds });
      }
      await loadRegistrations();
    } catch (err) {
      logger.error('ADMIN', 'Failed to update team members', err);
      setError(err?.message || t('admin.registrations.errorLoadMeta'));
    } finally {
      setSavingMembersTeamId(null);
    }
  };

  const getPaymentTypeLabel = (type) => {
    if (type === 'driver') return t('admin.registrations.paymentTypeDriver');
    if (type === 'codriver') return t('admin.registrations.paymentTypeCodriver');
    return t('admin.registrations.paymentTypeTeam');
  };

  const getRaceAmount = (fieldName) => {
    const value = Number(race?.[fieldName]);
    if (!Number.isFinite(value) || value < 0) return null;
    return value;
  };

  const formatFeeForCsv = (amount, currency) => {
    if (!Number.isFinite(amount)) return '';
    const normalizedCurrency = (currency || race?.registration_currency || '').toUpperCase();
    const formattedAmount = Number.isInteger(amount) ? `${amount}` : `${amount.toFixed(2)}`;
    if (!normalizedCurrency) return formattedAmount;
    return `${formattedAmount} ${normalizedCurrency}`;
  };

  const getMemberExportPaymentData = (item, member) => {
    const details = item.paymentDetails || {};
    const mode = details.mode || 'team';
    const memberId = Number(member?.id);

    if (mode === 'team') {
      return {
        status: details.team_paid ? t('admin.registrations.paymentPaid') : t('admin.registrations.paymentUnpaid'),
        fee: formatFeeForCsv(getRaceAmount('registration_team_amount_cents'), details.currency),
      };
    }

    const driverId = Number(details?.driver_member?.id);
    const codriverId = Number(details?.codriver_member?.id);

    if (Number.isFinite(driverId) && memberId === driverId) {
      return {
        status: details.driver_paid ? t('admin.registrations.paymentPaid') : t('admin.registrations.paymentUnpaid'),
        fee: formatFeeForCsv(getRaceAmount('registration_driver_amount_cents'), details.currency),
      };
    }

    if (Number.isFinite(codriverId) && memberId === codriverId) {
      return {
        status: details.codriver_paid ? t('admin.registrations.paymentPaid') : t('admin.registrations.paymentUnpaid'),
        fee: formatFeeForCsv(getRaceAmount('registration_codriver_amount_cents'), details.currency),
      };
    }

    return {
      status: t('admin.registrations.notAssignedRole'),
      fee: '',
    };
  };

  const escapeCsvValue = (value) => {
    const stringValue = value === null || value === undefined ? '' : String(value);
    if (!/[",\n\r]/.test(stringValue)) return stringValue;
    return `"${stringValue.replace(/"/g, '""')}"`;
  };

  const handleExportRegistrationsCsv = () => {
    const header = [
      t('admin.registrations.csvHeaderMemberName'),
      t('admin.registrations.csvHeaderMemberEmail'),
      t('admin.registrations.csvHeaderTeamName'),
      t('admin.registrations.csvHeaderCategory'),
      t('admin.registrations.csvHeaderPaymentStatus'),
      t('admin.registrations.csvHeaderRegistrationFee'),
    ];

    const rows = [header];

    (registrations || []).forEach((reg, idx) => {
      const item = getRegistrationViewModel(reg, idx);
      (item.members || []).forEach((member) => {
        const paymentData = getMemberExportPaymentData(item, member);
        rows.push([
          member?.name || '',
          member?.email || '',
          item.teamName || '',
          item.categoryName || '',
          paymentData.status,
          paymentData.fee,
        ]);
      });
    });

    const csv = rows
      .map(row => row.map(escapeCsvValue).join(','))
      .join('\r\n');

    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateLabel = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `registrations-race-${raceId}-${dateLabel}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getRegistrationViewModel = (reg, idx) => {
    const teamName = reg.name || reg.team?.name || `#${reg.id ?? reg.team_id ?? idx}`;
    const teamId = reg.team_id || reg.id;
    const categoryName = reg.race_category || reg.category || reg.category_name || '';
    const currentRaceCategoryId = reg.race_category_id || raceCategories.find(c => c.name === categoryName)?.id || '';
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

    return {
      teamName,
      teamId,
      categoryName,
      members,
      membersDisplay,
      currentRaceCategoryId,
      raceMaxTeamSize: reg.race_max_team_size,
      emailSent,
      disqualified,
      paymentConfirmed,
      paymentDetails,
      showPaymentDetails,
      timelineState,
      paymentItems,
      sortedAttempts,
    };
  };

  const renderPaymentDetails = (item) => (
    <div className="bg-light border rounded p-2">
      <div className="border rounded bg-white p-2 mb-2">
        <div className="fw-semibold small mb-2">{t('admin.registrations.editSectionTitle')}</div>
        <div className="row g-2 align-items-end">
          <div className="col-12 col-lg-6">
            <label className="form-label form-label-sm mb-1">{t('admin.registrations.teamLabel')}</label>
            <input className="form-control form-control-sm" value={item.teamName} disabled />
          </div>
          <div className="col-12 col-lg-3">
            <label className="form-label form-label-sm mb-1">{t('admin.registrations.categoryLabel')}</label>
            <select
              className="form-select form-select-sm"
              value={(editRegistrationState[item.teamId]?.raceCategoryId ?? String(item.currentRaceCategoryId || ''))}
              onChange={(e) => updateRegistrationEditState(
                item.teamId,
                { raceCategoryId: e.target.value },
                { raceCategoryId: String(item.currentRaceCategoryId || '') }
              )}
              disabled={savingEditRegistrationTeamId === item.teamId}
            >
              {(raceCategories || []).map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div className="col-12 col-lg-3">
            <div className="d-flex flex-wrap gap-1">
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => handleSaveRegistrationEdit(item)}
                disabled={savingEditRegistrationTeamId === item.teamId}
              >
                {savingEditRegistrationTeamId === item.teamId ? t('admin.registrations.sending') : t('admin.registrations.saveRegistrationButton')}
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-danger"
                onClick={() => setDeleteState({ teamId: item.teamId, deleting: false, error: null, confirming: true })}
                title={t('admin.registrations.deleteRegistration')}
                disabled={deleteState?.teamId === item.teamId && (deleteState.confirming || deleteState.deleting)}
              >
                {t('admin.registrations.delete')}
              </button>
            </div>
          </div>
        </div>
        {deleteState?.teamId === item.teamId && deleteState.error && (
          <div className="alert alert-danger d-flex align-items-start gap-2 py-2 mt-2 mb-0" role="alert">
            <span className="me-auto">{deleteState.error}</span>
            <button type="button" className="btn-close" aria-label={t('admin.close')} onClick={() => setDeleteState(null)} />
          </div>
        )}
        {deleteState?.teamId === item.teamId && (deleteState.confirming || deleteState.deleting) && (
          <div className="d-flex flex-wrap align-items-center gap-2 rounded bg-danger-subtle p-2 mt-2">
            <span className="small text-danger-emphasis me-auto">
              {t('admin.registrations.confirmDelete', { team: item.teamName })}
            </span>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setDeleteState(null)} disabled={deleteState.deleting}>
              {t('admin.teams.keep')}
            </button>
            <button type="button" className="btn btn-sm btn-danger" onClick={() => handleDeleteRegistration(item.teamId)} disabled={deleteState.deleting}>
              {t('admin.teams.deleteYes')}
            </button>
          </div>
        )}

        <div className="border-top mt-2 pt-2">
          <div className="fw-semibold small mb-2">{t('admin.registrations.membersSectionTitle')}</div>
          <div className="row g-2 align-items-end mb-2">
            <div className="col-12 col-lg-8">
              <label className="form-label form-label-sm mb-1">{t('admin.registrations.tableMembers')}</label>
              <div className="border rounded bg-white p-2" style={{ minHeight: 88 }}>
                {getDraftMemberIds(item).length === 0 ? (
                  <div className="small text-muted">{t('admin.registrations.noMembersSelected')}</div>
                ) : (
                  <div className="d-flex flex-column gap-1">
                    {getDraftMemberIds(item).map(memberId => {
                      const member = (users || []).find(user => String(user.id) === String(memberId));
                      const label = member ? `${member.name || member.email} (${member.email})` : `#${memberId}`;
                      return (
                        <div key={memberId} className="d-flex justify-content-between align-items-center border rounded px-2 py-1">
                          <span className="small">{label}</span>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleRemoveDraftMember(item, memberId)}
                            disabled={savingMembersTeamId === item.teamId}
                          >
                            {t('admin.registrations.removeMemberButton')}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="d-flex gap-2 mt-2">
                <select
                  className="form-select form-select-sm"
                  value={memberPickerState[item.teamId] ?? ''}
                  onChange={(e) => setMemberPickerState(prev => ({ ...prev, [item.teamId]: e.target.value }))}
                  disabled={savingMembersTeamId === item.teamId || (getMaxTeamMembers(item) && getDraftMemberIds(item).length >= getMaxTeamMembers(item))}
                >
                  <option value="">{t('admin.registrations.addMemberPlaceholder')}</option>
                  {(users || [])
                    .filter(user => !getDraftMemberIds(item).includes(String(user.id)))
                    .map(user => (
                      <option key={user.id} value={String(user.id)}>
                        {user.name || user.email} ({user.email})
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => handleAddDraftMember(item)}
                  disabled={
                    savingMembersTeamId === item.teamId
                    || !(memberPickerState[item.teamId] ?? '')
                    || (getMaxTeamMembers(item) && getDraftMemberIds(item).length >= getMaxTeamMembers(item))
                  }
                >
                  {t('admin.registrations.addMemberButton')}
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => handleResetDraftMembers(item)}
                  disabled={savingMembersTeamId === item.teamId}
                >
                  {t('admin.registrations.resetMembersButton')}
                </button>
              </div>
            </div>
            <div className="col-12 col-lg-4">
              <div className="small text-muted mb-2">
                {t('admin.registrations.selectedMembersCount', {
                  count: getDraftMemberIds(item).length,
                  max: getMaxTeamMembers(item) || '-',
                })}
              </div>
              {getMaxTeamMembers(item) && getDraftMemberIds(item).length >= getMaxTeamMembers(item) && (
                <div className="small text-warning mb-2">
                  {t('admin.registrations.maxMembersReached', { max: getMaxTeamMembers(item) })}
                </div>
              )}
              <div className="d-grid gap-2">
              <button
                type="button"
                className="btn btn-sm btn-primary w-100"
                onClick={() => handleSaveMembersEdit(item)}
                disabled={savingMembersTeamId === item.teamId}
              >
                {savingMembersTeamId === item.teamId ? t('admin.registrations.sending') : t('admin.registrations.saveMembersButton')}
              </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger w-100"
                  onClick={() => updateMembersEditState(item.teamId, [])}
                  disabled={savingMembersTeamId === item.teamId}
                >
                  {t('admin.registrations.clearAllMembersButton')}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="border-top mt-2 pt-2">
          <div className="border rounded bg-light p-2 mb-2">
            <div className="fw-semibold small mb-2">{t('admin.registrations.paymentDetails')}</div>
            {item.paymentDetails.mode === 'team' ? (
              <div className="small text-muted mb-2">
                {t('admin.registrations.teamBasedFeeNote')}
              </div>
            ) : (
              <div className="small text-muted mb-2">
                {t('admin.registrations.paymentMode')}: {item.paymentDetails.mode || '—'}
                {' · '}
                {t('admin.registrations.driverPaid')}: {item.paymentDetails.driver_paid ? t('common.yes') : t('common.no')}
                {' · '}
                {t('admin.registrations.codriverPaid')}: {item.paymentDetails.codriver_paid ? t('common.yes') : t('common.no')}
              </div>
            )}
            {item.paymentDetails.mode !== 'team' && (
              <div className="small mb-2">
                <div>{t('admin.registrations.driverMember')}: <span className="text-muted">{formatMemberLabel(item.paymentDetails.driver_member)}</span></div>
                <div>{t('admin.registrations.codriverMember')}: <span className="text-muted">{formatMemberLabel(item.paymentDetails.codriver_member)}</span></div>
              </div>
            )}
            <div className="d-flex flex-wrap gap-2 mb-2">
              {item.paymentItems.map(paymentItem => (
                <div key={paymentItem.type} className="border rounded p-2 bg-white">
                  <div className="fw-semibold small mb-2">{getPaymentTypeLabel(paymentItem.type)}</div>
                  {paymentItem.type !== 'team' && (
                    <div className="mb-2">
                      <label className="form-label form-label-sm mb-1">{t('admin.registrations.assigneeLabel')}</label>
                      <select
                        className="form-select form-select-sm"
                        value={String(getSelectedAssigneeId(item, paymentItem.type) || '')}
                        onChange={(e) => setSelectedAssigneeId(item.teamId, paymentItem.type, e.target.value)}
                      >
                        <option value="">{t('admin.registrations.selectAssignee')}</option>
                        {getAssigneeMembers(item).map(member => (
                          <option
                            key={member.id}
                            value={String(member.id)}
                            disabled={(() => {
                              const otherRole = getOtherRoleType(paymentItem.type);
                              if (!otherRole) return false;
                              const otherSelected = String(getSelectedAssigneeId(item, otherRole) || '');
                              return otherSelected && String(member.id) === otherSelected;
                            })()}
                          >
                            {member.name || member.email} ({member.email})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary me-2"
                    onClick={() => handleRetryPayment(item.teamId, paymentItem.type)}
                    disabled={paymentItem.paid}
                  >
                    {t('admin.registrations.retryPayment')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-info me-2"
                    onClick={() => handleReconcilePayment(item.teamId, paymentItem.type)}
                  >
                    {t('admin.registrations.reconcilePayment')}
                  </button>
                  {paymentItem.paid ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-warning"
                      onClick={() => handleMarkPayment(item.teamId, paymentItem.type, false, getSelectedAssigneeId(item, paymentItem.type) || null)}
                    >
                      {t('admin.registrations.markUnpaid')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-success"
                      onClick={() => handleMarkPayment(item.teamId, paymentItem.type, true, getSelectedAssigneeId(item, paymentItem.type) || null)}
                      disabled={
                        paymentItem.type !== 'team'
                        && (
                          !getSelectedAssigneeId(item, paymentItem.type)
                          || getIsAssigneeConflict(item, paymentItem.type)
                        )
                      }
                    >
                      {t('admin.registrations.markPaid')}
                    </button>
                  )}
                  {paymentItem.type !== 'team' && !getSelectedAssigneeId(item, paymentItem.type) && (
                    <div className="small text-warning mt-2">{t('admin.registrations.assigneeRequired')}</div>
                  )}
                  {paymentItem.type !== 'team' && getIsAssigneeConflict(item, paymentItem.type) && (
                    <div className="small text-warning mt-2">{t('admin.registrations.assigneeMustBeDifferent')}</div>
                  )}
                </div>
              ))}
            </div>
            <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
              <span className="small text-muted">{t('admin.registrations.timelineFilter')}</span>
              <select
                className="form-select form-select-sm"
                style={{ width: 180 }}
                value={item.timelineState.status}
                onChange={(e) => updatePaymentTimelineState(item.teamId, { status: e.target.value })}
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
                value={item.timelineState.order}
                onChange={(e) => updatePaymentTimelineState(item.teamId, { order: e.target.value })}
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
                    <th>{t('admin.registrations.attemptAssignee')}</th>
                    <th>{t('admin.registrations.attemptSession')}</th>
                  </tr>
                </thead>
                <tbody>
                  {item.sortedAttempts.length === 0 && (
                    <tr>
                      <td colSpan="7" className="text-muted">{t('admin.registrations.noPaymentAttempts')}</td>
                    </tr>
                  )}
                  {item.sortedAttempts.map(attempt => (
                    <tr key={attempt.id || attempt.stripe_session_id}>
                      <td>{getPaymentTypeLabel(attempt.payment_type || 'team')}</td>
                      <td>{attempt.status || '—'}</td>
                      <td>{attempt.amount_cents ? formatMoney(attempt.amount_cents, attempt.currency, i18n.language) : '—'}</td>
                      <td>{attempt.created_at ? new Date(attempt.created_at).toLocaleString() : '—'}</td>
                      <td>{attempt.confirmed_at ? new Date(attempt.confirmed_at).toLocaleString() : '—'}</td>
                      <td className="text-muted">{formatMemberLabel(attempt.assignee)}</td>
                      <td className="text-muted">{attempt.stripe_session_id || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="border-top mt-2 pt-2">
          <div className="fw-semibold small mb-2">{t('admin.registrations.otherActionsSectionTitle')}</div>
          <div className="d-flex flex-wrap gap-1">
            <button
              className="btn btn-sm btn-outline-warning"
              onClick={() => handleToggleDisqualification(item.teamId, item.disqualified)}
              title={item.disqualified ? t('admin.registrations.reinstateTitle') : t('admin.registrations.disqualifyTitle')}
            >
              {item.disqualified ? t('admin.registrations.reinstate') : t('admin.registrations.disqualify')}
            </button>
            <button
              className="btn btn-sm btn-outline-primary"
              onClick={() => handleSendEmailForTeam(item.teamId, item.teamName)}
              title={t('admin.registrations.sendTeamEmailTitle', { team: item.teamName })}
              disabled={sendingEmails || sendingTeamEmailId === item.teamId || item.emailSent || !item.paymentConfirmed || item.members.length === 0}
            >
              {sendingTeamEmailId === item.teamId ? t('admin.registrations.sending') : t('admin.registrations.sendTeamEmail')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (!raceId) return null;

  const items = (registrations || []).map((reg, idx) => ({ reg, idx, item: getRegistrationViewModel(reg, idx) }));
  const counts = {
    all: items.length,
    paid: items.filter(({ item }) => item.paymentConfirmed).length,
    unpaid: items.filter(({ item }) => !item.paymentConfirmed).length,
    notSent: items.filter(({ item }) => !item.emailSent).length,
    disqualified: items.filter(({ item }) => item.disqualified).length,
  };
  const query = search.trim().toLowerCase();
  const visibleItems = items.filter(({ item }) => {
    if (filter === 'paid' && !item.paymentConfirmed) return false;
    if (filter === 'unpaid' && item.paymentConfirmed) return false;
    if (filter === 'notSent' && item.emailSent) return false;
    if (filter === 'disqualified' && !item.disqualified) return false;
    if (!query) return true;
    return [item.teamName, item.categoryName, ...item.members.map(m => `${m.name || ''} ${m.email || ''}`)]
      .some(text => (text || '').toLowerCase().includes(query));
  });
  const filters = [
    { key: 'all', label: t('admin.registrations.filterAll') },
    { key: 'paid', label: t('admin.registrations.paymentPaid') },
    { key: 'unpaid', label: t('admin.registrations.paymentUnpaid') },
    { key: 'notSent', label: t('admin.registrations.filterNotSent') },
    { key: 'disqualified', label: t('admin.registrations.disqualified') },
  ];
  // Teams not registered yet: the only ones that can be registered.
  const registeredTeamIds = new Set(items.map(({ item }) => String(item.teamId)));
  const availableTeams = (teams || []).filter(team => !registeredTeamIds.has(String(team.id)));
  const openRegister = () => {
    if (panel === 'register') {
      setPanel(null);
      return;
    }
    if (!availableTeams.some(team => String(team.id) === String(selectedTeamId))) {
      setSelectedTeamId(availableTeams[0] ? String(availableTeams[0].id) : '');
    }
    setFormError(null);
    setPanel('register');
  };
  const emptyText = items.length === 0 ? t('admin.registrations.noRegistrations') : t('admin.registrations.noMatches');

  const statusBadges = (item) => (
    <>
      <span className={`badge ${item.paymentConfirmed ? 'bg-success-subtle text-success-emphasis' : 'bg-warning-subtle text-warning-emphasis'}`}>
        {item.paymentConfirmed ? t('admin.registrations.paymentPaid') : t('admin.registrations.paymentUnpaid')}
      </span>
      <span className={`badge ${item.emailSent ? 'bg-success-subtle text-success-emphasis' : 'bg-secondary-subtle text-secondary-emphasis'}`}>
        {item.emailSent ? t('admin.registrations.emailSent') : t('admin.registrations.notSent')}
      </span>
      {item.disqualified && <span className="badge bg-danger">{t('admin.registrations.disqualified')}</span>}
    </>
  );

  const detailsButton = (item, extraClass = '') => (
    <button
      type="button"
      className={`btn btn-sm ${item.showPaymentDetails ? 'btn-secondary' : 'btn-outline-secondary'} ${extraClass}`}
      onClick={() => togglePaymentDetails(item.teamId)}
      aria-expanded={item.showPaymentDetails}
    >
      {item.showPaymentDetails ? t('admin.registrations.hideDetails') : t('admin.registrations.showDetails')}
    </button>
  );

  return (
    <div>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <h3 className="h5 mb-0 me-auto">
          {t('admin.registrations.listTitle')} <span className="text-muted fw-normal">({counts.all})</span>
        </h3>
        <button
          type="button"
          className={`btn btn-sm ${panel === 'register' ? 'btn-secondary' : 'btn-primary'}`}
          onClick={openRegister}
          aria-expanded={panel === 'register'}
        >
          {t('admin.registrations.registerToggle')}
        </button>
        <button
          type="button"
          className={`btn btn-sm ${panel === 'import' ? 'btn-secondary' : 'btn-outline-secondary'}`}
          onClick={() => setPanel(panel === 'import' ? null : 'import')}
          aria-expanded={panel === 'import'}
        >
          {t('admin.registrations.importToggle')}
        </button>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={handleExportRegistrationsCsv}
          disabled={loading || items.length === 0}
        >
          {t('admin.registrations.exportCsv')}
        </button>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={handleSendEmails}
          disabled={sendingEmails || items.length === 0}
          title={t('admin.registrations.sendEmailsHelp')}
        >
          {sendingEmails ? t('admin.registrations.sending') : t('admin.registrations.sendEmails')}
        </button>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={refreshAll}
          title={t('admin.registrations.refresh')}
          aria-label={t('admin.registrations.refresh')}
        >
          ↻
        </button>
      </div>

      {notice && (
        <div className="alert alert-success alert-dismissible py-2 mb-3" role="status">
          {notice}
          <button type="button" className="btn-close py-2" aria-label={t('admin.close')} onClick={() => setNotice(null)} />
        </div>
      )}
      {error && <div className="alert alert-danger py-2 mb-3">{error}</div>}

      {panel === 'register' && (
        <section className="card mb-3">
          <div className="card-body">
            <h4 className="h6 card-title mb-3">{t('admin.registrations.registerCardTitle')}</h4>
            {formError && <div className="alert alert-warning py-2 mb-3">{formError}</div>}
            <div className="row g-2 align-items-end">
              <div className="col-md-5">
                <label className="form-label" htmlFor="register-team">{t('admin.registrations.teamLabel')}</label>
                <select
                  id="register-team"
                  className="form-select"
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  disabled={metaLoading}
                >
                  {availableTeams.map(team => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                  {availableTeams.length === 0 && <option value="">{t('admin.registrations.noTeams')}</option>}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="register-category">{t('admin.registrations.categoryLabel')}</label>
                <select
                  id="register-category"
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
              <div className="col-md-3 d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-primary flex-grow-1"
                  disabled={savingRegistration || !selectedTeamId || !selectedCategoryId}
                  onClick={handleRegister}
                >
                  {savingRegistration ? t('admin.registrations.registering') : t('admin.registrations.registerButton')}
                </button>
                <button type="button" className="btn btn-outline-secondary" onClick={() => setPanel(null)}>
                  {t('admin.registrations.cancel')}
                </button>
              </div>
            </div>
            {metaLoading && <div className="mt-2 text-muted small">{t('admin.registrations.loadingMeta')}</div>}
          </div>
        </section>
      )}

      {panel === 'import' && (
        <section className="card mb-3">
          <div className="card-body">
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
        </section>
      )}

      <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
        <div className="d-flex flex-wrap gap-1" role="group" aria-label={t('admin.registrations.filterLabel')}>
          {filters.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={`btn btn-sm rounded-pill ${filter === key ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
            >
              {label} <span className="opacity-75">{counts[key]}</span>
            </button>
          ))}
        </div>
        <input
          type="search"
          className="form-control form-control-sm ms-md-auto admin-registrations-search"
          placeholder={t('admin.registrations.searchPlaceholder')}
          aria-label={t('admin.registrations.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading && items.length === 0 && <div className="text-muted mb-3">{t('admin.registrations.loadingRegistrations')}</div>}

      <div className="d-none d-md-block">
        <table className="table table-sm align-middle admin-registrations-table">
          <thead>
            <tr>
              <th>{t('admin.registrations.tableTeam')}</th>
              <th>{t('admin.registrations.tableMembers')}</th>
              <th>{t('admin.registrations.tableStatus')}</th>
              <th className="text-end"><span className="visually-hidden">{t('admin.registrations.tableActions')}</span></th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.length === 0 && (
              <tr><td colSpan="4" className="text-muted">{emptyText}</td></tr>
            )}
            {visibleItems.map(({ reg, idx, item }) => (
              <React.Fragment key={reg.id ?? reg.team_id ?? idx}>
                <tr className={item.showPaymentDetails ? 'table-active' : ''}>
                  <td className="text-break">
                    <div className="fw-semibold">{item.teamName}</div>
                    <div className="text-muted small">{item.categoryName || '—'}</div>
                  </td>
                  <td className="text-muted small text-break">{item.membersDisplay}</td>
                  <td>
                    <div className="d-flex flex-wrap gap-1">{statusBadges(item)}</div>
                  </td>
                  <td className="text-end">{detailsButton(item)}</td>
                </tr>
                {item.showPaymentDetails && (
                  <tr>
                    <td colSpan="4">{renderPaymentDetails(item)}</td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="d-md-none">
        {visibleItems.length === 0 && (
          <div className="text-muted small">{emptyText}</div>
        )}
        {visibleItems.map(({ reg, idx, item }) => (
          <div key={reg.id ?? reg.team_id ?? idx} className="card mb-2">
            <div className="card-body p-2">
              <div className="d-flex justify-content-between align-items-start gap-2 mb-1">
                <div className="min-w-0">
                  <div className="fw-semibold">{item.teamName}</div>
                  <div className="text-muted small">{item.categoryName || '—'}</div>
                </div>
                {detailsButton(item, 'flex-shrink-0')}
              </div>
              <div className="small text-muted mb-2 text-break">{item.membersDisplay}</div>
              <div className="d-flex flex-wrap gap-1">{statusBadges(item)}</div>
              {item.showPaymentDetails && (
                <div className="mt-2">
                  {renderPaymentDetails(item)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
