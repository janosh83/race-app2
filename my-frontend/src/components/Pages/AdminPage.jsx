import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import AdminDashboard from '../Admin/AdminDashboard';
import TeamManagement from '../Admin/TeamManagement';
import Users from '../Admin/Users';

const TABS = ['races', 'teams', 'users'];

// The admin area: races (default), teams and users. The tab is kept in the URL
// (?tab=teams) so reload and Back return to it.
function AdminPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab = TABS.includes(tabParam) ? tabParam : 'races';

  const selectTab = (next) => {
    // Race-specific params belong to the races tab only.
    setSearchParams(next === 'races' ? {} : { tab: next });
  };

  return (
    <div>
      <ul className="nav nav-tabs mb-3">
        {TABS.map((key) => (
          <li className="nav-item" key={key}>
            <button
              type="button"
              className={`nav-link ${tab === key ? 'active' : ''}`}
              aria-current={tab === key ? 'page' : undefined}
              onClick={() => selectTab(key)}
            >
              {t(`admin.sections.${key}`)}
            </button>
          </li>
        ))}
      </ul>

      {tab === 'races' ? (
        <AdminDashboard />
      ) : tab === 'teams' ? (
        <TeamManagement />
      ) : (
        <Users />
      )}
    </div>
  );
}

export default AdminPage;
