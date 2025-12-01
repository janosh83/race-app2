import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { isTokenExpired, logoutAndRedirect } from '../utils/api';
import { raceApi } from '../services/raceApi';
import { useTime, formatDate } from '../contexts/TimeContext';

function Map() {
  // token expiry watcher (redirect to login when token expires)
  useEffect(() => {
    const check = () => {
      const token = localStorage.getItem('accessToken');
      if (!token) return;
      if (isTokenExpired(token, 5)) logoutAndRedirect();
    };
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, []);

  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const userMarkerRef = useRef(null);
  const geoWatchIdRef = useRef(null);
  const [checkpoints, setCheckpoints] = useState([]);
  const { activeRace, timeInfo } = useTime();
  const API_KEY = process.env.REACT_APP_MAPY_API_KEY;
  const apiUrl = process.env.REACT_APP_API_URL;

  // Get active race and team from TimeContext
  const activeRaceId = activeRace?.race_id ?? activeRace?.id ?? null;
  const activeTeamId = activeRace?.team_id ?? null;

  // Fetch checkpoints when activeRaceId changes (use raceApi proxy)
  useEffect(() => {
    if (!activeRaceId || !activeTeamId) return;
    let mounted = true;
    raceApi
      .getCheckpointsStatus(activeRaceId, activeTeamId)
      .then((data) => {
        if (mounted) setCheckpoints(data);
      })
      .catch((err) => console.error('Failed to fetch checkpoints:', err));
    return () => {
      mounted = false;
    };
  }, [activeRaceId, activeTeamId]);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    mapInstance.current = L.map(mapRef.current).setView([49.8729317, 14.8981184], 16);

    L.tileLayer(`https://api.mapy.com/v1/maptiles/basic/256/{z}/{x}/{y}?apikey=${API_KEY}`, {
      minZoom: 0,
      maxZoom: 19,
      attribution: '<a href="https://api.mapy.com/copyright" target="_blank">&copy; Seznam.cz a.s. a další</a>',
    }).addTo(mapInstance.current);

    // LogoControl and geolocation code...
    const LogoControl = L.Control.extend({
      options: { position: 'bottomleft' },
      onAdd: function () {
        const container = L.DomUtil.create('div');
        const link = L.DomUtil.create('a', '', container);
        link.setAttribute('href', 'http://mapy.com/');
        link.setAttribute('target', '_blank');
        link.innerHTML = '<img src="https://api.mapy.com/img/api/logo.svg" />';
        L.DomEvent.disableClickPropagation(link);
        return container;
      },
    });
    new LogoControl().addTo(mapInstance.current);

    // show a blue dot for current position and keep it updated
    if (navigator.geolocation) {
      const onPos = (position) => {
        const { latitude, longitude } = position.coords;
        // create or update a small blue circle marker
        if (userMarkerRef.current) {
          userMarkerRef.current.setLatLng([latitude, longitude]);
        } else {
          userMarkerRef.current = L.circleMarker([latitude, longitude], {
            radius: 8,
            color: '#3030FF',       // blue border
            weight: 2,
            fillColor: '#1E90FF',   // blue fill
            fillOpacity: 0.9,
            interactive: false
          }).addTo(mapInstance.current);
        }
        // center map to first known position
        mapInstance.current.setView([latitude, longitude], 16);
      };

      const onErr = (error) => {
        console.warn('Geolocation error:', error);
      };

      // get initial position
      navigator.geolocation.getCurrentPosition(onPos, onErr, { enableHighAccuracy: true });
      // watch for updates and keep blue dot in sync
      geoWatchIdRef.current = navigator.geolocation.watchPosition(onPos, onErr, {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      });
    }

    return () => {
      // clear geolocation watch and remove user marker
      try {
        if (geoWatchIdRef.current && navigator.geolocation && navigator.geolocation.clearWatch) {
          navigator.geolocation.clearWatch(geoWatchIdRef.current);
          geoWatchIdRef.current = null;
        }
      } catch (e) { /* ignore */ }
      if (userMarkerRef.current && mapInstance.current) {
        mapInstance.current.removeLayer(userMarkerRef.current);
        userMarkerRef.current = null;
      }
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [API_KEY]);

  // Add checkpoint markers when checkpoints or map are ready
  useEffect(() => {
    if (!mapInstance.current) return;

    // Remove old markers (optional: keep track of them in a ref for more control)
    mapInstance.current.eachLayer(layer => {
      if (layer instanceof L.Marker && !layer.options.title?.includes('Your location')) {
        mapInstance.current.removeLayer(layer);
      }
    });

    const loggingAllowed = timeInfo.state === 'LOGGING';
    const showCheckpoints = ['SHOW_ONLY', 'LOGGING', 'POST_LOG_SHOW'].includes(timeInfo.state);
    const showMessageOnly = timeInfo.state === 'BEFORE_SHOW' || timeInfo.state === 'AFTER_SHOW' || timeInfo.state === 'UNKNOWN';

    checkpoints.forEach(cp => {
      const iconUrl = cp.visited
        ? 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png'
        : 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png';

      const marker = L.marker([cp.latitude, cp.longitude], {
        title: cp.title,
        icon: L.icon({
          iconUrl,
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
          shadowSize: [41, 41],
        }),
      }).addTo(mapInstance.current);

      // Build popup according to time state
      let buttonHtml = '';
      if (!showCheckpoints) {
        buttonHtml = `<div class="text-muted">Checkpoints are not shown at this time.</div>`;
      } else {
        if (loggingAllowed) {
          // allow log/delete
          buttonHtml = `<button id="visit-btn-${cp.id}" class="leaflet-popup-btn btn btn-sm btn-primary">${cp.visited ? 'Delete Visit' : 'Log Visit'}</button>`;
        } else {
          // showing but logging disabled
          buttonHtml = `<button id="visit-btn-${cp.id}" class="leaflet-popup-btn btn btn-sm btn-secondary" disabled>${cp.visited ? 'Visit logged (readonly)' : 'Logging not open'}</button>`;
        }
      }

      const popupExtra =
        timeInfo.state === 'BEFORE_SHOW'
          ? `<div class="text-warning">Checkpoints will be shown at ${formatDate(timeInfo.startShow)}</div>`
          : timeInfo.state === 'AFTER_SHOW'
          ? `<div class="text-danger">Showing of checkpoints ended at ${formatDate(timeInfo.endShow)}</div>`
          : '';

      const popupContent = `
        <strong>${cp.title}</strong><br/>
        ${cp.description || ''}<br/>
        ${buttonHtml}
        ${popupExtra}
      `;

      marker.bindPopup(popupContent);

      marker.on('popupopen', () => {
        // Only bind click handler when loggingAllowed and popup button exists
        const btn = document.getElementById(`visit-btn-${cp.id}`);
          if (btn && loggingAllowed && !cp.visited) {
          btn.onclick = async () => {
            try {
              await raceApi.logVisit(activeRaceId, { checkpoint_id: cp.id, team_id: activeTeamId });
              // Refresh checkpoints
              const data = await raceApi.getCheckpointsStatus(activeRaceId, activeTeamId);
              setCheckpoints(data);
              marker.closePopup();
            } catch (err) {
              console.error('Failed to log visit:', err);
              alert('Failed to log visit.');
            }
          };
        } else if (btn && loggingAllowed && cp.visited) {
          // Delete visit handler
          btn.onclick = async () => {
            try {
              await raceApi.deleteVisit(activeRaceId, { checkpoint_id: cp.id, team_id: activeTeamId });
              const data = await raceApi.getCheckpointsStatus(activeRaceId, activeTeamId);
              setCheckpoints(data);
              marker.closePopup();
            } catch (err) {
              console.error('Failed to delete visit:', err);
              alert('Failed to delete visit.');
            }
          };
        } else {
          // do nothing; button disabled or not present
        }
      });
    });
  }, [checkpoints, activeRaceId, activeTeamId, apiUrl, timeInfo]);

  // small overlay message about current time state
  const overlayMessage = (() => {
    switch (timeInfo.state) {
      case 'BEFORE_SHOW':
        return `Checkpoints will be shown at ${formatDate(timeInfo.startShow)}`;
      case 'SHOW_ONLY':
        return 'Checkpoints are visible. Logging is not open yet.';
      case 'LOGGING':
        return 'Logging is open — you can log or delete visits now.';
      case 'POST_LOG_SHOW':
        return 'Logging closed. Checkpoints still visible (read-only).';
      case 'AFTER_SHOW':
        return `Showing of checkpoints ended at ${formatDate(timeInfo.endShow)}`;
      default:
        return '';
    }
  })();

  return (
    <>
      {overlayMessage && (
        <div style={{
          position: 'fixed',
          top: 56,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          background: 'rgba(255,255,255,0.95)',
          padding: '8px 12px',
          borderRadius: 6,
          boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
        }}>
          {overlayMessage}
        </div>
      )}
      <div style={{ position: 'fixed', top: '56px', left: 0, right: 0, bottom: 0, zIndex: 1 }}>
        <div
          ref={mapRef}
          style={{ height: '100%', width: '100%' }}
        />
      </div>
    </>
  );
}

export default Map;