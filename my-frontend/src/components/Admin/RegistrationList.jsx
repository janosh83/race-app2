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
  const [paymentAssigneeState, setPaymentAssigneeState] = useState({});
  const [editRegistrationState, setEditRegistrationState] = useState({});
  const [savingEditRegistrationTeamId, setSavingEditRegistrationTeamId] = useState(null);
  const [editMembersState, setEditMembersState] = useState({});
  const [memberPickerState, setMemberPickerState] = useState({});
  const [savingMembersTeamId, setSavingMembersTeamId] = useState(null);

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
                className="btn btn-sm btn-success"
                onClick={() => handleSaveRegistrationEdit(item)}
                disabled={savingEditRegistrationTeamId === item.teamId}
              >
                {savingEditRegistrationTeamId === item.teamId ? t('admin.registrations.sending') : t('admin.registrations.saveRegistrationButton')}
              </button>
              <button
                className="btn btn-sm btn-outline-danger"
                onClick={() => handleDeleteRegistration(item.teamId)}
                title={t('admin.registrations.deleteRegistration')}
              >
                {t('admin.registrations.delete')}
              </button>
            </div>
          </div>
        </div>

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
                className="btn btn-sm btn-success w-100"
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
            <div className="small text-muted mb-2">
              {t('admin.registrations.paymentMode')}: {item.paymentDetails.mode || '—'}
              {' · '}
              {t('admin.registrations.driverPaid')}: {item.paymentDetails.driver_paid ? t('common.yes') : t('common.no')}
              {' · '}
              {t('admin.registrations.codriverPaid')}: {item.paymentDetails.codriver_paid ? t('common.yes') : t('common.no')}
            </div>
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
                      <td>{attempt.amount_cents ? `${attempt.amount_cents / 100} ${attempt.currency || ''}` : '—'}</td>
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

        <div className="d-none d-md-block">
          <div className="w-100 overflow-hidden">
            <table className="table table-sm align-middle" style={{ tableLayout: 'fixed', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: '22%' }}>{t('admin.registrations.tableTeam')}</th>
                  <th style={{ width: '36%' }}>{t('admin.registrations.tableMembers')}</th>
                  <th style={{ width: '26%' }}>
                    {t('admin.registrations.tableEmailSent')} / {t('admin.registrations.tablePayment')} / {t('admin.registrations.tableDisqualified')}
                  </th>
                  <th style={{ width: '16%' }}>{t('admin.registrations.tableActions')}</th>
                </tr>
              </thead>
              <tbody>
                {(!registrations || registrations.length === 0) && (
                  <tr><td colSpan="4" className="text-muted">{t('admin.registrations.noRegistrations')}</td></tr>
                )}
                {registrations.map((reg, idx) => {
                  const item = getRegistrationViewModel(reg, idx);
                  return (
                    <React.Fragment key={reg.id ?? reg.team_id ?? idx}>
                      <tr>
                        <td className="text-break">
                          <div className="fw-semibold">{item.teamName}</div>
                          <div className="text-muted small">{item.categoryName || '—'}</div>
                        </td>
                        <td className="text-muted small text-break" title={item.membersDisplay}>
                          {item.membersDisplay}
                        </td>
                        <td>
                          <div className="d-flex flex-wrap gap-1">
                            <span className={`badge ${item.emailSent ? 'bg-success' : 'bg-secondary'}`}>
                              {item.emailSent ? t('admin.registrations.emailSent') : t('admin.registrations.notSent')}
                            </span>
                            <span className={`badge ${item.paymentConfirmed ? 'bg-success' : 'bg-warning text-dark'}`}>
                              {item.paymentConfirmed ? t('admin.registrations.paymentPaid') : t('admin.registrations.paymentUnpaid')}
                            </span>
                            <span className={`badge ${item.disqualified ? 'bg-danger' : 'bg-success'}`}>
                              {item.disqualified ? t('admin.registrations.disqualified') : t('admin.registrations.eligible')}
                            </span>
                          </div>
                        </td>
                        <td>
                          <button
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => togglePaymentDetails(item.teamId)}
                            title={t('admin.registrations.paymentDetails')}
                          >
                            {item.showPaymentDetails ? t('admin.registrations.hideDetails') : t('admin.registrations.showDetails')}
                          </button>
                        </td>
                      </tr>
                      {item.showPaymentDetails && (
                        <tr>
                          <td colSpan="4">{renderPaymentDetails(item)}</td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="d-md-none">
          {(!registrations || registrations.length === 0) && (
            <div className="text-muted small">{t('admin.registrations.noRegistrations')}</div>
          )}
          {(registrations || []).map((reg, idx) => {
            const item = getRegistrationViewModel(reg, idx);
            return (
              <div key={reg.id ?? reg.team_id ?? idx} className="card mb-2">
                <div className="card-body p-2">
                  <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                    <div>
                      <div className="fw-semibold small">{item.teamName}</div>
                      <div className="text-muted small">{item.categoryName || '—'}</div>
                    </div>
                    <div className="d-flex flex-wrap gap-1 justify-content-end">
                      <span className={`badge ${item.emailSent ? 'bg-success' : 'bg-secondary'}`}>
                        {item.emailSent ? t('admin.registrations.emailSent') : t('admin.registrations.notSent')}
                      </span>
                      <span className={`badge ${item.paymentConfirmed ? 'bg-success' : 'bg-warning text-dark'}`}>
                        {item.paymentConfirmed ? t('admin.registrations.paymentPaid') : t('admin.registrations.paymentUnpaid')}
                      </span>
                      <span className={`badge ${item.disqualified ? 'bg-danger' : 'bg-success'}`}>
                        {item.disqualified ? t('admin.registrations.disqualified') : t('admin.registrations.eligible')}
                      </span>
                    </div>
                  </div>

                  <div className="small text-muted mb-2 text-break" style={{ lineHeight: 1.3 }}>
                    <strong>{t('admin.registrations.tableMembers')}:</strong> {item.membersDisplay}
                  </div>

                  <div className="d-grid gap-1">
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => togglePaymentDetails(item.teamId)}
                      title={t('admin.registrations.paymentDetails')}
                    >
                      {item.showPaymentDetails ? t('admin.registrations.hideDetails') : t('admin.registrations.showDetails')}
                    </button>
                  </div>

                  {item.showPaymentDetails && (
                    <div className="mt-2">
                      {renderPaymentDetails(item)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

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