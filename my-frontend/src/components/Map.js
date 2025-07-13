import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

function Map() {
  const mapRef = useRef(null);
  const mapInstance = useRef(null); // To keep track of the Leaflet map instance
  const API_KEY = process.env.REACT_APP_MAPY_API_KEY;

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    // Initialize map
    mapInstance.current = L.map(mapRef.current).setView([49.8729317, 14.8981184], 16);

    L.tileLayer(`https://api.mapy.com/v1/maptiles/basic/256/{z}/{x}/{y}?apikey=${API_KEY}`, {
      minZoom: 0,
      maxZoom: 19,
      attribution: '<a href="https://api.mapy.com/copyright" target="_blank">&copy; Seznam.cz a.s. a další</a>',
    }).addTo(mapInstance.current);

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

    // Geolocation: show user's current location
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

    // Cleanup
    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

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