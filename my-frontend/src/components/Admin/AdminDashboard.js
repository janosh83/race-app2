import React, { useEffect, useState } from 'react';
import RaceList from './RaceList';
import RaceForm from './RaceForm';
import RegistrationList from './RegistrationList';
import { adminApi } from '../../services/adminApi';

function AdminDashboard(){
  const [races, setRaces] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    adminApi.listRaces()
      .then(res => {
        console.log('adminApi.listRaces ->', res);
        if (!mounted) return;
        // if API returns {data: [...]}, adapt here: setRaces(res.data || res)
        setRaces(Array.isArray(res) ? res : (res?.data || []));
      })
      .catch(err => {
        console.error('Failed to load races', err);
        if (!mounted) return;
        setError('Failed to load races');
      })
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, []);

  return (
    <div className="container mt-4">
      <h2>Admin</h2>

      {loading && <div>Loading races…</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="row">
        <div className="col-md-5">
          <RaceList races={races} onSelect={setSelected} />
        </div>
        <div className="col-md-7">
          <RaceForm onCreated={(r) => setRaces(prev => [r, ...prev])} />
          {selected ? <RegistrationList race={selected} /> : <div className="mt-3 text-muted">Select a race to manage registrations</div>}
        </div>
      </div>
    </div>
  );
}
export default AdminDashboard;