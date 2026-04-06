import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import AdminDashboard from '../Admin/AdminDashboard';
import TeamManagement from '../Admin/TeamManagement';
import Users from '../Admin/Users';

function AdminPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('races'); // 'races' | 'teams' | 'users'

  return (
    <div className="container mt-3">
      <ul className="nav nav-tabs mb-3" role="tablist" aria-label={t('admin.tabs.label')}>
        <li className="nav-item">
          <button
            id="admin-tab-races"
            type="button"
            role="tab"
            aria-selected={tab === 'races'}
            aria-controls="admin-panel-races"
            className={`nav-link ${tab === 'races' ? 'active' : ''}`}
            onClick={() => setTab('races')}
          >
            {t('admin.tabs.races')}
          </button>
        </li>
        <li className="nav-item">
          <button
            id="admin-tab-teams"
            type="button"
            role="tab"
            aria-selected={tab === 'teams'}
            aria-controls="admin-panel-teams"
            className={`nav-link ${tab === 'teams' ? 'active' : ''}`}
            onClick={() => setTab('teams')}
          >
            {t('admin.tabs.teams')}
          </button>
        </li>
        <li className="nav-item">
          <button
            id="admin-tab-users"
            type="button"
            role="tab"
            aria-selected={tab === 'users'}
            aria-controls="admin-panel-users"
            className={`nav-link ${tab === 'users' ? 'active' : ''}`}
            onClick={() => setTab('users')}
          >
            {t('admin.tabs.users')}
          </button>
        </li>
      </ul>

      {tab === 'races' ? (
        <div id="admin-panel-races" role="tabpanel" aria-labelledby="admin-tab-races">
          <AdminDashboard />
        </div>
      ) : tab === 'teams' ? (
        <div id="admin-panel-teams" role="tabpanel" aria-labelledby="admin-tab-teams">
          <TeamManagement />
        </div>
      ) : (
        <div id="admin-panel-users" role="tabpanel" aria-labelledby="admin-tab-users">
          <Users />
        </div>
      )}
    </div>
  );
}

export default AdminPage;
