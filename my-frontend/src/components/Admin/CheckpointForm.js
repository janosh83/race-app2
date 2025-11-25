import React, { useState } from 'react';
import { adminApi } from '../../services/adminApi';

export default function CheckpointForm({ raceId, onCheckpointAdded }) {
  const [name, setName] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const newCheckpoint = await adminApi.addCheckpoint(raceId, { name });
      onCheckpointAdded(newCheckpoint);
      setName('');
    } catch (error) {
      console.error('Failed to add checkpoint', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Checkpoint Name"
        required
      />
      <button type="submit">Add Checkpoint</button>
    </form>
  );
}