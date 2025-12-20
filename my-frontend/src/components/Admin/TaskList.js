import React, { useState } from 'react';
import { adminApi } from '../../services/adminApi';

export default function TaskList({ tasks = [], onRemove = () => {}, raceId = null, onImported = () => {} }) {
  const [jsonText, setJsonText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(null);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this task?')) return;
    try {
      await adminApi.deleteTask(id);
      onRemove(id);
    } catch (err) {
      console.error('Failed to delete task', err);
      alert('Delete failed');
    }
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
      alert(`Imported ${created.length} tasks`);
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
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(task.id ?? task.task_id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

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
    </div>
  );
}
