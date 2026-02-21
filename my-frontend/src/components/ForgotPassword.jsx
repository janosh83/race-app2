import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { authApi } from '../services/authApi';

import LanguageSwitcher from './LanguageSwitcher';

function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // HTML5 validation should prevent empty submission, but check just in case
    if (!email) {
      return;
    }
    
    setMessage('');
    setError('');
    setLoading(true);

    try {
      const data = await authApi.requestPasswordReset(email);
      setMessage(data.msg || t('auth.forgot.successDefault'));
      setEmail('');
    } catch (err) {
      setError(err.message || t('auth.forgot.failed'));
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
                <h2 className="card-title mb-0">{t('auth.forgot.title')}</h2>
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

              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label htmlFor="email" className="form-label">
                    {t('auth.forgot.emailLabel')}
                  </label>
                  <input
                    type="email"
                    className="form-control"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                  <div className="form-text">
                    {t('auth.forgot.emailHelp')}
                  </div>
                </div>

                <div className="d-grid gap-2">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    {loading ? t('auth.forgot.sending') : t('auth.forgot.submit')}
                  </button>
                  <a href="/login" className="btn btn-link">
                    {t('auth.forgot.backToLogin')}
                  </a>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;
