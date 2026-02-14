import React, { useState } from 'react';
import { adminApi } from '../../services/adminApi';
import Toast from '../Toast';

export default function TaskList({ tasks = [], onRemove = () => {}, raceId = null, onImported = () => {}, onUpdate = () => {} }) {
  const [jsonText, setJsonText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [toast, setToast] = useState(null);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    numOfPoints: ''
  });

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

  const handleImport = async (e) => {
    e.preventDefault();
    setImportError(null);
    if (!raceId) {
      setImportError('Race ID is missing. Select a race first.');
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(jsonText);
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
      for (const it of parsed) {
        const payload = {
          title: it.title ?? it.name,
          description: it.description ?? it.desc ?? null,
          numOfPoints: it.numOfPoints ?? it.points ?? 0,
        };
        const task = await adminApi.addTask(raceId, payload);
        created.push(task);
      }
      onImported(created);
      setJsonText('');
      setToast({
        message: `Imported ${created.length} tasks successfully`,
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
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Title</th>
                <th>Description</th>
                <th className="text-muted">Points</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(task => (
                <tr key={task.id ?? task.task_id ?? task.title}>
                  <td>{task.title ?? task.name}</td>
                  <td>{task.description}</td>
                  <td className="text-muted">{task.numOfPoints ?? task.points ?? 0}</td>
                  <td>
                    <button className="btn btn-sm btn-primary me-2" onClick={() => handleEdit(task)}>Edit</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(task.id ?? task.task_id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
          <label className="form-label">Import tasks (JSON array)</label>
          <textarea
            className="form-control mb-2"
            rows={6}
            placeholder='[{"title":"Task 1","description":"Complete this task", "numOfPoints":10}, {"title":"Task 2",...}]'
            value={jsonText}
            onChange={e => setJsonText(e.target.value)}
            disabled={importing}
          />
          {importError && <div className="alert alert-danger">{importError}</div>}
          <div className="d-flex gap-2">
            <button className="btn btn-primary" type="submit" disabled={importing}>
              {importing ? 'Importing…' : 'Import JSON'}
            </button>
            <button type="button" className="btn btn-outline-secondary" onClick={() => setJsonText('')} disabled={importing}>Clear</button>
          </div>
          <div className="small text-muted mt-2">
            JSON must be an array of objects. Supported fields: title/name, description, numOfPoints/points.
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
