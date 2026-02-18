import React, { useState, useEffect } from 'react';
import { adminApi } from '../../services/adminApi';
import Toast from '../Toast';
import TranslationManager from './TranslationManager';
import LanguageFlagsDisplay from '../LanguageFlagsDisplay';

export default function TaskList({ tasks = [], onRemove = () => {}, raceId = null, onImported = () => {}, onUpdate = () => {}, supportedLanguages = [] }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [taskTranslations, setTaskTranslations] = useState({});
  const [toast, setToast] = useState(null);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    numOfPoints: ''
  });

  // Fetch translations for all tasks
  useEffect(() => {
    const fetchAllTranslations = async () => {
      const taskIds = tasks.map(t => t.id ?? t.task_id).filter(Boolean);
      const currentIds = Object.keys(taskTranslations).map(Number);
      
      // Only fetch for tasks we don't have translations for yet
      const idsToFetch = taskIds.filter(id => !currentIds.includes(id));
      
      if (idsToFetch.length === 0) {
        // Clean up translations for removed tasks
        const removedIds = currentIds.filter(id => !taskIds.includes(id));
        if (removedIds.length > 0) {
          setTaskTranslations(prev => {
            const cleanedMap = { ...prev };
            removedIds.forEach(id => delete cleanedMap[id]);
            return cleanedMap;
          });
        }
        return;
      }
      
      const newTranslations = {};
      for (const taskId of idsToFetch) {
        try {
          const data = await adminApi.getTaskTranslations(taskId);
          newTranslations[taskId] = Array.isArray(data) ? data : (data?.data || []);
        } catch (e) {
          console.error(`Failed to load translations for task ${taskId}`, e);
          newTranslations[taskId] = [];
        }
      }
      
      setTaskTranslations(prev => ({ ...prev, ...newTranslations }));
    };

    if (tasks.length > 0) {
      fetchAllTranslations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks.map(t => t.id ?? t.task_id).join(',')]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this task?')) return;
    try {
      await adminApi.deleteTask(id);
      onRemove(id);
      setToast({
        message: 'Task deleted successfully',
        type: 'success',
        duration: 5000
      });
    } catch (err) {
      console.error('Failed to delete task', err);
      setToast({
        message: 'Delete failed: ' + (err?.message || 'Unknown error'),
        type: 'error',
        duration: 5000
      });
    }
  };

  const handleEdit = (task) => {
    setEditingId(task.id ?? task.task_id);
    setEditForm({
      title: task.title ?? '',
      description: task.description ?? '',
      numOfPoints: task.numOfPoints ?? task.points ?? 0
    });
  };

  const handleEditChange = (field, value) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        title: editForm.title,
        description: editForm.description,
        numOfPoints: editForm.numOfPoints ? parseInt(editForm.numOfPoints) : 0
      };
      await adminApi.updateTask(editingId, payload);
      onUpdate(editingId, payload);
      setEditingId(null);
      setToast({
        message: 'Task updated successfully',
        type: 'success',
        duration: 5000
      });
    } catch (err) {
      console.error('Failed to update task', err);
      setToast({
        message: 'Update failed: ' + (err?.message || 'Unknown error'),
        type: 'error',
        duration: 5000
      });
    }
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditForm({
      title: '',
      description: '',
      numOfPoints: ''
    });
  };

  const validateItem = (it) => {
    if (!it || typeof it !== 'object') return 'Item is not an object';
    if (!it.name && !it.title) return 'Missing "name" or "title"';
    return null;
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setSelectedFile(file);
    setImportError(null);
  };

  const handleImport = async (e) => {
    e.preventDefault();
    setImportError(null);
    
    if (!selectedFile) {
      setImportError('Please select a JSON file');
      return;
    }
    
    if (!raceId) {
      setImportError('Race ID is missing. Select a race first.');
      return;
    }
    
    // Read file content
    const fileContent = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target.result);
      reader.onerror = (error) => reject(error);
      reader.readAsText(selectedFile);
    });
    
    let parsed;
    try {
      parsed = JSON.parse(fileContent);
    } catch (err) {
      setImportError('Invalid JSON: ' + err.message);
      return;
    }
    if (!Array.isArray(parsed)) {
      setImportError('Expected JSON array of tasks');
      return;
    }
    const errors = parsed.map(validateItem).filter(Boolean);
    if (errors.length) {
      setImportError('Validation failed: ' + errors[0]);
      return;
    }

    setImporting(true);
    try {
      const created = [];
      let translationsCount = 0;
      for (const it of parsed) {
        const payload = {
          title: it.title ?? it.name,
          description: it.description ?? it.desc ?? null,
          numOfPoints: it.numOfPoints ?? it.points ?? 0,
        };
        const task = await adminApi.addTask(raceId, payload);
        created.push(task);
        
        // Import translations for this task
        const translations = it.translations || [];
        for (const trans of translations) {
          if (trans.language) {
            try {
              const translationPayload = {
                title: trans.title ?? trans.name ?? null,
                description: trans.description ?? null
              };
              await adminApi.createTaskTranslation(task.id, trans.language, translationPayload);
              translationsCount++;
            } catch (e) {
              console.error(`Failed to create translation ${trans.language} for task ${task.id}`, e);
            }
          }
        }
      }
      onImported(created);
      setSelectedFile(null);
      // Reset file input
      const fileInput = document.getElementById('task-file-input');
      if (fileInput) fileInput.value = '';
      
      const msg = translationsCount > 0
        ? `Imported ${created.length} tasks with ${translationsCount} translations`
        : `Imported ${created.length} tasks successfully`;
      setToast({
        message: msg,
        type: 'success',
        duration: 5000
      });
    } catch (err) {
      console.error('Import failed', err);
      setImportError(err?.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="mb-3">
      <h5>Tasks</h5>

      <div className="mb-2">
        {tasks.length === 0 ? (
          <div className="text-muted">No tasks</div>
        ) : (
          <div className="list-group">
            {tasks.map(task => {
              const taskId = task.id ?? task.task_id;
              const isExpanded = expandedId === taskId;
              const translations = taskTranslations[taskId] || [];
              const translationLanguages = translations.map(t => t.language);
              
              return (
                <div key={taskId} className="list-group-item">
                  <div className="d-flex justify-content-between align-items-start">
                    <div className="flex-grow-1" style={{ cursor: 'pointer' }} onClick={() => setExpandedId(isExpanded ? null : taskId)}>
                      <div className="d-flex align-items-center gap-2">
                        <span className="me-1">{isExpanded ? '▼' : '▶'}</span>
                        <strong>{task.title ?? task.name}</strong>
                        {translationLanguages.length > 0 && (
                          <LanguageFlagsDisplay 
                            languages={translationLanguages}
                            flagWidth={20}
                            flagHeight={14}
                          />
                        )}
                        <span className="badge bg-secondary">{task.numOfPoints ?? task.points ?? 0} pts</span>
                      </div>
                    </div>
                    <div className="d-flex gap-1">
                      <button className="btn btn-sm btn-outline-primary" onClick={(e) => { e.stopPropagation(); handleEdit(task); }}>Edit</button>
                      <button className="btn btn-sm btn-outline-danger" onClick={(e) => { e.stopPropagation(); handleDelete(taskId); }}>Delete</button>
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-top">
                      <div className="row">
                        <div className="col-md-6">
                          <h6 className="text-muted small">Details</h6>
                          <dl className="row small">
                            <dt className="col-sm-4">Description:</dt>
                            <dd className="col-sm-8">{task.description || <span className="text-muted">—</span>}</dd>
                            
                            <dt className="col-sm-4">Points:</dt>
                            <dd className="col-sm-8">{task.numOfPoints ?? task.points ?? 0}</dd>
                          </dl>
                        </div>
                        
                        <div className="col-md-6">
                          <h6 className="text-muted small">Translations</h6>
                          <TranslationManager
                            entityType="task"
                            entityId={taskId}
                            entityName={task.title ?? task.name}
                            fields={{ title: 'Title', description: 'Description' }}
                            supportedLanguages={supportedLanguages}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingId !== null && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Edit Task</h5>
                <button type="button" className="btn-close" onClick={handleEditCancel}></button>
              </div>
              <form onSubmit={handleEditSubmit}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Title</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editForm.title}
                      onChange={(e) => handleEditChange('title', e.target.value)}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Description</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      value={editForm.description}
                      onChange={(e) => handleEditChange('description', e.target.value)}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Number of Points</label>
                    <input
                      type="number"
                      className="form-control"
                      value={editForm.numOfPoints}
                      onChange={(e) => handleEditChange('numOfPoints', e.target.value)}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={handleEditCancel}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Save Changes</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="card card-body">
        <form onSubmit={handleImport}>
          <label className="form-label">Import tasks from JSON file</label>
          <input
            id="task-file-input"
            type="file"
            accept=".json"
            className="form-control mb-2"
            onChange={handleFileChange}
            disabled={importing}
          />
          {importError && <div className="alert alert-danger">{importError}</div>}
          <div className="d-flex gap-2">
            <button className="btn btn-primary" type="submit" disabled={importing || !selectedFile}>
              {importing ? 'Importing…' : 'Import JSON'}
            </button>
            <button 
              type="button" 
              className="btn btn-outline-secondary" 
              onClick={() => {
                setSelectedFile(null);
                const fileInput = document.getElementById('task-file-input');
                if (fileInput) fileInput.value = '';
              }} 
              disabled={importing || !selectedFile}
            >
              Clear
            </button>
          </div>
          <div className="small text-muted mt-2">
            JSON must be an array of objects. Supported fields: title/name, description, numOfPoints/points, translations.
          </div>
        </form>
      </div>

      {/* Toast notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
