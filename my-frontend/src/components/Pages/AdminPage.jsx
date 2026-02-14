import React, { useState } from 'react';
import AdminDashboard from '../Admin/AdminDashboard';
import Users from '../Admin/Users';

function AdminPage() {
  const [tab, setTab] = useState('races'); // 'races' | 'users'

  return (
    <div className="container mt-3">
      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button className={`nav-link ${tab === 'races' ? 'active' : ''}`} onClick={() => setTab('races')}>
            Races
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>
            Users
          </button>
        </li>
      </ul>

      {tab === 'races' ? (
        <AdminDashboard />
      ) : (
        <Users />
      )}
    </div>
  );
}

export default AdminPage;
