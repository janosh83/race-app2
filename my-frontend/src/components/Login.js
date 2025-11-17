import React, { useState } from 'react';

function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const apiUrl = process.env.REACT_APP_API_URL;

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
                
                // redirect to active race if available
                const signed = data.signed_races || [];
                let activeRaceId = null;
                if (signed.length > 0) {
                    const first = signed[0];
                    activeRaceId = (first && typeof first === 'object') ? (first.id || first) : first;
                }

                if (activeRaceId) {
                    // set desired section and race for the SPA
                    localStorage.setItem('activeSection', 'activeRace');
                    localStorage.setItem('activeRaceId', String(activeRaceId));
                } 
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