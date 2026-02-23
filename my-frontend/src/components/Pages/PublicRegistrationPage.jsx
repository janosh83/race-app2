import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

import { authApi } from '../../services/authApi';
import { raceApi } from '../../services/raceApi';
import { logger } from '../../utils/logger';

function PublicRegistrationPage() {
  const { slug } = useParams();
  const [race, setRace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [mode, setMode] = useState('team');
  const [teamName, setTeamName] = useState('');
  const [raceCategoryId, setRaceCategoryId] = useState('');
  const [members, setMembers] = useState([
    { name: '', email: '', password: '' },
  ]);

  const registrationModeLabel = useMemo(() => {
    if (!race) return '';
    if (race.allow_team_registration && race.allow_individual_registration) {
      return 'Team and individual registration are available';
    }
    if (race.allow_team_registration) {
      return 'Team registration only';
    }
    if (race.allow_individual_registration) {
      return 'Individual registration only';
    }
    return 'Registration mode is currently unavailable';
  }, [race]);

  const isTeamAllowed = !!race?.allow_team_registration;
  const isIndividualAllowed = !!race?.allow_individual_registration;
  const minTeamSize = race?.min_team_size || 1;
  const maxTeamSize = race?.max_team_size || 1;
  const categoryOptions = race?.categories || [];

  useEffect(() => {
    let isActive = true;

    const loadRace = async () => {
      setLoading(true);
      setError('');

      try {
        const data = await raceApi.getRegistrationBySlug(slug);
        if (!isActive) return;
        setRace(data);
        const nextMode = data.allow_team_registration ? 'team' : 'individual';
        setMode(nextMode);
        if (data.categories?.length > 0) {
          setRaceCategoryId(String(data.categories[0].id));
        }
        if (nextMode === 'team') {
          setMembers(Array.from({ length: Math.max(data.min_team_size || 1, 1) }, () => ({ name: '', email: '', password: '' })));
        } else {
          setMembers([{ name: '', email: '', password: '' }]);
        }
      } catch (err) {
        if (!isActive) return;
        const message = err?.message || 'Unable to load registration details.';
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
  }, [slug]);

  const updateMember = (index, field, value) => {
    setMembers((previous) => previous.map((member, memberIndex) => {
      if (memberIndex !== index) return member;
      return { ...member, [field]: value };
    }));
  };

  const addMemberRow = () => {
    if (members.length >= maxTeamSize) return;
    setMembers((previous) => [...previous, { name: '', email: '', password: '' }]);
  };

  const removeMemberRow = (index) => {
    const minimum = mode === 'individual' ? 1 : minTeamSize;
    if (members.length <= minimum) return;
    setMembers((previous) => previous.filter((_, memberIndex) => memberIndex !== index));
  };

  const validateBeforeSubmit = () => {
    if (!teamName.trim()) {
      return 'Team name is required.';
    }

    if (!raceCategoryId) {
      return 'Race category is required.';
    }

    if (mode === 'individual' && members.length !== 1) {
      return 'Individual registration requires exactly one member.';
    }

    if (mode === 'team' && (members.length < minTeamSize || members.length > maxTeamSize)) {
      return `Team registration must have between ${minTeamSize} and ${maxTeamSize} members.`;
    }

    const hasInvalidMember = members.some((member) => !member.name.trim() || !member.email.trim() || !member.password);
    if (hasInvalidMember) {
      return 'Each member must include name, email, and password.';
    }

    return '';
  };

  const resolveUserId = async (member) => {
    try {
      await authApi.register(member.email.trim(), member.password, member.name.trim(), false);
      const loginResult = await authApi.login(member.email.trim(), member.password);
      return loginResult?.user?.id;
    } catch (err) {
      if (err?.status === 409 || String(err?.message || '').toLowerCase().includes('already exists')) {
        const loginResult = await authApi.login(member.email.trim(), member.password);
        return loginResult?.user?.id;
      }
      throw new Error(`Member ${member.email}: ${err?.message || 'Unable to create account'}`);
    }
  };

  const resolveTeamId = async () => {
    if (mode === 'individual' && isTeamAllowed && isIndividualAllowed) {
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
    setError('');
    setSuccessMessage('');

    const validationError = validateBeforeSubmit();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const userIds = [];
      for (const member of members) {
        const userId = await resolveUserId(member);
        if (!userId) {
          throw new Error(`Unable to resolve user ID for ${member.email}`);
        }
        userIds.push(userId);
      }

      const teamId = await resolveTeamId();
      const existingMembers = await raceApi.getTeamMembersPublic(teamId);
      const existingMemberIds = new Set((existingMembers || []).map((member) => member.id));
      const memberIdsToAdd = userIds.filter((userId) => !existingMemberIds.has(userId));

      if (memberIdsToAdd.length > 0) {
        await raceApi.addTeamMembersPublic(teamId, memberIdsToAdd);
      }

      await raceApi.signUpTeamPublic(race.id, teamId, Number(raceCategoryId));
      setSuccessMessage('Registration submitted successfully. Your team has been registered for this race.');
      logger.success('RACE', 'Public registration submitted', { raceId: race.id, teamId });
    } catch (err) {
      const message = err?.message || 'Registration failed.';
      setError(message);
      logger.error('RACE', 'Public registration submit failed', message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mt-5" style={{ maxWidth: '720px' }}>
        <div className="card">
          <div className="card-body">
            <h1 className="h4">Loading registration...</h1>
            <p className="mb-0 text-muted">Please wait while race details are being loaded.</p>
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
            <h1 className="h4 text-danger">Registration unavailable</h1>
            <p className="mb-0">{error || 'Race registration could not be found.'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-5" style={{ maxWidth: '720px' }}>
      <div className="card">
        <div className="card-body">
          <h1 className="h3 mb-2">{race.name}</h1>
          <p className="text-muted">{race.description || 'No description provided.'}</p>

          <hr />

          <h2 className="h5">Registration settings</h2>
          <ul className="mb-0">
            <li>{registrationModeLabel}</li>
            <li>Team size: {race.min_team_size} to {race.max_team_size}</li>
            <li>Registration slug: {race.registration_slug}</li>
          </ul>

          <hr />

          {successMessage && <div className="alert alert-success">{successMessage}</div>}
          {error && <div className="alert alert-danger">{error}</div>}

          <form onSubmit={handleSubmit}>
            {isTeamAllowed && isIndividualAllowed && (
              <div className="mb-3">
                <label className="form-label">Registration mode</label>
                <div className="d-flex gap-3">
                  <div className="form-check">
                    <input
                      id="mode-team"
                      className="form-check-input"
                      type="radio"
                      name="registrationMode"
                      value="team"
                      checked={mode === 'team'}
                      onChange={() => {
                        setMode('team');
                        setMembers(Array.from({ length: Math.max(minTeamSize, 1) }, () => ({ name: '', email: '', password: '' })));
                      }}
                    />
                    <label className="form-check-label" htmlFor="mode-team">Team</label>
                  </div>
                  <div className="form-check">
                    <input
                      id="mode-individual"
                      className="form-check-input"
                      type="radio"
                      name="registrationMode"
                      value="individual"
                      checked={mode === 'individual'}
                      onChange={() => {
                        setMode('individual');
                        setMembers([{ name: '', email: '', password: '' }]);
                      }}
                    />
                    <label className="form-check-label" htmlFor="mode-individual">Individual</label>
                  </div>
                </div>
              </div>
            )}

            <div className="mb-3">
              <label htmlFor="team-name" className="form-label">Team name</label>
              <input
                id="team-name"
                className="form-control"
                value={teamName}
                onChange={(event) => setTeamName(event.target.value)}
                required
              />
            </div>

            <div className="mb-3">
              <label htmlFor="race-category" className="form-label">Race category</label>
              <select
                id="race-category"
                className="form-select"
                value={raceCategoryId}
                onChange={(event) => setRaceCategoryId(event.target.value)}
                required
                disabled={categoryOptions.length === 0}
              >
                {categoryOptions.length === 0 && <option value="">No category available</option>}
                {categoryOptions.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <h3 className="h6">Members</h3>
            {members.map((member, index) => (
              <div key={`member-${index}`} className="border rounded p-3 mb-3">
                <div className="mb-2">
                  <label className="form-label">Name</label>
                  <input
                    className="form-control"
                    value={member.name}
                    onChange={(event) => updateMember(index, 'name', event.target.value)}
                    required
                  />
                </div>
                <div className="mb-2">
                  <label className="form-label">Email</label>
                  <input
                    className="form-control"
                    type="email"
                    value={member.email}
                    onChange={(event) => updateMember(index, 'email', event.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Password</label>
                  <input
                    className="form-control"
                    type="password"
                    value={member.password}
                    onChange={(event) => updateMember(index, 'password', event.target.value)}
                    required
                  />
                </div>
                {mode === 'team' && (
                  <button
                    type="button"
                    className="btn btn-outline-danger btn-sm mt-3"
                    onClick={() => removeMemberRow(index)}
                    disabled={members.length <= minTeamSize}
                  >
                    Remove member
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
                Add member
              </button>
            )}

            <div>
              <button type="submit" className="btn btn-primary" disabled={submitting || categoryOptions.length === 0}>
                {submitting ? 'Submitting...' : 'Submit registration'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default PublicRegistrationPage;
