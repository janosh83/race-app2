import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { isTokenExpired, logoutAndRedirect } from '../utils/api';
import { raceApi } from '../services/raceApi';
import { useTime, formatDate } from '../contexts/TimeContext';
import { logger } from '../utils/logger';
import StatusBadge from './StatusBadge';
import { resizeImageWithExif } from '../utils/image';
import Toast from './Toast';

function Map({ topOffset = 56 }) {
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
  const markersRef = useRef({}); // Track markers by checkpoint ID
  const [checkpoints, setCheckpoints] = useState([]);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [toast, setToast] = useState(null);
  const [checkpointError, setCheckpointError] = useState(false);
  const { activeRace, timeInfo } = useTime();
  const API_KEY = process.env.REACT_APP_MAPY_API_KEY;
  const apiUrl = process.env.REACT_APP_API_URL;

  // Get active race and team from TimeContext
  const activeRaceId = activeRace?.race_id ?? activeRace?.id ?? null;
  const activeTeamId = activeRace?.team_id ?? null;

  // Fetch checkpoints when activeRaceId changes (use raceApi proxy)
  useEffect(() => {
    if (!activeRaceId || !activeTeamId) return;
    
    const fetchCheckpoints = () => {
      logger.info('RACE', 'Fetching checkpoints for map', { raceId: activeRaceId, teamId: activeTeamId });
      setCheckpointError(false);
      
      raceApi
        .getCheckpointsStatus(activeRaceId, activeTeamId)
        .then((data) => {
          logger.success('RACE', 'Checkpoints loaded for map', { count: data?.length || 0 });
          setCheckpoints(data);
          setCheckpointError(false);
        })
        .catch((err) => {
          logger.error('RACE', 'Failed to fetch checkpoints', err.message);
          setCheckpointError(true);
          setToast({
            message: 'Failed to load checkpoints. Click retry to try again.',
            type: 'error',
            duration: 0 // Don't auto-dismiss
          });
        });
    };

    fetchCheckpoints();
  }, [activeRaceId, activeTeamId]);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    logger.info('COMPONENT', 'Initializing map');
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
        logger.info('GEOLOCATION', 'Position update', { lat: latitude.toFixed(4), lng: longitude.toFixed(4) });
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
        logger.warn('GEOLOCATION', 'Geolocation error', error.message);
      };

      // get initial position
      logger.info('GEOLOCATION', 'Requesting initial position');
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
          ? L.icon({
              iconUrl,
              iconSize: [25, 41],
              iconAnchor: [12, 41],
              popupAnchor: [1, -34],
              shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
              shadowSize: [41, 41],
            })
          : currentIcon;
        markersRef.current[cp.id].setIcon(newIcon);
      } else {
        // New marker - create it
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

        // Open full-screen overlay on marker click
        marker.on('click', () => {
          setSelectedCheckpoint(cp);
        });

        markersRef.current[cp.id] = marker;
      }
    });
  }, [checkpoints, showCheckpoints]);

  // Keep selected checkpoint details in sync with latest data (visited state, images, etc.)
  useEffect(() => {
    if (!selectedCheckpoint) return;
    const updated = checkpoints.find(cp => cp.id === selectedCheckpoint.id);
    if (updated) {
      setSelectedCheckpoint(updated);
    }
  }, [checkpoints, selectedCheckpoint?.id]);

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { resizedFile, previewDataUrl } = await resizeImageWithExif(file);
      setSelectedImage(resizedFile);
      setImagePreview(previewDataUrl);
    } catch (err) {
      logger.error('IMAGE', 'Failed to process image', err?.message || err);
      alert('Failed to process image. Please try another photo.');
    }
  };

  const handleLogVisit = async () => {
    if (!selectedCheckpoint) return;
    logger.info('RACE', 'Logging checkpoint visit', { checkpointId: selectedCheckpoint.id, hasImage: !!selectedImage });
    setIsUploading(true);
    try {
      // Get user's current position
      let userLatitude = null;
      let userLongitude = null;

      if (navigator.geolocation) {
        try {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0
            });
          });
          userLatitude = position.coords.latitude;
          userLongitude = position.coords.longitude;
          logger.info('GEOLOCATION', 'User position captured for checkpoint log', {
            lat: userLatitude.toFixed(4),
            lng: userLongitude.toFixed(4)
          });
        } catch (geoErr) {
          logger.warn('GEOLOCATION', 'Failed to get user position', geoErr.message);
          // Continue without user position - it's optional
        }
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
      const data = await raceApi.getCheckpointsStatus(activeRaceId, activeTeamId);
      logger.success('RACE', 'Checkpoint visit logged successfully');
      setCheckpoints(data);
      setSelectedCheckpoint(null);
      setSelectedImage(null);
      setImagePreview(null);
      setToast({
        message: 'Visit logged successfully',
        type: 'success',
        duration: 3000
      });
    } catch (err) {
      logger.error('RACE', 'Failed to log checkpoint visit', err.message);
      setToast({
        message: 'Failed to log visit: ' + (err.message || 'Unknown error'),
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
      const data = await raceApi.getCheckpointsStatus(activeRaceId, activeTeamId);
      logger.success('RACE', 'Checkpoint visit deleted successfully');
      setCheckpoints(data);
      setSelectedCheckpoint(null);
    } catch (err) {
      logger.error('RACE', 'Failed to delete checkpoint visit', err.message);
      setToast({
        message: 'Failed to delete visit: ' + (err.message || 'Unknown error'),
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
      .getCheckpointsStatus(activeRaceId, activeTeamId)
      .then((data) => {
        logger.success('RACE', 'Checkpoints loaded after retry', { count: data?.length || 0 });
        setCheckpoints(data);
        setCheckpointError(false);
        setToast({
          message: 'Checkpoints loaded successfully',
          type: 'success',
          duration: 3000
        });
      })
      .catch((err) => {
        logger.error('RACE', 'Retry failed for checkpoints', err.message);
        setCheckpointError(true);
        setToast({
          message: 'Failed to load checkpoints. Click retry to try again.',
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
          <span style={{ color: '#dc3545', fontWeight: '500' }}>⚠ Failed to load checkpoints</span>
          <button
            className="btn btn-sm btn-primary"
            onClick={handleRetryCheckpoints}
          >
            Retry
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
              <span className="visually-hidden">Loading...</span>
            </div>
            <div style={{ fontSize: '18px', fontWeight: '500' }}>Uploading...</div>
          </div>
        </div>
      )}

      <StatusBadge 
        topOffset={topOffset}
        isShown={showCheckpoints}
        loggingAllowed={loggingAllowed}
        timeInfo={timeInfo}
        itemName="Checkpoints"
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
                ✕ Close
              </button>
            </div>

            {selectedCheckpoint.description && (
              <div className="mb-3">
                <p>{selectedCheckpoint.description}</p>
              </div>
            )}

            <div className="mb-3">
              <span className={`badge ${selectedCheckpoint.visited ? 'bg-success' : 'bg-secondary'}`}>
                {selectedCheckpoint.visited ? '✓ Visited' : 'Not visited'}
              </span>
            </div>

            {selectedCheckpoint.visited && selectedCheckpoint.image_filename && (
              <div className="mb-3">
                <label className="form-label">Visit Photo:</label>
                <div>
                  <img 
                    src={`${apiUrl}/static/images/${selectedCheckpoint.image_filename}`}
                    alt="Visit photo" 
                    style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain', borderRadius: '8px' }}
                  />
                </div>
              </div>
            )}

            {!showCheckpoints && (
              <div className="alert alert-warning">
                Checkpoints are not shown at this time.
                {timeInfo.state === 'BEFORE_SHOW' && (
                  <div>Checkpoints will be shown at {formatDate(timeInfo.startShow)}</div>
                )}
                {timeInfo.state === 'AFTER_SHOW' && (
                  <div>Showing of checkpoints ended at {formatDate(timeInfo.endShow)}</div>
                )}
              </div>
            )}

            {showCheckpoints && (
              <div>
                {loggingAllowed && !selectedCheckpoint.visited && (
                  <>
                    <div className="mb-3">
                      <label className="form-label">Attach Photo (optional)</label>
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
                        Log Visit {selectedImage ? 'with Photo' : ''}
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
                      Delete Visit
                    </button>
                  </div>
                )}
                {!loggingAllowed && (
                  <div className="alert alert-info">
                    {selectedCheckpoint.visited 
                      ? 'Visit logged (read-only mode)' 
                      : 'Logging is not open yet'}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ position: 'fixed', top: `${topOffset}px`, left: 0, right: 0, bottom: 0, zIndex: 1 }}>
        <div
          ref={mapRef}
          style={{ height: '100%', width: '100%' }}
        />
      </div>
    </>
  );
}

export default Map;