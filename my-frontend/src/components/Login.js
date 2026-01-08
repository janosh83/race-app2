import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { selectActiveRace } from '../utils/activeRaceUtils';
import { useTime } from '../contexts/TimeContext';
import { authApi } from '../services/authApi';
import { logger } from '../utils/logger';

function Login() {
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

                // choose active race (if exactly one candidate)
                const { activeRaceId, candidates } = selectActiveRace(data.signed_races || []);

                if (activeRaceId) {
                    // find the full signed_race object to persist (may contain team_id)
                    const candidate = (data.signed_races || []).find(r => (r.race_id ?? r.id ?? r.raceId) === activeRaceId) || null;
                    if (candidate) {
                        logger.info('RACE', 'Auto-selecting race', { race: candidate.name || candidate.race_id });
                        setActiveRace(candidate);
                    }
                    else setActiveRace({ race_id: activeRaceId });
                } else {
                    logger.info('RACE', 'Multiple race candidates available, user must select');
                    // no single candidate — clear any previous active race
                    setActiveRace(null);
                }

                // Notify app about auth change and route to /race
                window.dispatchEvent(new Event('auth-update'));
                navigate('/race', { replace: true });
            } else {
                logger.error('AUTH', 'Login failed', data.msg || 'Unknown error');
                setError(data.msg || 'Login failed');
            }
        } catch (err) {
            logger.error('AUTH', 'Login error', err.message);
            setError(err.message || 'Login failed');
        }
    };

    return (
        <div className="container d-flex align-items-center justify-content-center min-vh-100">
            <div className="card p-4 shadow" style={{ maxWidth: '400px', width: '100%' }}>
                <h2 className="mb-4 text-center">Login</h2>
                <form onSubmit={handleSubmit}>
                    <div className="mb-3">
                        <label htmlFor="email" className="form-label">Email address</label>
                        <input
                            type="email"
                            className="form-control"
                            id="email"
                            placeholder="Enter email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="mb-3">
                        <label htmlFor="password" className="form-label">Password</label>
                        <input
                            type="password"
                            className="form-control"
                            id="password"
                            placeholder="Password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    {error && <div className="alert alert-danger">{error}</div>}
                    <button type="submit" className="btn btn-primary w-100">Login</button>
                    <div className="text-center mt-3">
                        <a href="/forgot-password" className="text-decoration-none">
                            Forgot Password?
                        </a>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default Login;