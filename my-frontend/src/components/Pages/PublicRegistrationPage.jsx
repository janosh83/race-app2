import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router-dom';

import { raceApi } from '../../services/raceApi';
import { logger } from '../../utils/logger';
import LanguageSwitcher from '../LanguageSwitcher';

function PublicRegistrationPage() {
  const { t, i18n } = useTranslation();
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const [race, setRace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [checkingPaymentStatus, setCheckingPaymentStatus] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('none');
  const [confirmedTeamName, setConfirmedTeamName] = useState('');
  const [confirmedTeamId, setConfirmedTeamId] = useState('');
  const [mode, setMode] = useState('team');
  const [teamName, setTeamName] = useState('');
  const [raceCategoryId, setRaceCategoryId] = useState('');
  const [members, setMembers] = useState([
    { name: '', email: '', role: 'driver' },
  ]);

  const minTeamSize = race?.min_team_size || 1;
  const maxTeamSize = race?.max_team_size || 1;
  const categoryOptions = race?.categories || [];
  const isCheckoutCanceled = searchParams.get('checkout') === 'cancel';

  const registrationCurrency = String(race?.registration_currency || 'czk').toUpperCase();

  const registrationPrice = (() => {
    if (!race) return 0;

    if (mode === 'individual') {
      return members[0]?.role === 'driver'
        ? (race.registration_driver_amount_cents || 0)
        : (race.registration_codriver_amount_cents || 0);
    }

    return race.registration_team_amount_cents || 0;
  })();

  const formatPrice = (value) => {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: registrationCurrency,
        maximumFractionDigits: 0,
      }).format(value || 0);
    } catch {
      return `${value || 0} ${registrationCurrency}`;
    }
  };

  const buildMembers = (count, nextMode) => {
    const safeCount = Math.max(count, 1);
    return Array.from({ length: safeCount }, (_, index) => ({
      name: '',
      email: '',
      role: nextMode === 'individual' ? 'driver' : (index === 0 ? 'driver' : 'codriver'),
    }));
  };

  useEffect(() => {
    const checkoutStatus = searchParams.get('checkout');
    const teamId = searchParams.get('team_id');
    const teamNameFromQuery = searchParams.get('team_name') || '';

    if (!checkoutStatus) {
      setPaymentStatus('none');
      setConfirmedTeamId('');
      setConfirmedTeamName('');
      return;
    }

    if (checkoutStatus === 'success') {
      setConfirmedTeamId(teamId || '');
      setConfirmedTeamName(teamNameFromQuery);

      if (!teamId) {
        setPaymentStatus('pending');
        setSuccessMessage('');
        setError('');
        return;
      }

      let isActive = true;
      const verifyPayment = async () => {
        setCheckingPaymentStatus(true);
        setPaymentStatus('verifying');
        setSuccessMessage('');
        setError('');

        try {
          const status = await raceApi.getRegistrationPaymentStatus(slug, teamId);
          if (!isActive) return;

          if (status?.payment_confirmed) {
            setPaymentStatus('confirmed');
            setError('');
          } else {
            setPaymentStatus('pending');
            setError('');
          }
        } catch {
          if (!isActive) return;
          setPaymentStatus('pending');
          setError('');
        } finally {
          if (isActive) {
            setCheckingPaymentStatus(false);
          }
        }
      };

      verifyPayment();

      return () => {
        isActive = false;
      };
    } else if (checkoutStatus === 'cancel') {
      setPaymentStatus('none');
      setConfirmedTeamId(teamId || '');
      setConfirmedTeamName(teamNameFromQuery);
      setError(t('publicRegistration.paymentCanceled'));
      setSuccessMessage('');
    }
  }, [searchParams, slug, t]);

  useEffect(() => {
    let isActive = true;

    const loadRace = async () => {
      setLoading(true);
      setError('');

      try {
        const currentLanguage = (i18n.resolvedLanguage || i18n.language || '').split('-')[0] || undefined;
        const data = await raceApi.getRegistrationBySlug(slug, currentLanguage);
        if (!isActive) return;
        setRace(data);
        const nextMode = data.allow_team_registration ? 'team' : 'individual';
        setMode(nextMode);
        if (data.categories?.length > 0) {
          setRaceCategoryId(String(data.categories[0].id));
        }
        if (nextMode === 'team') {
          setMembers(buildMembers(data.min_team_size || 1, 'team'));
        } else {
          setMembers(buildMembers(1, 'individual'));
        }
      } catch (err) {
        if (!isActive) return;
        const message = err?.message || t('publicRegistration.loadFailed');
        setError(message);
        logger.error('RACE', 'Public registration page load failed', message);
      } finally {
        if (isActive) setLoading(false);
      }
    };

    loadRace();

    return () => {
      isActive = false;
    };
  }, [slug, t, i18n.language, i18n.resolvedLanguage]);

  const updateMember = (index, field, value) => {
    setMembers((previous) => previous.map((member, memberIndex) => {
      if (memberIndex !== index) return member;
      return { ...member, [field]: value };
    }));
  };

  const addMemberRow = () => {
    if (members.length >= maxTeamSize) return;
    setMembers((previous) => [...previous, { name: '', email: '', role: 'codriver' }]);
  };

  const removeMemberRow = (index) => {
    const minimum = mode === 'individual' ? 1 : minTeamSize;
    if (members.length <= minimum) return;
    setMembers((previous) => previous.filter((_, memberIndex) => memberIndex !== index));
  };

  const validateBeforeSubmit = () => {
    if (!teamName.trim()) {
      return t('publicRegistration.validationTeamNameRequired');
    }

    if (!raceCategoryId) {
      return t('publicRegistration.validationCategoryRequired');
    }

    if (mode === 'individual' && members.length !== 1) {
      return t('publicRegistration.validationIndividualRequiresOne');
    }

    if (mode === 'team' && (members.length < minTeamSize || members.length > maxTeamSize)) {
      return t('publicRegistration.validationTeamSizeRange', {
        min: minTeamSize,
        max: maxTeamSize,
      });
    }

    const hasInvalidMember = members.some((member) => !member.name.trim() || !member.email.trim());
    if (hasInvalidMember) {
      return t('publicRegistration.validationMemberFieldsRequired');
    }

    return '';
  };

  const resolveTeamId = async () => {
    if (mode === 'individual') {
      const teams = await raceApi.getTeamsPublic();
      const existingTeam = teams.find((team) => String(team.name || '').trim().toLowerCase() === teamName.trim().toLowerCase());
      if (existingTeam) {
        return existingTeam.id;
      }
    }

    const createdTeam = await raceApi.createTeamPublic(teamName.trim());
    return createdTeam.id;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setPaymentStatus('none');
    setConfirmedTeamId('');
    setConfirmedTeamName('');
    setError('');
    setSuccessMessage('');

    const validationError = validateBeforeSubmit();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const uiLanguage = String(i18n.resolvedLanguage || i18n.language || '').trim().toLowerCase();
      const normalizedLanguage = uiLanguage.split('-')[0] || '';
      const registrationLanguage = (race?.supported_languages || []).includes(normalizedLanguage)
        ? normalizedLanguage
        : (race?.default_language || 'en');

      const teamId = await resolveTeamId();
      await raceApi.addTeamMembersPublic(teamId, members.map((member) => ({
        name: member.name.trim(),
        email: member.email.trim().toLowerCase(),
        preferred_language: registrationLanguage,
      })));

      await raceApi.signUpTeamPublic(race.id, teamId, Number(raceCategoryId));
      const baseUrl = window.location.origin;
      const checkoutPayload = {
        team_id: teamId,
        team_name: teamName.trim(),
        mode,
        members_count: members.length,
        success_url: `${baseUrl}/register/${slug}?checkout=success&team_id=${encodeURIComponent(teamId)}&team_name=${encodeURIComponent(teamName.trim())}`,
        cancel_url: `${baseUrl}/register/${slug}?checkout=cancel&team_id=${encodeURIComponent(teamId)}&team_name=${encodeURIComponent(teamName.trim())}`,
      };

      if (mode === 'individual') {
        checkoutPayload.individual_role = members[0]?.role || 'driver';
      }

      const checkoutSession = await raceApi.createRegistrationCheckoutSession(slug, checkoutPayload);

      if (checkoutSession?.checkout_url) {
        window.location.assign(checkoutSession.checkout_url);
        return;
      }

      setSuccessMessage(t('publicRegistration.submittedSuccess'));
      logger.success('RACE', 'Public registration submitted', { raceId: race.id, teamId });
    } catch (err) {
      const message = err?.message || t('publicRegistration.registrationFailed');
      setError(message);
      logger.error('RACE', 'Public registration submit failed', message);
    } finally {
      setSubmitting(false);
    }
  };

  const displayedTeamName = confirmedTeamName
    || teamName
    || (confirmedTeamId
      ? t('publicRegistration.teamNumber', { id: confirmedTeamId })
      : t('publicRegistration.yourTeamFallback'));

  if (loading) {
    return (
      <div className="container mt-5" style={{ maxWidth: '720px' }}>
        <div className="card">
          <div className="card-body">
            <h1 className="h4">{t('publicRegistration.loadingTitle')}</h1>
            <p className="mb-0 text-muted">{t('publicRegistration.loadingMessage')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !race) {
    return (
      <div className="container mt-5" style={{ maxWidth: '720px' }}>
        <div className="card border-danger">
          <div className="card-body">
            <h1 className="h4 text-danger">{t('publicRegistration.unavailableTitle')}</h1>
            <p className="mb-0">{error || t('publicRegistration.unavailableFallback')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-5" style={{ maxWidth: '720px' }}>
      <div className="card">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-start gap-3">
            <div className="flex-grow-1">
              <h1 className="h3 mb-2">{race.name}</h1>
              <p className="text-muted">{race.description || t('publicRegistration.noDescription')}</p>
            </div>
            <div style={{ minWidth: '92px' }}>
              <LanguageSwitcher />
            </div>
          </div>

          <hr />

          {paymentStatus === 'verifying' && (
            <div className="alert alert-info" role="status">
              {t('publicRegistration.paymentVerifying')}
            </div>
          )}
          {paymentStatus === 'pending' && (
            <div className="alert alert-warning" role="status">
              {t('publicRegistration.paymentPending')}
            </div>
          )}
          {paymentStatus === 'confirmed' && (
            <div className="alert alert-success" role="status">
              {t('publicRegistration.paymentConfirmed')}
            </div>
          )}
          {successMessage && <div className="alert alert-success">{successMessage}</div>}
          {error && <div className="alert alert-danger">{error}</div>}

          {isCheckoutCanceled && paymentStatus !== 'confirmed' && (
            <div className="border rounded p-3 bg-light mb-3">
              <h3 className="h6 mb-2">{t('publicRegistration.paymentNotCompletedTitle')}</h3>
              <p className="text-muted mb-3">{t('publicRegistration.paymentNotCompletedHelp')}</p>
              <dl className="row mb-2">
                <dt className="col-sm-4 mb-0">{t('publicRegistration.raceLabel')}</dt>
                <dd className="col-sm-8 mb-0">{race.name}</dd>
              </dl>
              <dl className="row mb-0">
                <dt className="col-sm-4 mb-0">{t('publicRegistration.teamLabel')}</dt>
                <dd className="col-sm-8 mb-0">{displayedTeamName}</dd>
              </dl>
            </div>
          )}

          {paymentStatus !== 'confirmed' ? (
            <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label htmlFor="team-name" className="form-label">{t('publicRegistration.teamNameLabel')}</label>
              <input
                id="team-name"
                className="form-control"
                value={teamName}
                onChange={(event) => setTeamName(event.target.value)}
                required
              />
            </div>

            <div className="mb-3">
              <label htmlFor="race-category" className="form-label">{t('publicRegistration.categoryLabel')}</label>
              <select
                id="race-category"
                className="form-select"
                value={raceCategoryId}
                onChange={(event) => setRaceCategoryId(event.target.value)}
                required
                disabled={categoryOptions.length === 0}
              >
                {categoryOptions.length === 0 && <option value="">{t('publicRegistration.noCategoryAvailable')}</option>}
                {categoryOptions.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <h3 className="h6">
              {t('publicRegistration.membersTitle')}
              {mode === 'team' ? ` (${t('publicRegistration.teamSize', { min: race.min_team_size, max: race.max_team_size })})` : ''}
            </h3>
            {members.map((member, index) => (
              <div key={`member-${index}`} className="border rounded p-3 mb-3">
                <div className="mb-2">
                  <label className="form-label">{t('publicRegistration.nameLabel')}</label>
                  <input
                    className="form-control"
                    value={member.name}
                    onChange={(event) => updateMember(index, 'name', event.target.value)}
                    required
                  />
                </div>
                <div className="mb-2">
                  <label className="form-label">{t('publicRegistration.emailLabel')}</label>
                  <input
                    className="form-control"
                    type="email"
                    value={member.email}
                    onChange={(event) => updateMember(index, 'email', event.target.value)}
                    required
                  />
                </div>
                {mode === 'individual' && index === 0 && (
                  <div className="mb-2">
                    <label className="form-label">{t('publicRegistration.memberRoleLabel')}</label>
                    <select
                      className="form-select"
                      value={member.role || 'driver'}
                      onChange={(event) => updateMember(index, 'role', event.target.value)}
                      required
                    >
                      <option value="driver">{t('publicRegistration.memberRoleDriver')}</option>
                      <option value="codriver">{t('publicRegistration.memberRoleCodriver')}</option>
                    </select>
                  </div>
                )}
                {mode === 'team' && (
                  <button
                    type="button"
                    className="btn btn-outline-danger btn-sm mt-3"
                    onClick={() => removeMemberRow(index)}
                    disabled={members.length <= minTeamSize}
                  >
                    {t('publicRegistration.removeMember')}
                  </button>
                )}
              </div>
            ))}

            {mode === 'team' && (
              <button
                type="button"
                className="btn btn-outline-secondary mb-3"
                onClick={addMemberRow}
                disabled={members.length >= maxTeamSize}
              >
                {t('publicRegistration.addMember')}
              </button>
            )}

              <div className="border rounded p-3 bg-light mb-3">
                <div className="fw-semibold mb-1">{t('publicRegistration.priceTitle')}</div>
                <div className="fw-semibold">
                  {t('publicRegistration.priceTotal', { total: formatPrice(registrationPrice) })}
                </div>
              </div>

              <div>
                <button type="submit" className="btn btn-primary" disabled={submitting || checkingPaymentStatus || categoryOptions.length === 0}>
                  {submitting || checkingPaymentStatus ? t('publicRegistration.submitting') : t('publicRegistration.submitRegistration')}
                </button>
              </div>
            </form>
          ) : (
            <div className="border rounded p-3 bg-light">
              <h3 className="h6 mb-3">{t('publicRegistration.registrationCompleteTitle')}</h3>
              <dl className="row mb-2">
                <dt className="col-sm-4 mb-0">{t('publicRegistration.raceLabel')}</dt>
                <dd className="col-sm-8 mb-0">{race.name}</dd>
              </dl>
              <dl className="row mb-0">
                <dt className="col-sm-4 mb-0">{t('publicRegistration.teamLabel')}</dt>
                <dd className="col-sm-8 mb-0">{displayedTeamName}</dd>
              </dl>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PublicRegistrationPage;
