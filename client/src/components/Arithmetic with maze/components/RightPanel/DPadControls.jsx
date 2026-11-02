import React from 'react';

/**
 * DPadControls Component
 * 
 * Lower Section of Right Workspace:
 * - Simple triangle-shaped direction controls (▲, ◀, ▼, ▶) matching hand-drawn sketch
 * - Dedicated Back control for step-by-step backtracking
 */
export function DPadControls({ onMove, onUndo, onReset, canUndo = false }) {
  return (
    <div className="handdrawn-controls-section">
      <div className="dpad-triangle-cluster">
        {/* Row 1: UP Triangle */}
        <div className="triangle-row top-row">
          <button
            className="triangle-btn triangle-up"
            onClick={() => onMove('UP')}
            title="Move Up (ArrowUp or W)"
            aria-label="Up"
          >
            <svg viewBox="0 0 24 24" className="triangle-svg">
              <polygon points="12,3 21,20 3,20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Row 2: LEFT and RIGHT Triangles */}
        <div className="triangle-row middle-row">
          <button
            className="triangle-btn triangle-left"
            onClick={() => onMove('LEFT')}
            title="Move Left (ArrowLeft or A)"
            aria-label="Left"
          >
            <svg viewBox="0 0 24 24" className="triangle-svg">
              <polygon points="3,12 20,3 20,21" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="cluster-spacer"></div>

          <button
            className="triangle-btn triangle-right"
            onClick={() => onMove('RIGHT')}
            title="Move Right (ArrowRight or D)"
            aria-label="Right"
          >
            <svg viewBox="0 0 24 24" className="triangle-svg">
              <polygon points="21,12 4,3 4,21" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Row 3: DOWN Triangle */}
        <div className="triangle-row bottom-row">
          <button
            className="triangle-btn triangle-down"
            onClick={() => onMove('DOWN')}
            title="Move Down (ArrowDown or S)"
            aria-label="Down"
          >
            <svg viewBox="0 0 24 24" className="triangle-svg">
              <polygon points="12,21 3,4 21,4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Row 4: Action Controls (Undo & Restart) */}
      <div className="controls-action-row">
        {onUndo && (
          <button
            className="btn-handdrawn-action btn-undo"
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo Last Step (Backspace / Z)"
          >
            ↶ Undo
          </button>
        )}
        {onReset && (
          <button
            className="btn-handdrawn-action btn-restart"
            onClick={onReset}
            title="Restart Challenge (R)"
          >
            ↺ Restart
          </button>
        )}
      </div>
    </div>
  );
}

