import L from 'leaflet';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import 'leaflet/dist/leaflet.css';
import { adminApi } from '../../services/adminApi';
import { logger } from '../../utils/logger';

const API_KEY = import.meta.env.VITE_MAPY_API_KEY;
const DEFAULT_CENTER = [49.8729317, 14.8981184];

// Spread hues by the golden angle so neighbouring teams get clearly different colors.
export function getTeamColor(index) {
  const hue = Math.round((index * 137.508) % 360);
  const lightness = index % 2 === 0 ? 42 : 34;
  return `hsl(${hue}, 75%, ${lightness}%)`;
}

// Backend stores naive UTC timestamps; treat values without a zone as UTC.
function formatVisitTime(iso) {
  if (!iso) return '—';
  const hasZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso);
  const date = new Date(hasZone ? iso : `${iso}Z`);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

function createTextElement(tag, text, className) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

export function buildTeamPaths(teams, checkpointsById) {
  return teams.map((team, index) => {
    const points = (team.visits || [])
      .map(visit => {
        const checkpoint = checkpointsById.get(visit.checkpoint_id);
        if (!checkpoint) return null;
        return { ...visit, checkpoint, latLng: [checkpoint.latitude, checkpoint.longitude] };
      })
      .filter(Boolean);
    return { ...team, color: getTeamColor(index), points };
  });
}

