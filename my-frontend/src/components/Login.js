import React, { useState } from 'react';
import { selectActiveRace } from '../utils/activeRaceUtils';
import { useTime } from '../contexts/TimeContext';
import { authApi } from '../services/authApi';

function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { setActiveRace, setSignedRaces } = useTime();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            const data = await authApi.login(email, password);
            if (data.access_token) {
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
                    if (candidate) setActiveRace(candidate);
                    else setActiveRace({ race_id: activeRaceId });
                } else {
                    // no single candidate — clear any previous active race
                    setActiveRace(null);
                }

                // Set flag for initial load auto-redirect
                sessionStorage.setItem('initialLoad', 'true');
                
                window.location.reload();
            } else {
                setError(data.msg || 'Login failed');
            }
        } catch (err) {
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