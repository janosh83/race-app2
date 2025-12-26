import React, { useEffect, useState } from 'react';
import piexif from 'piexifjs';
import { isTokenExpired, logoutAndRedirect } from '../utils/api';
import { raceApi } from '../services/raceApi';
import { useTime, formatDate } from '../contexts/TimeContext';

function Tasks({ topOffset = 56 }) {
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

  const apiUrl = process.env.REACT_APP_API_URL;
  const activeRaceId = activeRace?.race_id ?? activeRace?.id ?? null;
  const activeTeamId = activeRace?.team_id ?? null;

  // Fetch tasks with status
  useEffect(() => {
    if (!activeRaceId || !activeTeamId) return;
    let mounted = true;
    raceApi
      .getTasksStatus(activeRaceId, activeTeamId)
      .then((data) => {
        if (mounted) setTasks(data);
      })
      .catch((err) => console.error('Failed to fetch tasks:', err));
    return () => {
      mounted = false;
    };
  }, [activeRaceId, activeTeamId]);

  const loggingAllowed = timeInfo.state === 'LOGGING';

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result;
      let exifObj = null;
      let exifStr = '';
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
          const fr = new FileReader();
          fr.onloadend = () => {
            let jpegDataUrl = fr.result;
            if (file.type === 'image/jpeg' && exifStr) {
              jpegDataUrl = piexif.insert(exifStr, jpegDataUrl);
            }
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

  const refreshTasks = async () => {
    const data = await raceApi.getTasksStatus(activeRaceId, activeTeamId);
    setTasks(data);
  };

  const handleLogTask = async () => {
    if (!selectedTask) return;
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
      handleCloseOverlay();
    } catch (err) {
      console.error('Failed to log task:', err);
      alert(err.message || 'Failed to log task.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!selectedTask) return;
    try {
      await raceApi.deleteTaskCompletion(activeRaceId, { task_id: selectedTask.id, team_id: activeTeamId });
      await refreshTasks();
      handleCloseOverlay();
    } catch (err) {
      console.error('Failed to delete task completion:', err);
      alert('Failed to delete task completion.');
    }
  };

  const handleCloseOverlay = () => {
    setSelectedTask(null);
    setSelectedImage(null);
    setImagePreview(null);
  };

  return (
    <>
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

      <div style={{
        position: 'fixed',
        top: topOffset ? topOffset + 8 : 16,
        right: 16,
        zIndex: 1500
      }}>
        <span className={`badge ${loggingAllowed ? 'bg-success' : 'bg-secondary'}`}>
          {loggingAllowed ? 'Logging open' : 'Read-only'}
        </span>
      </div>

      <div className="container mt-4" style={{ paddingTop: topOffset }}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h3 className="mb-0">Tasks</h3>
        </div>

        <div className="row g-3">
          {tasks.map((task) => (
            <div className="col-12 col-md-6 col-lg-4" key={task.id}>
              <div className="card h-100" style={{ cursor: 'pointer' }} onClick={() => setSelectedTask(task)}>
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <h5 className="card-title mb-0">{task.title}</h5>
                    <span className={`badge ${task.completed ? 'bg-success' : 'bg-secondary'}`}>
                      {task.completed ? 'Completed' : 'Pending'}
                    </span>
                  </div>
                  {task.description && <p className="card-text text-muted small">{task.description}</p>}
                  <div className="d-flex justify-content-between align-items-center mt-2">
                    <span className="badge bg-primary">{task.numOfPoints} pts</span>
                    {task.completed && task.image_filename && (
                      <span className="text-muted small">📷 Photo attached</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {tasks.length === 0 && (
            <div className="col-12">
              <div className="alert alert-info">No tasks available for this race.</div>
            </div>
          )}
        </div>
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
                ✕ Close
              </button>
            </div>

            {selectedTask.description && (
              <div className="mb-3">
                <p>{selectedTask.description}</p>
              </div>
            )}

            <div className="mb-3">
              <span className={`badge ${selectedTask.completed ? 'bg-success' : 'bg-secondary'}`}>
                {selectedTask.completed ? '✓ Completed' : 'Not completed'}
              </span>
              <span className="badge bg-primary ms-2">{selectedTask.numOfPoints} pts</span>
            </div>

            {selectedTask.completed && selectedTask.image_filename && (
              <div className="mb-3">
                <label className="form-label">Completion Photo:</label>
                <div>
                  <img
                    src={`${apiUrl}/static/images/${selectedTask.image_filename}`}
                    alt="Completion photo"
                    style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain', borderRadius: '8px' }}
                  />
                </div>
              </div>
            )}

            {imagePreview && (
              <div className="mb-3">
                <label className="form-label">Preview (resized):</label>
                <div>
                  <img
                    src={imagePreview}
                    alt="Preview"
                    style={{ maxWidth: '100%', maxHeight: '300px', objectFit: 'contain', borderRadius: '8px' }}
                  />
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="form-label">Upload photo (optional)</label>
              <input type="file" accept="image/*" className="form-control" onChange={handleImageSelect} />
              <div className="form-text">Images are resized to max 1000px, EXIF preserved for JPEG.</div>
            </div>

            {!loggingAllowed && (
              <div className="alert alert-warning">Logging window is closed. You can only view tasks.</div>
            )}

            <div className="d-flex gap-2">
              <button
                className="btn btn-primary"
                onClick={handleLogTask}
                disabled={!loggingAllowed}
              >
                {selectedTask.completed ? 'Re-upload / Update' : 'Mark as completed'}
              </button>
              {selectedTask.completed && (
                <button
                  className="btn btn-outline-danger"
                  onClick={handleDeleteTask}
                  disabled={!loggingAllowed}
                >
                  Delete completion
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