export default function TeamPathsMap({ raceId }) {
  const { t } = useTranslation();
  const [data, setData] = useState({ checkpoints: [], teams: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hiddenTeamIds, setHiddenTeamIds] = useState(() => new Set());
  const [highlightedTeamId, setHighlightedTeamId] = useState(null);
  const [reloadVersion, setReloadVersion] = useState(0);

  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const checkpointLayerRef = useRef(null);
  const pathLayerRef = useRef(null);
  const fittedRaceIdRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    if (!raceId) return undefined;

    setLoading(true);
    setError(null);
    adminApi.getRaceTeamPaths(raceId)
      .then(payload => {
        if (!mounted) return;
        setData({
          checkpoints: Array.isArray(payload?.checkpoints) ? payload.checkpoints : [],
          teams: Array.isArray(payload?.teams) ? payload.teams : [],
        });
      })
      .catch(err => {
        logger.error('ADMIN', 'Failed to load team paths', err);
        if (!mounted) return;
        setError(err?.message || t('admin.teamPaths.errorLoad'));
        setData({ checkpoints: [], teams: [] });
      })
      .finally(() => mounted && setLoading(false));

    return () => { mounted = false; };
  }, [raceId, reloadVersion, t]);

  useEffect(() => {
    setHiddenTeamIds(new Set());
    setHighlightedTeamId(null);
    fittedRaceIdRef.current = null;
  }, [raceId]);

  const checkpointsById = useMemo(
    () => new Map(data.checkpoints.map(cp => [cp.id, cp])),
    [data.checkpoints],
  );

  const teamPaths = useMemo(
    () => buildTeamPaths(data.teams, checkpointsById),
    [data.teams, checkpointsById],
  );

  const visitCountByCheckpoint = useMemo(() => {
    const counts = new Map();
    teamPaths.forEach(team => team.points.forEach(point => {
      counts.set(point.checkpoint_id, (counts.get(point.checkpoint_id) || 0) + 1);
    }));
    return counts;
  }, [teamPaths]);

  // Initialise the map once.
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return undefined;

    const map = L.map(mapRef.current).setView(DEFAULT_CENTER, 13);
    L.tileLayer(`https://api.mapy.com/v1/maptiles/basic/256/{z}/{x}/{y}?apikey=${API_KEY}`, {
      minZoom: 0,
      maxZoom: 19,
      attribution: '<a href="https://api.mapy.com/copyright" target="_blank">&copy; Seznam.cz a.s. a další</a>',
    }).addTo(map);

    checkpointLayerRef.current = L.layerGroup().addTo(map);
    pathLayerRef.current = L.layerGroup().addTo(map);
    mapInstance.current = map;

    return () => {
      map.remove();
      mapInstance.current = null;
      checkpointLayerRef.current = null;
      pathLayerRef.current = null;
    };
  }, []);

  // Checkpoint markers + fit the view to the race area on first load.
  useEffect(() => {
    const map = mapInstance.current;
    const layer = checkpointLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    data.checkpoints.forEach(cp => {
      const visits = visitCountByCheckpoint.get(cp.id) || 0;
      L.circleMarker([cp.latitude, cp.longitude], {
        radius: 7,
        color: '#343a40',
        weight: 2,
        fillColor: visits > 0 ? '#ffffff' : '#adb5bd',
        fillOpacity: 1,
      })
        .bindTooltip(createTextElement('span', t('admin.teamPaths.checkpointTooltip', { title: cp.title, count: visits })))
        .addTo(layer);
    });

    if (data.checkpoints.length > 0 && fittedRaceIdRef.current !== raceId) {
      map.fitBounds(data.checkpoints.map(cp => [cp.latitude, cp.longitude]), { padding: [30, 30] });
      fittedRaceIdRef.current = raceId;
    }
  }, [data.checkpoints, visitCountByCheckpoint, raceId, t]);

  // Team polylines.
  useEffect(() => {
    const layer = pathLayerRef.current;
    if (!layer) return;

    layer.clearLayers();
    const visibleTeams = teamPaths.filter(team => !hiddenTeamIds.has(team.team_id) && team.points.length > 0);
    // Draw the highlighted team last so it ends up on top.
    visibleTeams.sort((a, b) => (a.team_id === highlightedTeamId) - (b.team_id === highlightedTeamId));

    visibleTeams.forEach(team => {
      const isHighlighted = team.team_id === highlightedTeamId;
      const isDimmed = highlightedTeamId !== null && !isHighlighted;
      const opacity = isDimmed ? 0.2 : 0.85;

      const popup = document.createElement('div');
      popup.appendChild(createTextElement('strong', team.team_name));
      const list = document.createElement('ol');
      list.className = 'mb-0 ps-3 small';
      team.points.forEach(point => {
        list.appendChild(createTextElement('li', `${point.checkpoint.title} — ${formatVisitTime(point.created_at)}`));
      });
      popup.appendChild(list);

      if (team.points.length > 1) {
        L.polyline(team.points.map(point => point.latLng), {
          color: team.color,
          weight: isHighlighted ? 7 : 4,
          opacity,
          dashArray: team.disqualified ? '8 6' : null,
        })
          .bindTooltip(createTextElement('span', team.team_name), { sticky: true })
          .bindPopup(popup)
          .addTo(layer);
      }

      // Mark where the team started its path.
      L.circleMarker(team.points[0].latLng, {
        radius: isHighlighted ? 6 : 4,
        color: team.color,
        fillColor: team.color,
        fillOpacity: isDimmed ? 0.2 : 1,
        opacity,
      })
        .bindTooltip(createTextElement('span', t('admin.teamPaths.startTooltip', { team: team.team_name })))
        .bindPopup(popup)
        .addTo(layer);
    });
  }, [teamPaths, hiddenTeamIds, highlightedTeamId, t]);

  const toggleTeam = useCallback((teamId) => {
    setHiddenTeamIds(prev => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  }, []);

  const showAll = () => setHiddenTeamIds(new Set());
  const hideAll = () => setHiddenTeamIds(new Set(teamPaths.map(team => team.team_id)));

  return (
    <div className="card">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h5 className="mb-0">{t('admin.teamPaths.title')}</h5>
          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={() => setReloadVersion(prev => prev + 1)}
            disabled={loading}
          >
            {t('admin.teamPaths.refresh')}
          </button>
        </div>

        {loading && <div className="text-muted small mb-2">{t('admin.teamPaths.loading')}</div>}
        {error && <div className="alert alert-danger">{error}</div>}
        {!loading && !error && data.checkpoints.length === 0 && (
          <div className="text-muted small mb-2">{t('admin.teamPaths.noCheckpoints')}</div>
        )}

        <div className="row g-3">
          <div className="col-12 col-lg-8">
            <div ref={mapRef} data-testid="team-paths-map" style={{ height: '560px', width: '100%' }} />
            <div className="small text-muted mt-1">{t('admin.teamPaths.hint')}</div>
          </div>

          <div className="col-12 col-lg-4">
            <div className="d-flex gap-2 mb-2">
              <button className="btn btn-sm btn-outline-primary" onClick={showAll}>{t('admin.teamPaths.showAll')}</button>
              <button className="btn btn-sm btn-outline-primary" onClick={hideAll}>{t('admin.teamPaths.hideAll')}</button>
            </div>

            {teamPaths.length === 0 ? (
              <div className="text-muted small">{t('admin.teamPaths.noTeams')}</div>
            ) : (
              <ul className="list-group" style={{ maxHeight: '520px', overflowY: 'auto' }}>
                {teamPaths.map(team => {
                  const visible = !hiddenTeamIds.has(team.team_id);
                  const inputId = `team-path-${team.team_id}`;
                  return (
                    <li
                      key={team.team_id}
                      className={`list-group-item py-1 d-flex align-items-center gap-2 ${highlightedTeamId === team.team_id ? 'active' : ''}`}
                      onMouseEnter={() => setHighlightedTeamId(team.team_id)}
                      onMouseLeave={() => setHighlightedTeamId(null)}
                    >
                      <input
                        id={inputId}
                        type="checkbox"
                        className="form-check-input mt-0"
                        checked={visible}
                        onChange={() => toggleTeam(team.team_id)}
                      />
                      <span
                        aria-hidden="true"
                        style={{
                          display: 'inline-block',
                          width: '24px',
                          height: '4px',
                          borderRadius: '2px',
                          background: team.color,
                          flexShrink: 0,
                        }}
                      />
                      <label htmlFor={inputId} className="flex-grow-1 mb-0 text-truncate" title={team.team_name}>
                        {team.team_name}
                      </label>
                      {team.disqualified && (
                        <span className="badge bg-danger">{t('admin.teamPaths.disqualified')}</span>
                      )}
                      <span className="badge bg-secondary" title={t('admin.teamPaths.visitedCount')}>
                        {team.points.length}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
