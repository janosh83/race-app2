import L from 'leaflet';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import 'leaflet/dist/leaflet.css';
import { useTime, formatDate } from '../contexts/TimeContext';
import { raceApi } from '../services/raceApi';
import { isTokenExpired, logoutAndRedirect } from '../utils/api';
import { resizeImageWithExif } from '../utils/image';
import { logger } from '../utils/logger';

import StatusBadge from './StatusBadge';
import Toast from './Toast';

const checkpointShadowUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';

const createMapIcon = (iconUrl, {
  iconSize = [25, 41],
  iconAnchor = [12, 41],
  popupAnchor = [1, -34],
  shadowSize = [41, 41],
} = {}) => L.icon({
  iconUrl,
  iconSize,
  iconAnchor,
  popupAnchor,
  shadowUrl: checkpointShadowUrl,
  shadowSize,
});

const toFiniteCoordinate = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getRaceMarkers = (activeRace, t) => {
  const markers = [];
  const finishLatitude = toFiniteCoordinate(activeRace?.finish_latitude);
  const finishLongitude = toFiniteCoordinate(activeRace?.finish_longitude);

  if (finishLatitude != null && finishLongitude != null) {
    markers.push({
      id: 'finish',
      latitude: finishLatitude,
      longitude: finishLongitude,
      title: t('map.finishMarker'),
      iconUrl: '/map-finish-marker.svg',
      iconOptions: {
        iconSize: [32, 52],
        iconAnchor: [16, 52],
        popupAnchor: [1, -42],
        shadowSize: [48, 48],
      },
    });
  }

  const bivak1Latitude = toFiniteCoordinate(activeRace?.bivak_1_latitude);
  const bivak1Longitude = toFiniteCoordinate(activeRace?.bivak_1_longitude);
  if (bivak1Latitude != null && bivak1Longitude != null) {
    markers.push({
      id: 'bivak-1',
      latitude: bivak1Latitude,
      longitude: bivak1Longitude,
      title: activeRace?.bivak_1_name?.trim() || t('map.bivakMarkerFallback', { index: 1 }),
      iconUrl: '/map-bivak-marker.svg',
    });
  }

  const bivak2Latitude = toFiniteCoordinate(activeRace?.bivak_2_latitude);
  const bivak2Longitude = toFiniteCoordinate(activeRace?.bivak_2_longitude);
  if (bivak2Latitude != null && bivak2Longitude != null) {
    markers.push({
      id: 'bivak-2',
      latitude: bivak2Latitude,
      longitude: bivak2Longitude,
      title: activeRace?.bivak_2_name?.trim() || t('map.bivakMarkerFallback', { index: 2 }),
      iconUrl: '/map-bivak-marker.svg',
    });
  }

  return markers;
};

const getMapUploadErrorMessage = (t, err) => {
  if (err?.status === 413) return t('map.uploadTooLarge');

  if (err?.status === 400) {
    const backendMessage = String(err?.message || '').toLowerCase();
    if (backendMessage.includes('invalid image') || backendMessage.includes('extension')) {
      return t('map.invalidImageUpload');
    }
  }

  return t('map.visitLogFailed', { message: err?.message || t('map.unknownError') });
};

