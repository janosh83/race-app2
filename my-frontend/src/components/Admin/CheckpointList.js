import React from 'react';

export default function CheckpointList({ checkpoints, onRemove }) {
  return (
    <ul>
      {checkpoints.map((checkpoint) => (
        <li key={checkpoint.id}>
          {checkpoint.name}
          <button onClick={() => onRemove(checkpoint.id)}>Remove</button>
        </li>
      ))}
    </ul>
  );
}