import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isTokenExpired, logoutAndRedirect } from '../utils/api';
import { raceApi } from '../services/raceApi';
import { useTime, formatDate } from '../contexts/TimeContext';
import StatusBadge from './StatusBadge';
import { resizeImageWithExif } from '../utils/image';
import { logger } from '../utils/logger';
import Toast from './Toast';

function Tasks({ topOffset = 56 }) {
  const { t } = useTranslation();
  // token expiry watcher
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

  const { activeRace, timeInfo } = useTime();
  const [tasks, setTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [toast, setToast] = useState(null);
  const [taskError, setTaskError] = useState(false);

  const apiUrl = import.meta.env.VITE_API_URL;
  const activeRaceId = activeRace?.race_id ?? activeRace?.id ?? null;
  const activeTeamId = activeRace?.team_id ?? null;

  // Fetch tasks with status
  useEffect(() => {
    if (!activeRaceId || !activeTeamId) return;
    
    const fetchTasks = () => {
      logger.info('RACE', 'Fetching tasks', { raceId: activeRaceId, teamId: activeTeamId });
      setTaskError(false);
      
      raceApi
        .getTasksStatus(activeRaceId, activeTeamId)
        .then((data) => {
          logger.success('RACE', 'Tasks loaded', { count: data?.length || 0 });
          setTasks(data);
          setTaskError(false);
        })
        .catch((err) => {
          logger.error('RACE', 'Failed to fetch tasks', err.message);
          setTaskError(true);
          setToast({
            message: t('tasks.loadFailed'),
            type: 'error',
            duration: 0
          });
        });
    };

    fetchTasks();
  }, [activeRaceId, activeTeamId]);

  const loggingAllowed = timeInfo.state === 'LOGGING';
  const showTasks = timeInfo.state !== 'BEFORE_SHOW' && timeInfo.state !== 'AFTER_SHOW' && timeInfo.state !== 'UNKNOWN';

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
        message: t('tasks.imageProcessFailed'),
        type: 'error',
        duration: 5000
      });
    }
  };

  const refreshTasks = async () => {
    try {
      const data = await raceApi.getTasksStatus(activeRaceId, activeTeamId);
      logger.success('RACE', 'Tasks refreshed', { count: data?.length || 0 });
      setTasks(data);
      setTaskError(false);
    } catch (err) {
      logger.error('RACE', 'Failed to refresh tasks', err.message);
      setToast({
        message: t('tasks.refreshFailed', { message: err.message || t('tasks.unknownError') }),
        type: 'error',
        duration: 5000
      });
      throw err; // Re-throw to handle in caller
    }
  };

  const handleLogTask = async () => {
    if (!selectedTask) return;
    logger.info('RACE', 'Logging task', { taskId: selectedTask.id, hasImage: !!selectedImage });
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('task_id', selectedTask.id);
      formData.append('team_id', activeTeamId);
      if (selectedImage) {
        formData.append('image', selectedImage);
      }
      await raceApi.logTaskWithImage(activeRaceId, formData);
      await refreshTasks();
      logger.success('RACE', 'Task logged successfully', { taskId: selectedTask.id });
      setToast({
        message: t('tasks.completedSuccess'),
        type: 'success',
        duration: 3000
      });
      handleCloseOverlay();
    } catch (err) {
      logger.error('RACE', 'Failed to log task', err.message);
      setToast({
        message: t('tasks.logFailed', { message: err.message || t('tasks.unknownError') }),
        type: 'error',
        duration: 5000
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!selectedTask) return;
    logger.info('RACE', 'Deleting task completion', { taskId: selectedTask.id });
    try {
      await raceApi.deleteTaskCompletion(activeRaceId, { task_id: selectedTask.id, team_id: activeTeamId });
      await refreshTasks();
      logger.success('RACE', 'Task completion deleted', { taskId: selectedTask.id });
      setToast({
        message: t('tasks.deleteSuccess'),
        type: 'success',
        duration: 3000
      });
      handleCloseOverlay();
    } catch (err) {
      logger.error('RACE', 'Failed to delete task completion', err.message);
      setToast({
        message: t('tasks.deleteFailed', { message: err.message || t('tasks.unknownError') }),
        type: 'error',
        duration: 5000
      });
    }
  };

  const handleRetryTasks = () => {
    if (!activeRaceId || !activeTeamId) return;
    logger.info('RACE', 'Retrying task fetch', { raceId: activeRaceId, teamId: activeTeamId });
    setToast(null);
    setTaskError(false);
    
    raceApi
      .getTasksStatus(activeRaceId, activeTeamId)
      .then((data) => {
        logger.success('RACE', 'Tasks loaded after retry', { count: data?.length || 0 });
        setTasks(data);
        setTaskError(false);
        setToast({
          message: t('tasks.loadedSuccess'),
          type: 'success',
          duration: 3000
        });
      })
      .catch((err) => {
        logger.error('RACE', 'Retry failed for tasks', err.message);
        setTaskError(true);
        setToast({
          message: t('tasks.loadFailed'),
          type: 'error',
          duration: 0
        });
      });
  };

  const handleCloseOverlay = () => {
    setSelectedTask(null);
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

      {/* Retry button for task errors */}
      {taskError && (
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
            <span style={{ color: '#dc3545', fontWeight: '500' }}>⚠ {t('tasks.loadFailedShort')}</span>
          <button
            className="btn btn-sm btn-primary"
            onClick={handleRetryTasks}
          >
              {t('tasks.retry')}
          </button>
        </div>
      )}

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
              <span className="visually-hidden">{t('tasks.loading')}</span>
            </div>
            <div style={{ fontSize: '18px', fontWeight: '500' }}>{t('tasks.uploading')}</div>
          </div>
        </div>
      )}

      <StatusBadge 
        topOffset={topOffset}
        isShown={showTasks}
        loggingAllowed={loggingAllowed}
        timeInfo={timeInfo}
        itemName={t('tasks.title')}
      />

      <div className="container mt-4" style={{ paddingTop: topOffset }}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h3 className="mb-0">{t('tasks.title')}</h3>
        </div>

        {!showTasks && (
          <div className="alert alert-warning">
            {t('tasks.notShown')}
            {timeInfo.state === 'BEFORE_SHOW' && (
              <div>{t('tasks.showAt', { time: formatDate(timeInfo.startShow) })}</div>
            )}
            {timeInfo.state === 'AFTER_SHOW' && (
              <div>{t('tasks.endedAt', { time: formatDate(timeInfo.endShow) })}</div>
            )}
          </div>
        )}

        {showTasks && (
          <div className="row g-3">
            {tasks.map((task) => (
              <div className="col-12 col-md-6 col-lg-4" key={task.id}>
                <div className="card h-100" style={{ cursor: 'pointer' }} onClick={() => setSelectedTask(task)}>
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <h5 className="card-title mb-0">{task.title}</h5>
                      <span className={`badge ${task.completed ? 'bg-success' : 'bg-secondary'}`}>
                        {task.completed ? t('tasks.completed') : t('tasks.pending')}
                      </span>
                    </div>
                    {task.description && <p className="card-text text-muted small">{task.description}</p>}
                    <div className="d-flex justify-content-between align-items-center mt-2">
                      <span className="badge bg-primary">{t('tasks.points', { count: task.numOfPoints })}</span>
                      {task.completed && task.image_filename && (
                        <span className="text-muted small">{t('tasks.photoAttached')}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {tasks.length === 0 && (
              <div className="col-12">
                <div className="alert alert-info">{t('tasks.noneAvailable')}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedTask && (
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
              <h3>{selectedTask.title}</h3>
              <button className="btn btn-sm btn-outline-secondary" onClick={handleCloseOverlay}>
                ✕ {t('tasks.close')}
              </button>
            </div>

            {selectedTask.description && (
              <div className="mb-3">
                <p>{selectedTask.description}</p>
              </div>
            )}

            <div className="mb-3">
              <span className={`badge ${selectedTask.completed ? 'bg-success' : 'bg-secondary'}`}>
                {selectedTask.completed ? `✓ ${t('tasks.completed')}` : t('tasks.notCompleted')}
              </span>
              <span className="badge bg-primary ms-2">{t('tasks.points', { count: selectedTask.numOfPoints })}</span>
            </div>

            {selectedTask.completed && selectedTask.image_filename && (
              <div className="mb-3">
                <label className="form-label">{t('tasks.completionPhotoLabel')}</label>
                <div>
                  <img
                    src={`${apiUrl}/static/images/${selectedTask.image_filename}`}
                    alt={t('tasks.completionPhotoAlt')}
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
              <label className="form-label">{t('tasks.uploadPhoto')}</label>
              <input type="file" accept="image/*" className="form-control" onChange={handleImageSelect} />
              <div className="form-text">{t('tasks.imageHelp')}</div>
            </div>

            {!loggingAllowed && (
              <div className="alert alert-warning">{t('tasks.loggingClosed')}</div>
            )}

            <div className="d-flex gap-2">
              <button
                className="btn btn-primary"
                onClick={handleLogTask}
                disabled={!loggingAllowed}
              >
                {selectedTask.completed ? t('tasks.reupload') : t('tasks.markCompleted')}
              </button>
              {selectedTask.completed && (
                <button
                  className="btn btn-outline-danger"
                  onClick={handleDeleteTask}
                  disabled={!loggingAllowed}
                >
                  {t('tasks.deleteCompletion')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Tasks;
