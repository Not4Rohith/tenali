import React from 'react';
import { LiveTrace } from './LiveTrace.jsx';
import { DPadControls } from './DPadControls.jsx';

/**
 * RightPanel Component
 * 
 * Clean vertical workspace on the right (~30% width) divided into:
 * - Upper Section: Calculation simulation & expression transformations
 * - Lower Section: Directional triangle controls and Back button
 */
export function RightPanel({
  calculation,
  snake,
  status,
  message,
  mazeState,
  onMove,
  onUndo,
  onReset,
  historyCount
}) {
  return (
    <aside className="game-right-panel">
      {/* Upper Section: Calculation Simulation */}
      <section className="right-panel-upper">
        <LiveTrace
          calculation={calculation}
          snake={snake}
          status={status}
          message={message}
          wallReason={mazeState?.deadEndReason || mazeState?.wallReason}
          onReset={onReset}
        />
      </section>

      {/* Lower Section: Directional Triangle Controls & Actions */}
      <section className="right-panel-lower">
        <DPadControls
          onMove={onMove}
          onUndo={onUndo}
          onReset={onReset}
          canUndo={historyCount > 0}
        />
      </section>
    </aside>
  );
}

