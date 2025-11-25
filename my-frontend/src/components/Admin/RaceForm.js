import React, { useState, useEffect } from 'react';
import { adminApi } from '../../services/adminApi';

export default function RaceForm({ race = null, onSaved = null, onCreated = null, onCancel = null }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startShow, setStartShow] = useState('');
  const [endShow, setEndShow] = useState('');
  const [startLogging, setStartLogging] = useState('');
  const [endLogging, setEndLogging] = useState('');
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(race && race.id);

  useEffect(() => {
    if (race) {
      setName(race.name || '');
      setDescription(race.description || '');
      // try to parse ISO -> local datetime-local value
      const toLocal = (iso) => {
        if (!iso) return '';
        const d = new Date(iso);
        const pad = (n) => String(n).padStart(2, '0');
        const yyyy = d.getFullYear();
        const mm = pad(d.getMonth() + 1);
        const dd = pad(d.getDate());
        const hh = pad(d.getHours());
        const min = pad(d.getMinutes());
        return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
      };
      setStartShow(toLocal(race.start_showing_checkpoints_at ?? race.start_showing_checkpoints ?? race.start_showing));
      setEndShow(toLocal(race.end_showing_checkpoints_at ?? race.end_showing_checkpoints ?? race.end_showing));
      setStartLogging(toLocal(race.start_logging_at ?? race.start_logging));
      setEndLogging(toLocal(race.end_logging_at ?? race.end_logging));
    } else {
      setName('');
      setDescription('');
      setStartShow('');
      setEndShow('');
      setStartLogging('');
      setEndLogging('');
    }
  }, [race]);

  const toIso = (dtLocal) => dtLocal ? new Date(dtLocal).toISOString() : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name,
        description,
        start_showing_checkpoints_at: toIso(startShow),
        end_showing_checkpoints_at: toIso(endShow),
        start_logging_at: toIso(startLogging),
        end_logging_at: toIso(endLogging),
      };
      let saved;
      if (isEdit) {
        saved = await adminApi.updateRace(race.id, payload);
      } else {
        saved = await adminApi.createRace(payload);
      }
      if (onSaved) onSaved(saved);
      if (!isEdit && onCreated) onCreated(saved);
    } catch (err) {
      console.error('Failed to save race', err);
      alert('Failed to save race');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mb-3 card p-3">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h4 className="mb-0">{isEdit ? 'Edit race' : 'Create race'}</h4>
        <div>
          {onCancel && <button type="button" className="btn btn-sm btn-outline-secondary me-2" onClick={onCancel}>Cancel</button>}
          <button className="btn btn-primary btn-sm" type="submit" disabled={saving}>{saving ? 'Saving…' : (isEdit ? 'Save' : 'Create')}</button>
        </div>
      </div>

      <div className="mb-2">
        <input
          className="form-control"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Race name"
          required
        />
      </div>

      <div className="mb-2">
        <textarea
          className="form-control"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Description"
          rows={2}
        />
      </div>

      <div className="row g-2 mb-2">
        <div className="col">
          <label className="form-label small">Start showing</label>
          <input className="form-control" type="datetime-local" value={startShow} onChange={e => setStartShow(e.target.value)} />
        </div>
        <div className="col">
          <label className="form-label small">End showing</label>
          <input className="form-control" type="datetime-local" value={endShow} onChange={e => setEndShow(e.target.value)} />
        </div>
      </div>

      <div className="row g-2 mb-3">
        <div className="col">
          <label className="form-label small">Start logging</label>
          <input className="form-control" type="datetime-local" value={startLogging} onChange={e => setStartLogging(e.target.value)} />
        </div>
        <div className="col">
          <label className="form-label small">End logging</label>
          <input className="form-control" type="datetime-local" value={endLogging} onChange={e => setEndLogging(e.target.value)} />
        </div>
      </div>
    </form>
  );
}