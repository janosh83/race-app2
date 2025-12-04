import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { isTokenExpired, logoutAndRedirect } from '../utils/api';
import { raceApi } from '../services/raceApi';
import { useTime, formatDate } from '../contexts/TimeContext';
import piexif from 'piexifjs';

function Map({ topOffset = 56 }) {
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
  const [selectedCheckpoint, setSelectedCheckpoint] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
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

      // Open full-screen overlay on marker click
      marker.on('click', () => {
        setSelectedCheckpoint(cp);
      });
    });
  }, [checkpoints, activeRaceId, activeTeamId, apiUrl, timeInfo.state]);

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

  const loggingAllowed = timeInfo.state === 'LOGGING';
  const showCheckpoints = ['SHOW_ONLY', 'LOGGING', 'POST_LOG_SHOW'].includes(timeInfo.state);

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result;
      let exifObj = null;
      let exifStr = '';
      // Only process EXIF for JPEG
      if (file.type === 'image/jpeg') {
        try {
          exifObj = piexif.load(dataUrl);
          exifStr = piexif.dump(exifObj);
        } catch (err) {
          exifStr = '';
        }
      }
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        const maxSize = 1000;
        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          // Read canvas as DataURL to inject EXIF
          const fr = new FileReader();
          fr.onloadend = () => {
            let jpegDataUrl = fr.result;
            if (file.type === 'image/jpeg' && exifStr) {
              // Inject EXIF into resized JPEG
              jpegDataUrl = piexif.insert(exifStr, jpegDataUrl);
            }
            // Convert DataURL to Blob
            const arr = jpegDataUrl.split(',');
            const mime = arr[0].match(/:(.*?);/)[1];
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
              u8arr[n] = bstr.charCodeAt(n);
            }
            const finalBlob = new Blob([u8arr], { type: mime });
            const resizedFile = new File([finalBlob], file.name, { type: mime });
            setSelectedImage(resizedFile);
            setImagePreview(jpegDataUrl);
          };
          fr.readAsDataURL(blob);
        }, 'image/jpeg', 0.9);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleLogVisit = async () => {
    if (!selectedCheckpoint) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('checkpoint_id', selectedCheckpoint.id);
      formData.append('team_id', activeTeamId);
      if (selectedImage) {
        formData.append('image', selectedImage);
      }

      await raceApi.logVisitWithImage(activeRaceId, formData);
      const data = await raceApi.getCheckpointsStatus(activeRaceId, activeTeamId);
      setCheckpoints(data);
      setSelectedCheckpoint(null);
      setSelectedImage(null);
      setImagePreview(null);
    } catch (err) {
      console.error('Failed to log visit:', err);
      alert(err.message || 'Failed to log visit.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteVisit = async () => {
    if (!selectedCheckpoint) return;
    try {
      await raceApi.deleteVisit(activeRaceId, { checkpoint_id: selectedCheckpoint.id, team_id: activeTeamId });
      const data = await raceApi.getCheckpointsStatus(activeRaceId, activeTeamId);
      setCheckpoints(data);
      setSelectedCheckpoint(null);
    } catch (err) {
      console.error('Failed to delete visit:', err);
      alert('Failed to delete visit.');
    }
  };

  const handleCloseOverlay = () => {
    setSelectedCheckpoint(null);
    setSelectedImage(null);
    setImagePreview(null);
  };

  return (
    <>
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

      {overlayMessage && (
        <div style={{
          position: 'fixed',
          top: topOffset,
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