function Map({ topOffset = 56 }) {
  const { t } = useTranslation();
  const getViewportHeight = () => {
    if (typeof window === 'undefined') return 0;
    return Math.round(window.visualViewport?.height ?? window.innerHeight);
  };

  const [viewportHeight, setViewportHeight] = useState(getViewportHeight);
  // token expiry watcher (redirect to login when token expires)
  useEffect(() => {
    const check = () => {
      const token = localStorage.getItem('accessToken');
      if (!token) return;
      if (isTokenExpired(token, 5)) {
        logger.warn('TOKEN', 'Token expiry detected in Map');
        logoutAndRedirect();
      }
    };
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, []);

  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const userMarkerRef = useRef(null);
  const geoWatchIdRef = useRef(null);
  const userLocationRef = useRef(null); // Store latest user position for checkpoint logging
  const markersRef = useRef({}); // Track markers by checkpoint ID
  const raceMarkersRef = useRef({});
  const hasAutoCenteredRef = useRef(false);
  const allowAutoCenterRef = useRef(true);
  const [checkpoints, setCheckpoints] = useState([]);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [toast, setToast] = useState(null);
  const [checkpointError, setCheckpointError] = useState(false);
  const { activeRace, timeInfo, selectedLanguage } = useTime();
  const API_KEY = import.meta.env.VITE_MAPY_API_KEY;
  const apiUrl = import.meta.env.VITE_API_URL;
  const mapHeight = Math.max(0, viewportHeight - topOffset);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    let resizeTimeoutId = null;

    const updateViewportHeight = () => {
      if (resizeTimeoutId) {
        window.clearTimeout(resizeTimeoutId);
      }

      // Debounce bursty iOS viewport resize events during pinch/zoom.
      resizeTimeoutId = window.setTimeout(() => {
        setViewportHeight(getViewportHeight());
      }, 120);
    };

    setViewportHeight(getViewportHeight());
    window.addEventListener('resize', updateViewportHeight);
    window.addEventListener('orientationchange', updateViewportHeight);
    window.visualViewport?.addEventListener('resize', updateViewportHeight);

    return () => {
      if (resizeTimeoutId) {
        window.clearTimeout(resizeTimeoutId);
      }
      window.removeEventListener('resize', updateViewportHeight);
      window.removeEventListener('orientationchange', updateViewportHeight);
      window.visualViewport?.removeEventListener('resize', updateViewportHeight);
    };
  }, []);

  // Get active race and team from TimeContext
  const activeRaceId = activeRace?.race_id ?? activeRace?.id ?? null;
  const activeTeamId = activeRace?.team_id ?? null;

  // Fetch checkpoints when activeRaceId changes (use raceApi proxy)
  useEffect(() => {
    if (!activeRaceId || !activeTeamId) return;

    const fetchCheckpoints = () => {
      logger.info('RACE', 'Fetching checkpoints for map', { raceId: activeRaceId, teamId: activeTeamId, language: selectedLanguage });
      setCheckpointError(false);

      raceApi
        .getCheckpointsStatus(activeRaceId, activeTeamId, selectedLanguage)
        .then((data) => {
          logger.success('RACE', 'Checkpoints loaded for map', { count: data?.length || 0 });
          setCheckpoints(data);
          setCheckpointError(false);
        })
        .catch((err) => {
          logger.error('RACE', 'Failed to fetch checkpoints', err.message);
          setCheckpointError(true);
          setToast({
            message: t('map.checkpointsLoadFailed'),
            type: 'error',
            duration: 0 // Don't auto-dismiss
          });
        });
    };

    fetchCheckpoints();
  }, [activeRaceId, activeTeamId, selectedLanguage, t]);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    logger.info('COMPONENT', 'Initializing map');
    mapInstance.current = L.map(mapRef.current).setView([49.8729317, 14.8981184], 16);

    // Stop auto-centering once the user manually moves/zooms the map.
    mapInstance.current.on('dragstart zoomstart', () => {
      allowAutoCenterRef.current = false;
    });

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
        const { latitude, longitude, accuracy } = position.coords;
        logger.info('GEOLOCATION', 'Position update', { lat: latitude.toFixed(4), lng: longitude.toFixed(4) });

        // Store latest position for immediate use in checkpoint logging (no geolocation delay)
        userLocationRef.current = { latitude, longitude, accuracy, timestamp: Date.now() };

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
        // Center only once automatically. Do not override user's later pan/zoom.
        if (!hasAutoCenteredRef.current && allowAutoCenterRef.current) {
          mapInstance.current.setView([latitude, longitude], mapInstance.current.getZoom());
          hasAutoCenteredRef.current = true;
        }
      };

      const onErr = (error) => {
        logger.warn('GEOLOCATION', 'Geolocation error', error.message);
      };

      // get initial position with relaxed accuracy for faster initial acquisition
      logger.info('GEOLOCATION', 'Starting continuous location monitoring');
      navigator.geolocation.getCurrentPosition(onPos, onErr, {
        enableHighAccuracy: false,  // Use standard accuracy for faster initial position
        timeout: 5000
      });
      // watch for updates continuously with relaxed settings
      geoWatchIdRef.current = navigator.geolocation.watchPosition(onPos, onErr, {
        enableHighAccuracy: true,   // High accuracy for continuous updates
        maximumAge: 3000,           // Accept cached position up to 3 seconds old
        timeout: 8000,
      });
    }

    return () => {
      // clear geolocation watch and remove user marker
      try {
        if (geoWatchIdRef.current && navigator.geolocation && navigator.geolocation.clearWatch) {
          navigator.geolocation.clearWatch(geoWatchIdRef.current);
          geoWatchIdRef.current = null;
        }
      } catch { /* ignore */ }
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

  useEffect(() => {
    if (!mapInstance.current) return;

    const rafId = window.requestAnimationFrame(() => {
      mapInstance.current?.invalidateSize(false);
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [mapHeight]);

  const loggingAllowed = timeInfo.state === 'LOGGING';
  const showCheckpoints = timeInfo.state !== 'BEFORE_SHOW' && timeInfo.state !== 'AFTER_SHOW' && timeInfo.state !== 'UNKNOWN';

  // Update checkpoint markers efficiently by diffing changes
  useEffect(() => {
    if (!mapInstance.current) return;

    // If checkpoints shouldn't be shown, remove all markers
    if (!showCheckpoints) {
      Object.values(markersRef.current).forEach(marker => {
        if (mapInstance.current.hasLayer(marker)) {
          mapInstance.current.removeLayer(marker);
        }
      });
      return;
    }

    // Build a set of current checkpoint IDs
    const currentIds = new Set(checkpoints.map(cp => cp.id));
    const existingIds = new Set(Object.keys(markersRef.current).map(k => parseInt(k, 10)));

    // Remove markers for deleted checkpoints
    for (const id of existingIds) {
      if (!currentIds.has(id)) {
        const marker = markersRef.current[id];
        if (mapInstance.current.hasLayer(marker)) {
          mapInstance.current.removeLayer(marker);
        }
        delete markersRef.current[id];
      }
    }

    // Add or update markers for current checkpoints
    checkpoints.forEach(cp => {
      if (markersRef.current[cp.id]) {
        // Marker exists - just update its icon if visited status changed
        const currentIcon = markersRef.current[cp.id].options.icon;
        const iconUrl = cp.visited
          ? 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png'
          : 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png';
        const newIcon = currentIcon.options.iconUrl !== iconUrl
          ? createMapIcon(iconUrl)
          : currentIcon;
        markersRef.current[cp.id].setIcon(newIcon);
      } else {
        // New marker - create it
        const iconUrl = cp.visited
          ? 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png'
          : 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png';

        const marker = L.marker([cp.latitude, cp.longitude], {
          title: cp.title,
          icon: createMapIcon(iconUrl),
        }).addTo(mapInstance.current);

        // Open full-screen overlay on marker click
        marker.on('click', () => {
          setSelectedCheckpoint(cp);
        });

        markersRef.current[cp.id] = marker;
      }
    });
  }, [checkpoints, showCheckpoints]);

  useEffect(() => {
    if (!mapInstance.current) return;

    Object.values(raceMarkersRef.current).forEach(marker => {
      if (mapInstance.current.hasLayer(marker)) {
        mapInstance.current.removeLayer(marker);
      }
    });
    raceMarkersRef.current = {};

    if (!showCheckpoints) {
      return;
    }

    getRaceMarkers(activeRace, t).forEach(markerData => {
      const marker = L.marker([markerData.latitude, markerData.longitude], {
        title: markerData.title,
        icon: createMapIcon(markerData.iconUrl, markerData.iconOptions),
      }).addTo(mapInstance.current);

      raceMarkersRef.current[markerData.id] = marker;
    });
  }, [activeRace, showCheckpoints, t]);

  // Keep selected checkpoint details in sync with latest data (visited state, images, etc.)
  useEffect(() => {
    if (!selectedCheckpoint) return;
    const updated = checkpoints.find(cp => cp.id === selectedCheckpoint.id);
    if (updated) {
      setSelectedCheckpoint(updated);
    }
  }, [checkpoints, selectedCheckpoint]);

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { resizedFile, previewDataUrl } = await resizeImageWithExif(file);
      setSelectedImage(resizedFile);
      setImagePreview(previewDataUrl);
    } catch (err) {
      logger.error('IMAGE', 'Failed to process image', err?.message || err);
      alert(t('map.imageProcessFailed'));
    }
  };

  const handleLogVisit = async () => {
    if (!selectedCheckpoint) return;
    logger.info('RACE', 'Logging checkpoint visit', { checkpointId: selectedCheckpoint.id, hasImage: !!selectedImage });
    setIsUploading(true);
    try {
      // Use continuously monitored location (already being tracked, no delay)
      let userLatitude = null;
      let userLongitude = null;

      if (userLocationRef.current) {
        userLatitude = userLocationRef.current.latitude;
        userLongitude = userLocationRef.current.longitude;
        const age = Date.now() - userLocationRef.current.timestamp;
        logger.info('GEOLOCATION', 'Using cached user position for checkpoint log', {
          lat: userLatitude.toFixed(4),
          lng: userLongitude.toFixed(4),
          ageMs: age
        });
      } else {
        logger.warn('GEOLOCATION', 'No cached position available yet, location tracking may not have started');
      }

      const formData = new FormData();
      formData.append('checkpoint_id', selectedCheckpoint.id);
      formData.append('team_id', activeTeamId);
      if (selectedImage) {
        formData.append('image', selectedImage);
      }
      // Add user position if available
      if (userLatitude !== null) {
        formData.append('user_latitude', userLatitude);
        formData.append('user_longitude', userLongitude);
      }

      await raceApi.logVisitWithImage(activeRaceId, formData);
      const data = await raceApi.getCheckpointsStatus(activeRaceId, activeTeamId, selectedLanguage);
      logger.success('RACE', 'Checkpoint visit logged successfully');
      setCheckpoints(data);
      setSelectedCheckpoint(null);
      setSelectedImage(null);
      setImagePreview(null);
      setToast({
        message: t('map.visitLogged'),
        type: 'success',
        duration: 3000
      });
    } catch (err) {
      logger.error('RACE', 'Failed to log checkpoint visit', err.message);
      setToast({
        message: getMapUploadErrorMessage(t, err),
        type: 'error',
        duration: 5000
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteVisit = async () => {
    if (!selectedCheckpoint) return;
    logger.info('RACE', 'Deleting checkpoint visit', { checkpointId: selectedCheckpoint.id });
    try {
      await raceApi.deleteVisit(activeRaceId, { checkpoint_id: selectedCheckpoint.id, team_id: activeTeamId });
      const data = await raceApi.getCheckpointsStatus(activeRaceId, activeTeamId, selectedLanguage);
      logger.success('RACE', 'Checkpoint visit deleted successfully');
      setCheckpoints(data);
      setSelectedCheckpoint(null);
    } catch (err) {
      logger.error('RACE', 'Failed to delete checkpoint visit', err.message);
      setToast({
        message: t('map.visitDeleteFailed', { message: err.message || t('map.unknownError') }),
        type: 'error',
        duration: 5000
      });
    }
  };

  const handleRetryCheckpoints = () => {
    if (!activeRaceId || !activeTeamId) return;
    logger.info('RACE', 'Retrying checkpoint fetch', { raceId: activeRaceId, teamId: activeTeamId });
    setToast(null);
    setCheckpointError(false);

    raceApi
      .getCheckpointsStatus(activeRaceId, activeTeamId, selectedLanguage)
      .then((data) => {
        logger.success('RACE', 'Checkpoints loaded after retry', { count: data?.length || 0 });
        setCheckpoints(data);
        setCheckpointError(false);
        setToast({
          message: t('map.checkpointsLoaded'),
          type: 'success',
          duration: 3000
        });
      })
      .catch((err) => {
        logger.error('RACE', 'Retry failed for checkpoints', err.message);
        setCheckpointError(true);
        setToast({
          message: t('map.checkpointsLoadFailed'),
          type: 'error',
          duration: 0
        });
      });
  };

  const handleCloseOverlay = () => {
    setSelectedCheckpoint(null);
    setSelectedImage(null);
    setImagePreview(null);
  };

  return (
    <>
      {/* Toast notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={() => setToast(null)}
        />
      )}

      {/* Retry button for checkpoint errors */}
      {checkpointError && (
        <div
          style={{
            position: 'fixed',
            top: `${topOffset + 10}px`,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1500,
            backgroundColor: '#fff',
            padding: '12px 20px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
            <span style={{ color: '#dc3545', fontWeight: '500' }}>⚠ {t('map.checkpointsLoadFailed')}</span>
          <button
            className="btn btn-sm btn-primary"
            onClick={handleRetryCheckpoints}
          >
              {t('map.retry')}
          </button>
        </div>
      )}

      {/* Loading overlay during upload */}
      {isUploading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          zIndex: 3000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px 40px',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
              <span className="visually-hidden">{t('map.loading')}</span>
            </div>
            <div style={{ fontSize: '18px', fontWeight: '500' }}>{t('map.uploading')}</div>
          </div>
        </div>
      )}

      <StatusBadge
        topOffset={topOffset}
        isShown={showCheckpoints}
        loggingAllowed={loggingAllowed}
        timeInfo={timeInfo}
        itemName={t('map.checkpoints')}
      />

      {/* Full-screen checkpoint overlay */}
      {selectedCheckpoint && (
        <div style={{
          position: 'fixed',
          top: topOffset,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'white',
          zIndex: 2000,
          overflowY: 'auto',
          padding: '20px'
        }}>
          <div className="container">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h3>{selectedCheckpoint.title}</h3>
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={handleCloseOverlay}
              >
                ✕ {t('map.close')}
              </button>
            </div>

            {selectedCheckpoint.description && (
              <div className="mb-3">
                <p>{selectedCheckpoint.description}</p>
              </div>
            )}

            <div className="mb-3">
              <span className={`badge ${selectedCheckpoint.visited ? 'bg-success' : 'bg-secondary'}`}>
                {selectedCheckpoint.visited ? `✓ ${t('map.visited')}` : t('map.notVisited')}
              </span>
            </div>

            {selectedCheckpoint.visited && selectedCheckpoint.image_filename && (
              <div className="mb-3">
                <label className="form-label">{t('map.visitPhotoLabel')}</label>
                <div>
                  <img
                    src={`${apiUrl}/static/images/${selectedCheckpoint.image_filename}`}
                    alt={t('map.visitPhotoAlt')}
                    style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain', borderRadius: '8px' }}
                  />
                </div>
              </div>
            )}

            {!showCheckpoints && (
              <div className="alert alert-warning">
                {t('map.checkpointsNotShown')}
                {timeInfo.state === 'BEFORE_SHOW' && (
                  <div>{t('map.checkpointsShowAt', { time: formatDate(timeInfo.startShow) })}</div>
                )}
                {timeInfo.state === 'AFTER_SHOW' && (
                  <div>{t('map.checkpointsEndedAt', { time: formatDate(timeInfo.endShow) })}</div>
                )}
              </div>
            )}

            {showCheckpoints && (
              <div>
                {loggingAllowed && !selectedCheckpoint.visited && (
                  <>
                    <div className="mb-3">
                      <label className="form-label">{t('map.attachPhoto')}</label>
                      <input
                        type="file"
                        className="form-control"
                        accept="image/*"
                        onChange={handleImageSelect}
                      />
                      {imagePreview && (
                        <div className="mt-2">
                          <img
                            src={imagePreview}
                            alt="Preview"
                            style={{ maxWidth: '100%', maxHeight: '300px', objectFit: 'contain' }}
                          />
                        </div>
                      )}
                    </div>
                    <div className="d-grid gap-2">
                      <button
                        className="btn btn-primary btn-lg"
                        onClick={handleLogVisit}
                      >
                        {selectedImage ? t('map.logVisitWithPhoto') : t('map.logVisit')}
                      </button>
                    </div>
                  </>
                )}
                {loggingAllowed && selectedCheckpoint.visited && (
                  <div className="d-grid gap-2">
                    <button
                      className="btn btn-danger btn-lg"
                      onClick={handleDeleteVisit}
                    >
                      {t('map.deleteVisit')}
                    </button>
                  </div>
                )}
                {!loggingAllowed && (
                  <div className="alert alert-info">
                    {selectedCheckpoint.visited
                      ? t('map.visitLoggedReadOnly')
                      : t('map.loggingNotOpen')}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ position: 'fixed', top: `${topOffset}px`, left: 0, right: 0, height: `${mapHeight}px`, zIndex: 1 }}>
        <div
          ref={mapRef}
          style={{ height: '100%', width: '100%' }}
        />
      </div>
    </>
  );
}

export default Map;