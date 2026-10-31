import React from 'react';
import { useTranslation } from 'react-i18next';

import './AuthBrand.css';

// Logo and app name above the login / password screens, matching the black
// brand top bar inside the app.
function AuthBrand() {
  const { t } = useTranslation();

  return (
    <div className="auth-brand">
      <img src="/logo192.png" alt="" width="72" height="72" className="auth-brand-logo" />
      <div className="auth-brand-name">{t('nav.brand')}</div>
    </div>
  );
}

export default AuthBrand;
