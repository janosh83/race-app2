import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

function Map() {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const [checkpoints, setCheckpoints] = useState([]);
  const API_KEY = process.env.REACT_APP_MAPY_API_KEY;
  const apiUrl = process.env.REACT_APP_API_URL;

  // Get active race and team from localStorage
  const activeRace = JSON.parse(localStorage.getItem('activeRace'));
  const activeRaceId = activeRace.race_id;
  const activeTeamId = activeRace.team_id;

  // Fetch checkpoints when activeRaceId changes
  useEffect(() => {
    if (!activeRaceId || !activeTeamId) return;
    const accessToken = localStorage.getItem('accessToken');
    fetch(`${apiUrl}/api/race/${activeRaceId}/checkpoints/${activeTeamId}/status/`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })
      .then(res => res.json())
      .then(data => setCheckpoints(data))
      .catch(err => console.error('Failed to fetch checkpoints:', err));
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

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          L.marker([latitude, longitude], {
            title: 'Your location',
            icon: L.icon({
              iconUrl: 'https://cdn-icons-png.flaticon.com/512/64/64113.png',
              iconSize: [32, 32],
              iconAnchor: [16, 32],
            }),
          }).addTo(mapInstance.current);
          mapInstance.current.setView([latitude, longitude], 16);
        },
        (error) => {
          console.warn('Geolocation error:', error);
        }
      );
    }

    return () => {
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

      const popupContent = `
        <strong>${cp.title}</strong><br/>
        ${cp.description || ''}<br/>
        <button id="visit-btn-${cp.id}" class="leaflet-popup-btn">
          ${cp.visited ? 'Delete Visit' : 'Log Visit'}
        </button>
      `;

      marker.bindPopup(popupContent);

      marker.on('popupopen', () => {
        const btn = document.getElementById(`visit-btn-${cp.id}`);
        if (btn) {
          btn.onclick = async () => {
            const accessToken = localStorage.getItem('accessToken');
            const url = `${apiUrl}/api/race/${activeRaceId}/checkpoints/log/`;
            const options = {
              method: cp.visited ? 'DELETE' : 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ checkpoint_id: cp.id, team_id: activeTeamId }),
            };
            try {
              const res = await fetch(url, options);
              if (res.ok) {
                // Refresh checkpoints
                const updated = await fetch(`${apiUrl}/api/race/${activeRaceId}/checkpoints/${activeTeamId}/status/`, {
                  headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                  },
                });
                const data = await updated.json();
                setCheckpoints(data);
                marker.closePopup();
              } else {
                alert('Failed to update visit status.');
              }
            } catch (err) {
              alert('Network error.');
            }
          };
        }
      });
    });
  }, [checkpoints, activeRaceId, activeTeamId]);

  return (
    <div style={{ position: 'fixed', top: '56px', left: 0, right: 0, bottom: 0, zIndex: 1 }}>
      <div
        ref={mapRef}
        style={{ height: '100%', width: '100%' }}
      />
    </div>
  );
}

export default Map;