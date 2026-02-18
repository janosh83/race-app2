import React, { useEffect, useState } from 'react';
import RaceList from './RaceList';
import RaceForm from './RaceForm';
import RegistrationList from './RegistrationList';
import CheckpointList from './CheckpointList';
import TaskList from './TaskList';
import CategoryForm from './CategoryForm';
import Standings from './Standings';
import VisitsList from './VisitsList';
import { adminApi } from '../../services/adminApi';
import LanguageFlagsDisplay from '../LanguageFlagsDisplay';
import { LANGUAGE_LABELS } from '../../config/languages';

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
  const [tasks, setTasks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [translations, setTranslations] = useState([]);
  const [viewingTranslationLang, setViewingTranslationLang] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ui state: creating new race or editing existing
  const [creatingNew, setCreatingNew] = useState(false);
  const [editingRace, setEditingRace] = useState(null);
  const [visitingTeam, setVisitingTeam] = useState(null);
  
  // submenu state for selected race
  const [activeSubmenu, setActiveSubmenu] = useState('checkpoints'); // 'checkpoints', 'registrations', 'progress'

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
      const fetchTranslations = async () => {
        try {
          const data = await adminApi.getRaceTranslations(selected.id);
          setTranslations(Array.isArray(data) ? data : (data?.data || []));
        } catch (e) {
          console.error('Failed to load translations', e);
          setTranslations([]);
        }
      };
      fetchCheckpoints();
      fetchCategories();
      fetchTranslations();
      const fetchTasks = async () => {
        try {
          const data = await adminApi.getTasksByRaceID(selected.id);
          setTasks(Array.isArray(data) ? data : (data?.data || []));
        } catch (e) {
          console.error('Failed to load tasks', e);
          setTasks([]);
        }
      };
      fetchTasks();
    } else {
      setCheckpoints([]);
      setCategories([]);
      setTasks([]);
      setTranslations([]);
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
    setViewingTranslationLang(null);
    setActiveSubmenu('checkpoints'); // reset to first tab
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
                    <h4>Manage: {viewingTranslationLang 
                      ? (translations.find(t => t.language === viewingTranslationLang)?.name || selected.name || selected.title || `#${selected.id}`)
                      : (selected.name || selected.title || `#${selected.id}`)
                    }</h4>
                    <div>
                      <button className="btn btn-sm btn-outline-primary me-2" onClick={handleEdit}>Edit race</button>
                      <button className="btn btn-sm btn-outline-secondary" onClick={() => { setSelected(null); }}>Close</button>
                    </div>
                  </div>

                  {/* Description and time constraints */}
                  <div className="card mb-3">
                    <div className="card-body">
                      {(() => {
                        const desc = viewingTranslationLang 
                          ? (translations.find(t => t.language === viewingTranslationLang)?.description || selected.description)
                          : selected.description;
                        return desc ? (
                          <p className="mb-2">{desc}</p>
                        ) : (
                          <p className="mb-2 text-muted">No description</p>
                        );
                      })()}

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
                        <div className="mt-2 pt-2 border-top">
                          <div>
                            <strong>Default language:</strong>{' '}
                            {selected.default_language ? `${LANGUAGE_LABELS[selected.default_language] || selected.default_language} (${selected.default_language})` : 'Not set'}
                          </div>
                          <div>
                            <strong>Supported languages:</strong>{' '}
                            {selected.supported_languages && selected.supported_languages.length > 0 
                              ? selected.supported_languages.map(lang => `${LANGUAGE_LABELS[lang] || lang} (${lang})`).join(', ')
                              : 'None'}
                          </div>
                          <div className="mt-2">
                            <div className="d-flex align-items-center gap-2">
                              <strong>Existing translations:</strong>
                              {translations && translations.length > 0 ? (
                                <LanguageFlagsDisplay 
                                  languages={translations.map(t => t.language)}
                                  selectedLanguage={viewingTranslationLang}
                                  onClick={(lang) => setViewingTranslationLang(viewingTranslationLang === lang ? null : lang)}
                                />
                              ) : (
                                <span className="text-muted">None yet</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Submenu tabs */}
                  <ul className="nav nav-tabs mb-3">
                    <li className="nav-item">
                      <button 
                        className={`nav-link ${activeSubmenu === 'checkpoints' ? 'active' : ''}`}
                        onClick={() => setActiveSubmenu('checkpoints')}
                      >
                        Checkpoints & Tasks
                      </button>
                    </li>
                    <li className="nav-item">
                      <button 
                        className={`nav-link ${activeSubmenu === 'registrations' ? 'active' : ''}`}
                        onClick={() => setActiveSubmenu('registrations')}
                      >
                        Registrations & Categories
                      </button>
                    </li>
                    <li className="nav-item">
                      <button 
                        className={`nav-link ${activeSubmenu === 'progress' ? 'active' : ''}`}
                        onClick={() => setActiveSubmenu('progress')}
                      >
                        Visits & Results
                      </button>
                    </li>
                  </ul>

                  {/* Submenu content */}
                  {activeSubmenu === 'checkpoints' && (
                    <>
                    <CheckpointList
                      checkpoints={checkpoints}
                      raceId={selected.id}
                      supportedLanguages={selected.supported_languages || []}
                      onRemove={(id) => setCheckpoints(prev => prev.filter(cp => cp.id !== id))}
                      onImported={(items) => setCheckpoints(prev => [...items, ...prev])}
                      onUpdate={(id, updatedData) => setCheckpoints(prev => prev.map(cp => cp.id === id ? { ...cp, ...updatedData } : cp))}
                    />
                    <TaskList
                      tasks={tasks}
                      raceId={selected.id}
                      supportedLanguages={selected.supported_languages || []}
                      onRemove={(id) => setTasks(prev => prev.filter(t => t.id !== id))}
                      onImported={(items) => setTasks(prev => [...items, ...prev])}
                      onUpdate={(id, updatedData) => setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updatedData } : t))}
                    />
                  </>)
                  }

                  {activeSubmenu === 'registrations' && (
                    <>
                      <RegistrationList raceId={selected.id} />
                      <CategoryForm raceId={selected.id} />
                    </>
                  )}

                  {activeSubmenu === 'progress' && (
                    <>
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





