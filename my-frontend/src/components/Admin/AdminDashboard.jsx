import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LANGUAGE_LABELS } from '../../config/languages';
import { adminApi } from '../../services/adminApi';
import { logger } from '../../utils/logger';
import LanguageFlagsDisplay from '../LanguageFlagsDisplay';

import CategoryForm from './CategoryForm';
import CheckpointList from './CheckpointList';
import RaceForm from './RaceForm';
import RaceList from './RaceList';
import RegistrationList from './RegistrationList';
import Standings from './Standings';
import TaskList from './TaskList';
import VisitsList from './VisitsList';


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
  const { t } = useTranslation();
  const [races, setRaces] = useState([]);
  const [selected, setSelected] = useState(null);
  const [checkpoints, setCheckpoints] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [, setCategories] = useState([]);
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
        logger.error('ADMIN', 'Failed to load races', err);
        if (!mounted) return;
        setError(t('admin.dashboard.errorLoadRaces'));
      })
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [t]);

  useEffect(() => {
    if (selected) {
      const fetchCheckpoints = async () => {
        try {
          const data = await adminApi.getCheckpointsByRaceID(selected.id);
          setCheckpoints(Array.isArray(data) ? data : (data?.data || []));
        } catch (e) {
          logger.error('ADMIN', 'Failed to load checkpoints', e);
          setCheckpoints([]);
        }
      };
      const fetchCategories = async () => {
        try {
          const data = await adminApi.listCategories();
          setCategories(Array.isArray(data) ? data : (data?.data || []));
        } catch (e) {
          logger.error('ADMIN', 'Failed to load categories', e);
          setCategories([]);
        }
      };
      const fetchTranslations = async () => {
        try {
          const data = await adminApi.getRaceTranslations(selected.id);
          setTranslations(Array.isArray(data) ? data : (data?.data || []));
        } catch (e) {
          logger.error('ADMIN', 'Failed to load translations', e);
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
          logger.error('ADMIN', 'Failed to load tasks', e);
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
      <h2>{t('admin.dashboard.title')}</h2>

      {loading && <div>{t('admin.dashboard.loadingRaces')}</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="row">
        <div className="col-md-4">
          <RaceList races={races} onSelect={handleManage} />
          <div className="mt-2 d-grid">
            <button className="btn btn-success" onClick={handleNewClick}>{t('admin.dashboard.newRace')}</button>
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
                    <h4>{t('admin.dashboard.manage', {
                      name: viewingTranslationLang
                      ? (translations.find(t => t.language === viewingTranslationLang)?.name || selected.name || selected.title || `#${selected.id}`)
                      : (selected.name || selected.title || `#${selected.id}`)
                    })}</h4>
                    <div>
                      <button className="btn btn-sm btn-outline-primary me-2" onClick={handleEdit}>{t('admin.dashboard.editRace')}</button>
                      <button className="btn btn-sm btn-outline-secondary" onClick={() => { setSelected(null); }}>{t('admin.dashboard.close')}</button>
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
                          <p className="mb-2 text-muted">{t('admin.dashboard.noDescription')}</p>
                        );
                      })()}

                      <div className="small text-muted">
                        <div>
                          <strong>{t('admin.dashboard.showingCheckpoints')}:</strong>{' '}
                          {formatIso(selected.start_showing_checkpoints_at ?? selected.start_showing_checkpoints ?? selected.start_showing)}
                          {' — '}
                          {formatIso(selected.end_showing_checkpoints_at ?? selected.end_showing_checkpoints ?? selected.end_showing)}
                        </div>
                        <div>
                          <strong>{t('admin.dashboard.loggingWindow')}:</strong>{' '}
                          {formatIso(selected.start_logging_at ?? selected.start_logging)}
                          {' — '}
                          {formatIso(selected.end_logging_at ?? selected.end_logging)}
                        </div>
                        <div className="mt-2 pt-2 border-top">
                          <div>
                            <strong>{t('admin.dashboard.defaultLanguage')}:</strong>{' '}
                            {selected.default_language ? `${LANGUAGE_LABELS[selected.default_language] || selected.default_language} (${selected.default_language})` : t('admin.dashboard.notSet')}
                          </div>
                          <div>
                            <strong>{t('admin.dashboard.supportedLanguages')}:</strong>{' '}
                            {selected.supported_languages && selected.supported_languages.length > 0
                              ? selected.supported_languages.map(lang => `${LANGUAGE_LABELS[lang] || lang} (${lang})`).join(', ')
                              : t('admin.dashboard.none')}
                          </div>
                          <div className="mt-2">
                            <div className="d-flex align-items-center gap-2">
                              <strong>{t('admin.dashboard.existingTranslations')}:</strong>
                              {translations && translations.length > 0 ? (
                                <LanguageFlagsDisplay
                                  languages={translations.map(t => t.language)}
                                  selectedLanguage={viewingTranslationLang}
                                  onClick={(lang) => setViewingTranslationLang(viewingTranslationLang === lang ? null : lang)}
                                />
                              ) : (
                                <span className="text-muted">{t('admin.dashboard.noneYet')}</span>
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
                        {t('admin.dashboard.tabCheckpointsTasks')}
                      </button>
                    </li>
                    <li className="nav-item">
                      <button
                        className={`nav-link ${activeSubmenu === 'registrations' ? 'active' : ''}`}
                        onClick={() => setActiveSubmenu('registrations')}
                      >
                        {t('admin.dashboard.tabRegistrationsCategories')}
                      </button>
                    </li>
                    <li className="nav-item">
                      <button
                        className={`nav-link ${activeSubmenu === 'progress' ? 'active' : ''}`}
                        onClick={() => setActiveSubmenu('progress')}
                      >
                        {t('admin.dashboard.tabVisitsResults')}
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
                              <h5 className="mb-0">{t('admin.dashboard.visitsTeam', { id: visitingTeam })}</h5>
                              <button className="btn btn-sm btn-outline-secondary" onClick={() => setVisitingTeam(null)}>{t('admin.dashboard.close')}</button>
                            </div>
                            <VisitsList teamId={visitingTeam} raceId={selected.id}/>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              ) : (
                <div className="mt-3 text-muted">{t('admin.dashboard.selectRacePrompt')}</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;





