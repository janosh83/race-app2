import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { timeStateForRace } from '../../contexts/TimeContext';
import { adminApi } from '../../services/adminApi';
import { logger } from '../../utils/logger';
import { getPhasePresentation } from '../../utils/racePhase';

import './AdminDashboard.css';
import CategoryForm from './CategoryForm';
import CheckpointList from './CheckpointList';
import PaymentAttemptsSummary from './PaymentAttemptsSummary';
import RaceForm from './RaceForm';
import RaceList from './RaceList';
import RaceOverview from './RaceOverview';
import RaceStatistics from './RaceStatistics';
import RegistrationList from './RegistrationList';
import Standings from './Standings';
import TaskList from './TaskList';
import TeamPathsMap from './TeamPathsMap';
import VisitsList from './VisitsList';

// Sections of an opened race, in tab order, with their URL value and label.
export const RACE_SECTIONS = [
  { key: 'overview', label: 'admin.dashboard.tabOverview' },
  { key: 'checkpoints', label: 'admin.dashboard.tabCheckpointsTasks' },
  { key: 'registrations', label: 'admin.dashboard.tabRegistrationsCategories' },
  { key: 'payments', label: 'admin.dashboard.tabPaymentAttemptsSummary' },
  { key: 'results', label: 'admin.dashboard.tabVisitsResults' },
  { key: 'paths', label: 'admin.dashboard.tabTeamPaths' },
  { key: 'statistics', label: 'admin.dashboard.tabStatistics' },
];
const SECTION_KEYS = RACE_SECTIONS.map(s => s.key);

// Below Bootstrap's lg breakpoint a team's visits replace the standings
// instead of sitting next to them (keep in sync with AdminDashboard.css).
const NARROW_RESULTS_QUERY = '(max-width: 991.98px)';

