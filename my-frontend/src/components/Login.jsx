import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { useTime } from '../contexts/TimeContext';
import { authApi } from '../services/authApi';
import { selectActiveRace } from '../utils/activeRaceUtils';
import { logger } from '../utils/logger';

import LanguageSwitcher from './LanguageSwitcher';

function Login() {
    const { t, i18n } = useTranslation();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { setActiveRace, setSignedRaces } = useTime();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        logger.info('AUTH', 'Login attempt', { email });
        try {
            const data = await authApi.login(email, password);
            if (data.access_token) {
                logger.success('AUTH', 'Login successful', { email, hasRaces: !!data.signed_races?.length });
                localStorage.setItem('accessToken', data.access_token);
                localStorage.setItem('refreshToken', data.refresh_token);
                localStorage.setItem('user', JSON.stringify(data.user));
                localStorage.setItem('signedRaces', JSON.stringify(data.signed_races));
                setSignedRaces(data.signed_races || []);

                // Set language from user's preferred_language if available
                if (data.user?.preferred_language) {
                    i18n.changeLanguage(data.user.preferred_language);
                    logger.info('SETTINGS', 'Language set from user preference', { language: data.user.preferred_language });
                }

                // choose active race (if exactly one candidate)
                const { activeRaceId } = selectActiveRace(data.signed_races || []);

                if (activeRaceId) {
                    // find the full signed_race object to persist (may contain team_id)
                    const candidate = (data.signed_races || []).find(r => (r.race_id ?? r.id ?? r.raceId) === activeRaceId) || null;
                    if (candidate) {
                        logger.info('RACE', 'Auto-selecting race', { race: candidate.race_name || candidate.name || candidate.race_id });
                        setActiveRace(candidate);
                    }
                    else {
                        logger.warn('RACE', 'Could not find candidate race in signed_races', { activeRaceId });
                        setActiveRace({ race_id: activeRaceId });
                    }

                    logger.info('NAVIGATION', `Navigating to /race/${activeRaceId}/map after login`);
                    // Notify app about auth change and go directly to map (one race auto-selected)
                    window.dispatchEvent(new Event('auth-update'));
                    navigate(`/race/${activeRaceId}/map`, { replace: true });

                } else {
                    logger.info('RACE', 'Multiple race candidates available, user must select');
                    // no single candidate — clear any previous active race
                    setActiveRace(null);

                    // Notify app about auth change and go to race selection page
                    window.dispatchEvent(new Event('auth-update'));
                    navigate('/race', { replace: true });
                }
            } else {
                logger.error('AUTH', 'Login failed', data.msg || 'Unknown error');
                setError(data.msg || t('auth.login.failed'));
            }
        } catch (err) {
            logger.error('AUTH', 'Login error', err.message);
            setError(err.message || t('auth.login.failed'));
        }
    };

    return (
        <div className="container d-flex align-items-center justify-content-center min-vh-100">
            <div className="card p-4 shadow" style={{ maxWidth: '400px', width: '100%' }}>
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <h2 className="mb-0">{t('auth.login.title')}</h2>
                    <LanguageSwitcher />
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="mb-3">
                        <label htmlFor="email" className="form-label">{t('auth.login.emailLabel')}</label>
                        <input
                            type="email"
                            className="form-control"
                            id="email"
                            placeholder={t('auth.login.emailPlaceholder')}
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="mb-3">
                        <label htmlFor="password" className="form-label">{t('auth.login.passwordLabel')}</label>
                        <input
                            type="password"
                            className="form-control"
                            id="password"
                            placeholder={t('auth.login.passwordPlaceholder')}
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    {error && <div className="alert alert-danger">{error}</div>}
                    <button type="submit" className="btn btn-primary w-100">{t('auth.login.submit')}</button>
                    <div className="text-center mt-3">
                        <a href="/forgot-password" className="text-decoration-none">
                            {t('auth.login.forgotLink')}
                        </a>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default Login;