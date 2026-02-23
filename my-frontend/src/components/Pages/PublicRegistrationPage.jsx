import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

import { raceApi } from '../../services/raceApi';
import { logger } from '../../utils/logger';

function PublicRegistrationPage() {
  const { slug } = useParams();
  const [race, setRace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  useEffect(() => {
    let isActive = true;

    const loadRace = async () => {
      setLoading(true);
      setError('');

      try {
        const data = await raceApi.getRegistrationBySlug(slug);
        if (!isActive) return;
        setRace(data);
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
        </div>
      </div>
    </div>
  );
}

export default PublicRegistrationPage;
