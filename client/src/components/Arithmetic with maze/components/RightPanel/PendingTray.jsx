import React from 'react';

/**
 * PendingTray Component
 * 
 * Safely holds intermediate calculation values so the snake
 * never overwrites or discards past results when calculating another term.
 */
export function PendingTray({ pendingTray = [] }) {
  return (
    <div className="pending-tray-card">
      <div className="tray-header">
        <h4 className="tray-title">Pending Results Tray</h4>
        <span className="tray-count">{pendingTray.length} Stored</span>
      </div>

      <div className="tray-items">
        {pendingTray.length === 0 ? (
          <div className="tray-empty">
            <span>No pending values. Snake is carrying the active result directly.</span>
          </div>
        ) : (
          pendingTray.map((item, idx) => (
            <div key={`tray-${idx}`} className="tray-item">
              <span className="tray-label">{item.label}</span>
              <span className="tray-value">{item.value}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
