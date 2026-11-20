import React from 'react';

// One small summary number in a row of tiles (put it in a `row row-cols-*`).
// `children` is the value; `detail` a muted line under it.
export default function StatTile({ label, detail, children }) {
  return (
    <div className="col">
      <div className="card h-100 admin-stat">
        <div className="card-body py-2 px-3">
          <div className="text-muted small">{label}</div>
          {children}
          {detail && <div className="small text-muted">{detail}</div>}
        </div>
      </div>
    </div>
  );
}
