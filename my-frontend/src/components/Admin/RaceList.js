import React from 'react';
export default function RaceList({races,onSelect}){
  console.log('RaceList rendered');
  console.log(races);
  return (
    <div>
      <h4>Races</h4>
      <ul className="list-group">
        {races.map(r=>(
          <li key={r.id} className="list-group-item d-flex justify-content-between align-items-center">
            <div onClick={()=>onSelect(r)} style={{cursor:'pointer'}}>{r.name}<div className="small text-muted">{r.start_showing_checkpoints} — {r.end_showing_checkpoints}</div></div>
            <div><button className="btn btn-sm btn-outline-primary" onClick={()=>onSelect(r)}>Manage</button></div>
          </li>
        ))}
      </ul>
    </div>
  );
}