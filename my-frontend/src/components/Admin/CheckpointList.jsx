import React, { useState } from 'react';
import { adminApi } from '../../services/adminApi';
import Toast from '../Toast';

export default function CheckpointList({ checkpoints = [], onRemove = () => {}, raceId = null, onImported = () => {}, onUpdate = () => {} }) {
  const [jsonText, setJsonText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [toast, setToast] = useState(null);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    latitude: '',
    longitude: '',
    numOfPoints: ''
  });

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this checkpoint?')) return;
    try {
      await adminApi.deleteCheckpoint(id);
      onRemove(id);
      setToast({
        message: 'Checkpoint deleted successfully',
        type: 'success',
        duration: 5000
      });
    } catch (err) {
      console.error('Failed to delete checkpoint', err);
      setToast({
        message: 'Delete failed: ' + (err?.message || 'Unknown error'),
        type: 'error',
        duration: 5000
      });
    }
  };

  const handleEdit = (checkpoint) => {
    setEditingId(checkpoint.id ?? checkpoint.checkpoint_id);
    setEditForm({
      title: checkpoint.name ?? checkpoint.title ?? '',
      description: checkpoint.description ?? '',
      latitude: checkpoint.lat ?? checkpoint.latitude ?? '',
      longitude: checkpoint.lng ?? checkpoint.longitude ?? '',
      numOfPoints: checkpoint.numOfPoints ?? 0
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
        latitude: editForm.latitude ? parseFloat(editForm.latitude) : null,
        longitude: editForm.longitude ? parseFloat(editForm.longitude) : null,
        numOfPoints: editForm.numOfPoints ? parseInt(editForm.numOfPoints) : 0
      };
      await adminApi.updateCheckpoint(editingId, payload);
      onUpdate(editingId, payload);
      setEditingId(null);
      setToast({
        message: 'Checkpoint updated successfully',
        type: 'success',
        duration: 5000
      });
    } catch (err) {
      console.error('Failed to update checkpoint', err);
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
      latitude: '',
      longitude: '',
      numOfPoints: ''
    });
  };

  const validateItem = (it) => {
    // minimal validation: name present
    if (!it || typeof it !== 'object') return 'Item is not an object';
    if (!it.name && !it.title) return 'Missing "name"';
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
      setImportError('Expected JSON array of checkpoints');
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
      // create sequentially to simplify rate/ordering; could use Promise.all
      for (const it of parsed) {
        // map common field names
        const payload = {
          name: it.name ?? it.title,
          description: it.description ?? it.desc ?? null,
          lat: it.lat ?? it.latitude ?? it.y ?? null,
          lng: it.lng ?? it.longitude ?? it.x ?? null,
          sequence: it.sequence ?? it.order ?? null,
          metadata: it.metadata ?? null,
        };
        const cp = await adminApi.addCheckpoint(raceId, payload);
        created.push(cp);
      }
      // notify parent and clear textarea
      onImported(created);
      setJsonText('');
      setToast({
        message: `Imported ${created.length} checkpoints successfully`,
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
      <h5>Checkpoints</h5>

      <div className="mb-2">
        {checkpoints.length === 0 ? (
          <div className="text-muted">No checkpoints</div>
        ) : (
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th className="text-muted">Coords</th>
                <th className="text-muted">Points</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {checkpoints.map(cp => (
                <tr key={cp.id ?? cp.checkpoint_id ?? cp.name}>
                  <td>{cp.name ?? cp.title}</td>
                  <td>{cp.description }</td>
                  <td className="text-muted">
                    {(cp.lat ?? cp.latitude ?? cp.y) && (cp.lng ?? cp.longitude ?? cp.x)
                      ? `${cp.lat ?? cp.latitude ?? cp.y}, ${cp.lng ?? cp.longitude ?? cp.x}`
                      : '—'}
                  </td>
                  <td className="text-muted">{cp.numOfPoints}</td>
                  <td>
                    <button className="btn btn-sm btn-primary me-2" onClick={() => handleEdit(cp)}>Edit</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(cp.id ?? cp.checkpoint_id)}>Delete</button>
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
                <h5 className="modal-title">Edit Checkpoint</h5>
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
                    <label className="form-label">Latitude</label>
                    <input
                      type="number"
                      step="0.0001"
                      className="form-control"
                      value={editForm.latitude}
                      onChange={(e) => handleEditChange('latitude', e.target.value)}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Longitude</label>
                    <input
                      type="number"
                      step="0.0001"
                      className="form-control"
                      value={editForm.longitude}
                      onChange={(e) => handleEditChange('longitude', e.target.value)}
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
          <label className="form-label">Import checkpoints (JSON array)</label>
          <textarea
            className="form-control mb-2"
            rows={6}
            placeholder='[{"title":"CP1","description":"some description", "lat":49.87,"lng":14.89,"numOfPoints":1}, {"title":"CP2",...}]'
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
            JSON must be an array of objects. Supported fields: title, description, lat/latitude/y, lng/longitude/x, numOfPoints.
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