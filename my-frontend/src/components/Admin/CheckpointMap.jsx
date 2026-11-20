import L from 'leaflet';
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import 'leaflet/dist/leaflet.css';
import { isMac, requireModifierToScrollZoom } from '../../utils/mapScrollZoom';

import './CheckpointMap.css';

const API_KEY = import.meta.env.VITE_MAPY_API_KEY;
const DEFAULT_CENTER = [49.8729317, 14.8981184];

const hasPosition = (cp) => Number.isFinite(cp?.latitude) && Number.isFinite(cp?.longitude);

const pinIcon = L.divIcon?.({
  className: 'admin-map-pin',
  html: '<span></span>',
  iconSize: [28, 28],
  iconAnchor: [14, 34], // the rotated square's tip, below its centre
});

// Finish and bivaks as the pins participants see on their map, smaller; a
// bivak pin carries its number so bivak 1 and 2 tell apart.
const placeIcon = (place) => L.divIcon?.({
  className: `admin-map-place admin-map-place-${place.kind}`,
  html: `<img src="${place.kind === 'finish' ? '/map-finish-marker.svg' : '/map-bivak-marker.svg'}" alt="">${
    place.number ? `<span class="admin-map-place-number">${place.number}</span>` : ''}`,
  iconSize: [24, 36],
  iconAnchor: [12, 35],
})

// The race's checkpoints on a map, for the admin.
// - `onCheckpointClick(cp)`: clicking a checkpoint dot (overview).
// - `picked` + `onPick({ latitude, longitude })`: a draggable pin; clicking the
//   map moves it there (choosing a checkpoint's position).
// - `excludeId`: the checkpoint being edited, shown as the pin, not as a dot.
// - `markers`: race places `{ kind: 'finish' | 'bivak', number?, title, latitude,
//   longitude }` as finish and bivak pins with their name.
export default function CheckpointMap({
  checkpoints = [], markers = [], picked = null, onPick = null, onCheckpointClick = null, excludeId = null, className = '',
}) {
  const { t } = useTranslation();
  const scrollHintRef = useRef('');
  scrollHintRef.current = t('admin.mapScrollHint', { key: isMac() ? '⌘' : 'Ctrl' });
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const dotsRef = useRef(null);
  const pinRef = useRef(null);
  const fittedCountRef = useRef(null); // number of places the view was last fitted to
  // Latest callbacks for the Leaflet handlers registered once.
  const onPickRef = useRef(onPick);
  const onCheckpointClickRef = useRef(onCheckpointClick);
  useEffect(() => {
    onPickRef.current = onPick;
    onCheckpointClickRef.current = onCheckpointClick;
  });

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const map = L.map(containerRef.current).setView(DEFAULT_CENTER, 13);
    L.tileLayer(`https://api.mapy.com/v1/maptiles/basic/256/{z}/{x}/{y}?apikey=${API_KEY}`, {
      minZoom: 0,
      maxZoom: 19,
      attribution: '<a href="https://api.mapy.com/copyright" target="_blank">&copy; Seznam.cz a.s. a další</a>',
    }).addTo(map);
    dotsRef.current = L.layerGroup().addTo(map);
    map.on('click', (event) => {
      onPickRef.current?.({ latitude: event.latlng.lat, longitude: event.latlng.lng });
    });
    mapRef.current = map;
    const stopScrollGuard = requireModifierToScrollZoom(map, scrollHintRef.current);
    // The map may mount inside a dialog that is still being laid out.
    const resize = setTimeout(() => map.invalidateSize?.(), 0);
    return () => {
      clearTimeout(resize);
      stopScrollGuard();
      map.remove();
      // A new map (React re-mounts in development) starts from scratch.
      mapRef.current = null;
      dotsRef.current = null;
      pinRef.current = null;
      fittedCountRef.current = null;
    };
  }, []);

  const others = checkpoints.filter(cp => hasPosition(cp) && (excludeId === null || cp.id !== excludeId));
  const places = markers.filter(hasPosition);

  // Checkpoint dots with their name on hover.
  useEffect(() => {
    const layer = dotsRef.current;
    if (!layer) return;
    layer.clearLayers();
    others.forEach(cp => {
      const dot = L.circleMarker([cp.latitude, cp.longitude], {
        radius: onPick ? 6 : 8,
        color: '#fff',
        weight: 2,
        // SVG attributes cannot use CSS variables: this is --brand-accent.
        fillColor: onPick ? '#6c757d' : '#0f766e',
        fillOpacity: 1,
      });
      dot.bindTooltip(`${cp.title ?? cp.name ?? ''} · ${cp.numOfPoints ?? 0}`, { direction: 'top', offset: [0, -6] });
      if (!onPick) dot.on('click', () => onCheckpointClickRef.current?.(cp));
      dot.addTo(layer);
    });
    places.forEach(place => {
      L.marker([place.latitude, place.longitude], { icon: placeIcon(place), keyboard: false })
        .bindTooltip(place.title, { direction: 'top', offset: [0, -32] })
        .addTo(layer);
    });
  });

  // The picked position as a draggable pin.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!hasPosition(picked)) {
      pinRef.current?.remove();
      pinRef.current = null;
      return;
    }
    const latLng = [picked.latitude, picked.longitude];
    if (pinRef.current) {
      pinRef.current.setLatLng(latLng);
    } else {
      pinRef.current = L.marker(latLng, { icon: pinIcon, draggable: true, autoPan: true }).addTo(map);
      pinRef.current.on('dragend', (event) => {
        const position = event.target.getLatLng();
        onPickRef.current?.({ latitude: position.lat, longitude: position.lng });
      });
    }
  }, [picked?.latitude, picked?.longitude]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fit everything in view when the number of places changes (data arrives
  // in parts: race markers first, checkpoints later). When choosing a
  // position, centre on the pin once and then leave pan and zoom to the admin;
  // a typed position outside the view pans to it.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const points = [...others, ...places].map(cp => [cp.latitude, cp.longitude]);
    const pinned = hasPosition(picked);
    if (pinned && fittedCountRef.current === null) {
      fittedCountRef.current = points.length;
      map.invalidateSize?.();
      map.setView([picked.latitude, picked.longitude], 15);
    } else if (!pinned && points.length > 0 && points.length !== fittedCountRef.current) {
      fittedCountRef.current = points.length;
      map.invalidateSize?.(); // fit to the real size, not the size at mount
      if (points.length === 1) map.setView(points[0], 15);
      else map.fitBounds(points, { padding: [24, 24] });
    } else if (pinned && map.getBounds && !map.getBounds().contains([picked.latitude, picked.longitude])) {
      map.panTo([picked.latitude, picked.longitude]);
    }
  });

  return <div ref={containerRef} className={`admin-checkpoint-map ${onPick ? 'is-picking' : ''} ${className}`} />;
}
