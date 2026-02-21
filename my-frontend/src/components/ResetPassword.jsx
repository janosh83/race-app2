import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { authApi } from '../services/authApi';

import LanguageSwitcher from './LanguageSwitcher';

function ResetPassword() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setError(t('auth.reset.invalidToken'));
    }
  }, [token, t]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (password !== confirmPassword) {
      setError(t('auth.reset.passwordsNoMatch'));
      return;
    }

    if (password.length < 6) {
      setError(t('auth.reset.passwordTooShort'));
      return;
    }

    setLoading(true);

    try {
      const data = await authApi.resetPassword(token, password);
      setMessage(data.msg || t('auth.reset.success'));
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      setError(err.message || t('auth.reset.failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-md-6">
          <div className="card">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="card-title mb-0">{t('auth.reset.title')}</h2>
                <LanguageSwitcher />
              </div>
              
              {message && (
                <div className="alert alert-success" role="alert">
                  {message}
                </div>
              )}
              
              {error && (
                <div className="alert alert-danger" role="alert">
                  {error}
                </div>
              )}

              {!token ? (
                <div className="alert alert-warning">
                  {t('auth.reset.invalidTokenHelp')}
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <div className="mb-3">
                    <label htmlFor="password" className="form-label">
                      {t('auth.reset.newPassword')}
                    </label>
                    <input
                      type="password"
                      className="form-control"
                      id="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      minLength="6"
                    />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="confirmPassword" className="form-label">
                      {t('auth.reset.confirmPassword')}
                    </label>
                    <input
                      type="password"
                      className="form-control"
                      id="confirmPassword"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={loading}
                      minLength="6"
                    />
                  </div>

                  <div className="d-grid gap-2">
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={loading}
                    >
                      {loading ? t('auth.reset.resetting') : t('auth.reset.submit')}
                    </button>
                    <a href="/login" className="btn btn-link">
                      {t('auth.reset.backToLogin')}
                    </a>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ResetPassword;
