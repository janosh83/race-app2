import React, { useState } from 'react';
import { adminApi } from '../../services/adminApi';

export default function CheckpointList({ checkpoints = [], onRemove = () => {}, raceId = null, onImported = () => {} }) {
  const [jsonText, setJsonText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(null);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this checkpoint?')) return;
    try {
      await adminApi.deleteCheckpoint(id);
      onRemove(id);
    } catch (err) {
      console.error('Failed to delete checkpoint', err);
      alert('Delete failed');
    }
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
      alert(`Imported ${created.length} checkpoints`);
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
                <th className="text-muted">Number of points</th>
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
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(cp.id ?? cp.checkpoint_id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

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
    </div>
  );
}