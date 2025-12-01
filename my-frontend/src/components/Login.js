import React, { useState } from 'react';
import { selectActiveRace } from '../utils/activeRaceUtils';
import { useTime } from '../contexts/TimeContext';

function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const apiUrl = process.env.REACT_APP_API_URL;
    const { setActiveRace } = useTime();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            const response = await fetch(`${apiUrl}/auth/login/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const data = await response.json();
            if (response.ok && data.access_token) {
                localStorage.setItem('accessToken', data.access_token);
                localStorage.setItem('user', JSON.stringify(data.user));
                localStorage.setItem('signedRaces', JSON.stringify(data.signed_races));

                // choose active race (if exactly one candidate)
                const { activeRaceId, candidates } = selectActiveRace(data.signed_races || []);

                if (activeRaceId) {
                    // find the full signed_race object to persist (may contain team_id)
                    const candidate = (data.signed_races || []).find(r => (r.race_id ?? r.id ?? r.raceId) === activeRaceId) || null;
                    if (candidate) setActiveRace(candidate);
                    else setActiveRace({ race_id: activeRaceId });
                    localStorage.setItem('activeSection', 'activeRace');
                } else {
                    // no single candidate — clear any previous active race
                    setActiveRace(null);
                }

                // multiple or zero active races -> ask user to choose
                //if (candidates.length > 1) {
                //    localStorage.setItem('activeSection', 'selectRace');
                //    localStorage.setItem('raceCandidates', JSON.stringify(candidates));
                //}
                window.location.reload();
            } else {
                setError(data.msg || 'Login failed');
            }
        } catch (err) {
            setError('Network error');
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
                </form>
            </div>
        </div>
    );
}

export default Login;