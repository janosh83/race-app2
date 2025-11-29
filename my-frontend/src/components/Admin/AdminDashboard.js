import React, { useEffect, useState } from 'react';
import RaceList from './RaceList';
import RaceForm from './RaceForm';
import RegistrationList from './RegistrationList';
import CheckpointList from './CheckpointList';
import CategoryForm from './CategoryForm';
import Standings from './Standings';
import VisitsList from './VisitsList';
import { adminApi } from '../../services/adminApi';

function formatIso(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

function AdminDashboard() {
  const [races, setRaces] = useState([]);
  const [selected, setSelected] = useState(null);
  const [checkpoints, setCheckpoints] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ui state: creating new race or editing existing
  const [creatingNew, setCreatingNew] = useState(false);
  const [editingRace, setEditingRace] = useState(null);
  const [visitingTeam, setVisitingTeam] = useState(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    adminApi.listRaces()
      .then(res => {
        if (!mounted) return;
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

  useEffect(() => {
    if (selected) {
      const fetchCheckpoints = async () => {
        try {
          const data = await adminApi.getCheckpointsByRaceID(selected.id);
          setCheckpoints(Array.isArray(data) ? data : (data?.data || []));
        } catch (e) {
          console.error('Failed to load checkpoints', e);
          setCheckpoints([]);
        }
      };
      const fetchCategories = async () => {
        try {
          const data = await adminApi.listCategories();
          setCategories(Array.isArray(data) ? data : (data?.data || []));
        } catch (e) {
          console.error('Failed to load categories', e);
          setCategories([]);
        }
      };
      fetchCheckpoints();
      fetchCategories();
    } else {
      setCheckpoints([]);
      setCategories([]);
    }
  }, [selected]);

  const handleNewClick = () => {
    setSelected(null);
    setEditingRace(null);
    setCreatingNew(true);
  };

  const handleManage = (race) => {
    setSelected(race);
    setCreatingNew(false);
    setEditingRace(null);
  };

  const handleSavedRace = (race, wasNew = true) => {
    // race: saved race object from server
    setRaces(prev => {
      if (wasNew) return [race, ...prev];
      return prev.map(r => (r.id === race.id ? race : r));
    });
    setSelected(race);
    setCreatingNew(false);
    setEditingRace(null);
  };

  const handleEdit = () => {
    if (!selected) return;
    setEditingRace(selected);
    setCreatingNew(false);
  };

  return (
    <div className="container mt-4">
      <h2>Admin</h2>

      {loading && <div>Loading races…</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="row">
        <div className="col-md-4">
          <RaceList races={races} onSelect={handleManage} />
          <div className="mt-2 d-grid">
            <button className="btn btn-success" onClick={handleNewClick}>New race</button>
          </div>
        </div>

        <div className="col-md-8">
          {/* show form when creating or editing */}
          {(creatingNew || editingRace) ? (
            <RaceForm
              race={editingRace}
              onSaved={(r) => handleSavedRace(r, !editingRace)}
              onCancel={() => { setCreatingNew(false); setEditingRace(null); }}
            />
          ) : (
            <>
              {selected ? (
                <>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h4>Manage: {selected.name || selected.title || `#${selected.id}`}</h4>
                    <div>
                      <button className="btn btn-sm btn-outline-primary me-2" onClick={handleEdit}>Edit race</button>
                      <button className="btn btn-sm btn-outline-secondary" onClick={() => { setSelected(null); }}>Close</button>
                    </div>
                  </div>

                  {/* Description and time constraints */}
                  <div className="card mb-3">
                    <div className="card-body">
                      {selected.description ? (
                        <p className="mb-2">{selected.description}</p>
                      ) : (
                        <p className="mb-2 text-muted">No description</p>
                      )}

                      <div className="small text-muted">
                        <div>
                          <strong>Showing checkpoints:</strong>{' '}
                          {formatIso(selected.start_showing_checkpoints_at ?? selected.start_showing_checkpoints ?? selected.start_showing)}
                          {' — '}
                          {formatIso(selected.end_showing_checkpoints_at ?? selected.end_showing_checkpoints ?? selected.end_showing)}
                        </div>
                        <div>
                          <strong>Logging window:</strong>{' '}
                          {formatIso(selected.start_logging_at ?? selected.start_logging)}
                          {' — '}
                          {formatIso(selected.end_logging_at ?? selected.end_logging)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <CheckpointList
                    checkpoints={checkpoints}
                    raceId={selected.id}
                    onRemove={(id) => setCheckpoints(prev => prev.filter(cp => cp.id !== id))}
                    onImported={(items) => setCheckpoints(prev => [...items, ...prev])}
                  />
                  <RegistrationList raceId={selected.id} />
                  <CategoryForm raceId={selected.id} />
                  <Standings raceId={selected.id} onTeamClick={(teamId) => setVisitingTeam(teamId)} />
                  {visitingTeam && (
                    <div className="card mt-3">
                      <div className="card-body">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <h5 className="mb-0">Visits — team #{visitingTeam}</h5>
                          <button className="btn btn-sm btn-outline-secondary" onClick={() => setVisitingTeam(null)}>Close</button>
                        </div>
                        <VisitsList teamId={visitingTeam} raceId={selected.id}/>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="mt-3 text-muted">Select a race or click "New race" to create one</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;