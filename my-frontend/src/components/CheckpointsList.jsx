import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useTime, formatDate } from '../contexts/TimeContext';
import { raceApi } from '../services/raceApi';
import { isTokenExpired, logoutAndRedirect } from '../utils/api';
import { resizeImageWithExif } from '../utils/image';
import { logger } from '../utils/logger';

import StatusBadge from './StatusBadge';
import Toast from './Toast';

function CheckpointsList({ topOffset = 56 }) {
  const { t } = useTranslation();

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

  const { activeRace, timeInfo, selectedLanguage } = useTime();
  const [checkpoints, setCheckpoints] = useState([]);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [toast, setToast] = useState(null);
  const [checkpointError, setCheckpointError] = useState(false);

  const apiUrl = import.meta.env.VITE_API_URL;
  const activeRaceId = activeRace?.race_id ?? activeRace?.id ?? null;
  const activeTeamId = activeRace?.team_id ?? null;

  useEffect(() => {
    if (!activeRaceId || !activeTeamId) return;

    const fetchCheckpoints = () => {
      logger.info('RACE', 'Fetching checkpoints for list', { raceId: activeRaceId, teamId: activeTeamId, language: selectedLanguage });
      setCheckpointError(false);

      raceApi
        .getCheckpointsStatus(activeRaceId, activeTeamId, selectedLanguage)
        .then((data) => {
          logger.success('RACE', 'Checkpoints loaded for list', { count: data?.length || 0 });
          setCheckpoints(data);
          setCheckpointError(false);
        })
        .catch((err) => {
          logger.error('RACE', 'Failed to fetch checkpoints for list', err.message);
          setCheckpointError(true);
          setToast({
            message: t('map.checkpointsLoadFailed'),
            type: 'error',
            duration: 0,
          });
        });
    };

    fetchCheckpoints();
  }, [activeRaceId, activeTeamId, selectedLanguage, t]);

  const loggingAllowed = timeInfo.state === 'LOGGING';
  const showCheckpoints = timeInfo.state !== 'BEFORE_SHOW' && timeInfo.state !== 'AFTER_SHOW' && timeInfo.state !== 'UNKNOWN';

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { resizedFile, previewDataUrl } = await resizeImageWithExif(file);
      setSelectedImage(resizedFile);
      setImagePreview(previewDataUrl);
    } catch (err) {
      logger.error('IMAGE', 'Failed to process image', err?.message || err);
      setToast({
        message: t('map.imageProcessFailed'),
        type: 'error',
        duration: 5000,
      });
    }
  };

  const refreshCheckpoints = async () => {
    try {
      const data = await raceApi.getCheckpointsStatus(activeRaceId, activeTeamId, selectedLanguage);
      logger.success('RACE', 'Checkpoints refreshed for list', { count: data?.length || 0 });
      setCheckpoints(data);
      setCheckpointError(false);
    } catch (err) {
      logger.error('RACE', 'Failed to refresh checkpoints', err.message);
      setToast({
        message: t('map.visitLogFailed', { message: err.message || t('map.unknownError') }),
        type: 'error',
        duration: 5000,
      });
      throw err;
    }
  };

  const handleLogVisit = async () => {
    if (!selectedCheckpoint) return;
    logger.info('RACE', 'Logging checkpoint from list', { checkpointId: selectedCheckpoint.id, hasImage: !!selectedImage });
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('checkpoint_id', selectedCheckpoint.id);
      formData.append('team_id', activeTeamId);
      if (selectedImage) {
        formData.append('image', selectedImage);
      }

      await raceApi.logVisitWithImage(activeRaceId, formData);
      await refreshCheckpoints();
      setToast({
        message: t('map.visitLogged'),
        type: 'success',
        duration: 3000,
      });
      handleCloseOverlay();
    } catch (err) {
      logger.error('RACE', 'Failed to log checkpoint from list', err.message);
      setToast({
        message: t('map.visitLogFailed', { message: err.message || t('map.unknownError') }),
        type: 'error',
        duration: 5000,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteVisit = async () => {
    if (!selectedCheckpoint) return;
    logger.info('RACE', 'Deleting checkpoint visit from list', { checkpointId: selectedCheckpoint.id });
    try {
      await raceApi.deleteVisit(activeRaceId, { checkpoint_id: selectedCheckpoint.id, team_id: activeTeamId });
      await refreshCheckpoints();
      setToast({
        message: t('tasks.deleteSuccess'),
        type: 'success',
        duration: 3000,
      });
      handleCloseOverlay();
    } catch (err) {
      logger.error('RACE', 'Failed to delete checkpoint visit from list', err.message);
      setToast({
        message: t('map.visitDeleteFailed', { message: err.message || t('map.unknownError') }),
        type: 'error',
        duration: 5000,
      });
    }
  };

  const handleRetry = () => {
    if (!activeRaceId || !activeTeamId) return;
    logger.info('RACE', 'Retrying checkpoint fetch for list', { raceId: activeRaceId, teamId: activeTeamId });
    setToast(null);
    setCheckpointError(false);

    raceApi
      .getCheckpointsStatus(activeRaceId, activeTeamId, selectedLanguage)
      .then((data) => {
        setCheckpoints(data);
        setCheckpointError(false);
        setToast({
          message: t('map.checkpointsLoaded'),
          type: 'success',
          duration: 3000,
        });
      })
      .catch((err) => {
        logger.error('RACE', 'Retry failed for checkpoint list', err.message);
        setCheckpointError(true);
        setToast({
          message: t('map.checkpointsLoadFailed'),
          type: 'error',
          duration: 0,
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
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={() => setToast(null)}
        />
      )}

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
            gap: '12px',
          }}
        >
          <span style={{ color: '#dc3545', fontWeight: '500' }}>⚠ {t('map.checkpointsLoadFailed')}</span>
          <button className="btn btn-sm btn-primary" onClick={handleRetry}>
            {t('map.retry')}
          </button>
        </div>
      )}

      {isUploading && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            zIndex: 3000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ backgroundColor: 'white', padding: '30px 40px', borderRadius: '8px', textAlign: 'center' }}>
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

      <div className="container mt-4" style={{ paddingTop: topOffset }}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h3 className="mb-0">{t('map.checkpoints')}</h3>
        </div>

        {!showCheckpoints && (
          <div className="alert alert-warning">
            {t('map.checkpointsNotShown')}
            {timeInfo.state === 'BEFORE_SHOW' && <div>{t('map.checkpointsShowAt', { time: formatDate(timeInfo.startShow) })}</div>}
            {timeInfo.state === 'AFTER_SHOW' && <div>{t('map.checkpointsEndedAt', { time: formatDate(timeInfo.endShow) })}</div>}
          </div>
        )}

        {showCheckpoints && (
          <div className="row g-3">
            {checkpoints.map((checkpoint) => (
              <div className="col-12 col-md-6 col-lg-4" key={checkpoint.id}>
                <div className="card h-100" style={{ cursor: 'pointer' }} onClick={() => setSelectedCheckpoint(checkpoint)}>
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <h5 className="card-title mb-0">{checkpoint.title}</h5>
                      <span className={`badge ${checkpoint.visited ? 'bg-success' : 'bg-secondary'}`}>
                        {checkpoint.visited ? t('map.visited') : t('map.notVisited')}
                      </span>
                    </div>
                    {checkpoint.description && <p className="card-text text-muted small">{checkpoint.description}</p>}
                    <div className="d-flex justify-content-between align-items-center mt-2">
                      <span className="badge bg-primary">{t('tasks.points', { count: checkpoint.numOfPoints || 0 })}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {checkpoints.length === 0 && (
              <div className="col-12">
                <div className="alert alert-info">{t('checkpointsList.noneAvailable')}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedCheckpoint && (
        <div
          style={{
            position: 'fixed',
            top: topOffset,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'white',
            zIndex: 2000,
            overflowY: 'auto',
            padding: '20px',
          }}
        >
          <div className="container">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h3>{selectedCheckpoint.title}</h3>
              <button className="btn btn-sm btn-outline-secondary" onClick={handleCloseOverlay}>
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
              <span className="badge bg-primary ms-2">{t('tasks.points', { count: selectedCheckpoint.numOfPoints || 0 })}</span>
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

            {imagePreview && (
              <div className="mb-3">
                <label className="form-label">{t('tasks.previewLabel')}</label>
                <div>
                  <img
                    src={imagePreview}
                    alt={t('tasks.previewAlt')}
                    style={{ maxWidth: '100%', maxHeight: '300px', objectFit: 'contain', borderRadius: '8px' }}
                  />
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="form-label">{t('map.attachPhoto')}</label>
              <input type="file" accept="image/*" className="form-control" onChange={handleImageSelect} />
              <div className="form-text">{t('tasks.imageHelp')}</div>
            </div>

            {!loggingAllowed && <div className="alert alert-warning">{t('tasks.loggingClosed')}</div>}

            <div className="d-flex gap-2">
              <button className="btn btn-primary" onClick={handleLogVisit} disabled={!loggingAllowed}>
                {selectedCheckpoint.visited ? t('map.logVisitWithPhoto') : t('map.logVisit')}
              </button>
              {selectedCheckpoint.visited && (
                <button className="btn btn-outline-danger" onClick={handleDeleteVisit} disabled={!loggingAllowed}>
                  {t('map.deleteVisit')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default CheckpointsList;