// The opened race, its section and the team whose visits are shown live in
// the URL (?race=1&section=results&team=5), so reload, Back and shared links
// keep the place, e.g. while reviewing photos at the finish.
function AdminDashboard() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [races, setRaces] = useState([]);
  const [checkpoints, setCheckpoints] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [translations, setTranslations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ui state: creating new race or editing the opened one
  const [creatingNew, setCreatingNew] = useState(false);
  const [editingRace, setEditingRace] = useState(null);
  const [standingsRefreshVersion, setStandingsRefreshVersion] = useState(0);
  const [teamOrder, setTeamOrder] = useState([]); // standings order, for previous/next team
  const teamVisitsDetailsRef = useRef(null);

  const selectedId = searchParams.get('race');
  const selected = selectedId ? races.find(r => String(r.id) === selectedId) ?? null : null;
  const sectionParam = searchParams.get('section');
  const activeSection = SECTION_KEYS.includes(sectionParam) ? sectionParam : 'overview';
  const visitingTeam = searchParams.get('team');

  const updateParams = (changes) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) => {
      if (value === null || value === undefined) next.delete(key);
      else next.set(key, String(value));
    });
    setSearchParams(next);
  };

  // On phones the visits replace the standings. After tapping a team far
  // down a long table the page may stay scrolled past the panel's top, so
  // bring its header back. On wide screens the visits sit next to the
  // standings and nothing needs to move.
  useEffect(() => {
    const panel = teamVisitsDetailsRef.current;
    if (activeSection !== 'results' || !visitingTeam || !panel) return;
    if (!window.matchMedia?.(NARROW_RESULTS_QUERY).matches) return;
    if (panel.getBoundingClientRect().top < 0) panel.scrollIntoView?.({ block: 'start' });
    // selected: the panel only exists once the races have loaded.
  }, [activeSection, visitingTeam, selected?.id]);

  // Keep the active section tab visible in the sideways-scrolling tab row.
  const sectionTabsRef = useRef(null);
  useEffect(() => {
    const strip = sectionTabsRef.current;
    const active = strip?.querySelector('.nav-link.active');
    if (!strip || !active) return;
    const left = active.offsetLeft - (strip.clientWidth - active.offsetWidth) / 2;
    strip.scrollLeft = Math.max(0, left);
  }, [activeSection, selected?.id, editingRace]);

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

  const selectedRaceId = selected?.id ?? null;
  useEffect(() => {
    if (selectedRaceId === null) {
      setCheckpoints([]);
      setTasks([]);
      setTranslations([]);
      return;
    }
    const load = async (request, setter, label) => {
      try {
        const data = await request();
        setter(Array.isArray(data) ? data : (data?.data || []));
      } catch (e) {
        logger.error('ADMIN', `Failed to load ${label}`, e);
        setter([]);
      }
    };
    load(() => adminApi.getCheckpointsByRaceID(selectedRaceId), setCheckpoints, 'checkpoints');
    load(() => adminApi.getTasksByRaceID(selectedRaceId), setTasks, 'tasks');
    load(() => adminApi.getRaceTranslations(selectedRaceId), setTranslations, 'translations');
  }, [selectedRaceId]);

  const handleNewClick = () => {
    updateParams({ race: null, section: null, team: null });
    setEditingRace(null);
    setCreatingNew(true);
  };

  const handleManage = (race) => {
    setCreatingNew(false);
    setEditingRace(null);
    updateParams({ race: race.id, section: null, team: null });
  };

  const handleBackToRaces = () => {
    setCreatingNew(false);
    setEditingRace(null);
    updateParams({ race: null, section: null, team: null });
  };

  const handleSavedRace = (race, wasNew = true) => {
    setRaces(prev => {
      if (wasNew) return [race, ...prev];
      return prev.map(r => (r.id === race.id ? race : r));
    });
    setCreatingNew(false);
    setEditingRace(null);
    updateParams({ race: race.id, section: wasNew ? null : sectionParam, team: null });
  };

  const backLink = (
    <button type="button" className="btn btn-link px-0 mb-1 admin-back-link" onClick={handleBackToRaces}>
      ‹ {t('admin.dashboard.backToRaces')}
    </button>
  );

  if (creatingNew) {
    return (
      <div className="admin-dashboard">
        {backLink}
        <RaceForm
          race={null}
          onSaved={(r) => handleSavedRace(r, true)}
          onCancel={() => setCreatingNew(false)}
        />
      </div>
    );
  }

  if (!selected) {
    return (
      <div className="admin-dashboard">
        {loading && <div>{t('admin.dashboard.loadingRaces')}</div>}
        {error && <div className="alert alert-danger">{error}</div>}
        {!loading && selectedId && !error && (
          <div className="alert alert-warning">{t('admin.dashboard.raceNotFound')}</div>
        )}
        <RaceList races={races} onSelect={handleManage} onNew={handleNewClick} />
      </div>
    );
  }

  const phase = getPhasePresentation(t, timeStateForRace(Date.now(), selected).state);

  const visitingIndex = teamOrder.findIndex(row => row.id === visitingTeam);
  const visitingRow = visitingIndex >= 0 ? teamOrder[visitingIndex] : null;
  const previousTeam = visitingIndex > 0 ? teamOrder[visitingIndex - 1] : null;
  const nextTeam = visitingIndex >= 0 && visitingIndex < teamOrder.length - 1 ? teamOrder[visitingIndex + 1] : null;
  const visitsTitle = visitingRow
    ? t('admin.dashboard.visitsTeamName', { name: visitingRow.name })
    : t('admin.dashboard.visitsTeam', { id: visitingTeam });

  return (
    <div className="admin-dashboard">
      {backLink}
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
        <div className="d-flex align-items-center flex-wrap gap-2">
          <h2 className="h4 mb-0">{selected.name || selected.title || `#${selected.id}`}</h2>
          <span className={`badge rounded-pill ${phase.toneClass}`}>{phase.value}</span>
        </div>
        {!editingRace && (
          <button className="btn btn-sm btn-outline-primary" onClick={() => setEditingRace(selected)}>
            {t('admin.dashboard.editRace')}
          </button>
        )}
      </div>

      {editingRace ? (
        <RaceForm
          race={editingRace}
          onSaved={(r) => handleSavedRace(r, false)}
          onCancel={() => setEditingRace(null)}
        />
      ) : (
        <>
          <ul className="nav nav-tabs mb-3 admin-section-tabs" ref={sectionTabsRef}>
            {RACE_SECTIONS.map(({ key, label }) => (
              <li className="nav-item" key={key}>
                <button
                  type="button"
                  className={`nav-link ${activeSection === key ? 'active' : ''}`}
                  aria-current={activeSection === key ? 'page' : undefined}
                  onClick={() => updateParams({ section: key === 'overview' ? null : key, team: null })}
                >
                  {t(label)}
                </button>
              </li>
            ))}
          </ul>

          {activeSection === 'overview' && (
            <RaceOverview race={selected} translations={translations} checkpoints={checkpoints} tasks={tasks} />
          )}

          {activeSection === 'checkpoints' && (
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
                onRemove={(id) => setTasks(prev => prev.filter(task => task.id !== id))}
                onImported={(items) => setTasks(prev => [...items, ...prev])}
                onUpdate={(id, updatedData) => setTasks(prev => prev.map(task => task.id === id ? { ...task, ...updatedData } : task))}
              />
            </>
          )}

          {activeSection === 'registrations' && (
            <>
              <RegistrationList raceId={selected.id} race={selected} />
              <CategoryForm raceId={selected.id} supportedLanguages={selected.supported_languages || []} />
            </>
          )}

          {activeSection === 'payments' && (
            <PaymentAttemptsSummary raceId={selected.id} />
          )}

          {activeSection === 'results' && (
            <div className={`admin-results${visitingTeam ? ' admin-results-with-team' : ''}`}>
              <div className="admin-results-standings">
                <Standings
                  raceId={selected.id}
                  refreshVersion={standingsRefreshVersion}
                  selectedTeamId={visitingTeam}
                  compact={Boolean(visitingTeam)}
                  onTeamClick={(teamId) => updateParams({ team: teamId })}
                  onOpenRegistrations={() => updateParams({ section: 'registrations', team: null })}
                  onLoaded={(rows) => setTeamOrder(rows.map(row => ({
                    id: String(row.teamId),
                    name: row.teamName,
                    position: row.positionLabel,
                    totalPoints: row.totalPoints,
                  })))}
                />
                {!visitingTeam && teamOrder.length > 0 && (
                  <p className="small text-muted mb-0">{t('admin.dashboard.pickTeamHint')}</p>
                )}
              </div>
              {visitingTeam && (
                <section className="card admin-results-visits" ref={teamVisitsDetailsRef} aria-label={visitsTitle}>
                  <div className="admin-visits-header">
                    <button
                      type="button"
                      className="btn btn-link px-0 py-0 admin-back-link d-lg-none"
                      onClick={() => updateParams({ team: null })}
                    >
                      ‹ {t('admin.dashboard.backToStandings')}
                    </button>
                    <div className="d-flex align-items-center gap-2">
                      <div className="flex-grow-1 min-w-0">
                        <h3 className="h5 mb-0 text-truncate">{visitsTitle}</h3>
                        {visitingRow && (
                          <div className="small text-muted">
                            {t('admin.dashboard.teamPlacement', { position: visitingRow.position, points: visitingRow.totalPoints })}
                          </div>
                        )}
                      </div>
                      <div className="btn-group btn-group-sm" role="group" aria-label={t('admin.dashboard.switchTeam')}>
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          disabled={!previousTeam}
                          title={previousTeam?.name}
                          aria-label={t('admin.dashboard.previousTeam')}
                          onClick={() => updateParams({ team: previousTeam.id })}
                        >
                          ‹
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          disabled={!nextTeam}
                          title={nextTeam?.name}
                          aria-label={t('admin.dashboard.nextTeam')}
                          onClick={() => updateParams({ team: nextTeam.id })}
                        >
                          ›
                        </button>
                      </div>
                      <button
                        type="button"
                        className="btn-close d-none d-lg-inline-block"
                        aria-label={t('admin.dashboard.close')}
                        onClick={() => updateParams({ team: null })}
                      />
                    </div>
                  </div>
                  <div className="card-body">
                    <VisitsList
                      teamId={visitingTeam}
                      raceId={selected.id}
                      onDataChanged={() => setStandingsRefreshVersion(prev => prev + 1)}
                    />
                  </div>
                </section>
              )}
            </div>
          )}

          {activeSection === 'paths' && (
            <TeamPathsMap raceId={selected.id} />
          )}

          {activeSection === 'statistics' && (
            <RaceStatistics raceId={selected.id} />
          )}
        </>
      )}
    </div>
  );
}

export default AdminDashboard;
