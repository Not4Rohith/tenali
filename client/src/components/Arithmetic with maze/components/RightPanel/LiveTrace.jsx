import React from 'react';

/**
 * LiveTrace Component (Right Panel Upper Section: WORKING EXPRESSION)
 * 
 * Displays dynamic mathematical expression reduction timeline:
 * - Shows Initial, Step, Current, and Final reduction transformations
 * - Latest expression is highlighted and most prominent
 * - Prior expressions are faded and smaller
 * - Displays snake's carried value
 * - Only reflects the current active route (backtracking automatically removes undone steps)
 * - Zero debug logs, zero status noise
 */
export function LiveTrace({ calculation, snake, status, message, wallReason, onReset }) {
  const carriedValues = (snake && snake.carriedValues && snake.carriedValues.length > 0)
    ? snake.carriedValues
    : (calculation?.carriedValues && calculation.carriedValues.length > 0)
    ? calculation.carriedValues
    : (calculation?.carriedValue !== null && calculation?.carriedValue !== undefined ? [calculation.carriedValue] : []);
  const { reductionTrace = [] } = calculation;

  return (
    <div className="calculation-workspace">
      {/* Workspace Header */}
      <div className="workspace-header">
        <h3 className="workspace-title">WORKING EXPRESSION</h3>
      </div>

      {/* Snake Carried Value Status */}
      <div className="carried-status-bar">
        <div className="carried-badge">
          <span className="carried-icon">🐍 In Mouth:</span>
          {carriedValues.length === 0 ? (
            <span className="carried-value-pill none">None</span>
          ) : (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {carriedValues.map((val, idx) => (
                <span
                  key={idx}
                  className="carried-value-pill"
                  style={
                    idx === 1
                      ? {
                          color: '#38bdf8',
                          background: 'rgba(56, 189, 248, 0.15)',
                          borderColor: 'rgba(56, 189, 248, 0.4)'
                        }
                      : {}
                  }
                >
                  {val}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Vertical Working Expression Reduction Sequence */}
      <div className="working-expression-timeline">
        {reductionTrace.map((expr, idx) => {
          const isInitial = idx === 0;
          const isLatest = idx === reductionTrace.length - 1;
          const isFinal = isLatest && status === 'GOAL_REACHED';

          let stepLabel = 'Current:';
          if (isFinal) stepLabel = 'Final:';
          else if (isInitial) stepLabel = 'Initial:';
          else if (!isLatest) stepLabel = `Step ${idx}:`;

          return (
            <div key={`reduction-${idx}`} className="timeline-node">
              {idx > 0 && (
                <div className="timeline-separator">
                  <span className="arrow-down">↓</span>
                </div>
              )}
              <div className={`reduction-card ${isLatest ? 'latest-prominent' : 'past-faded'}`}>
                <div className="card-tag">{stepLabel}</div>
                <div className="card-expression">{expr}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Goal Reached or Natural Dead End Banners */}
      {status === 'GOAL_REACHED' && (
        <div className="workspace-alert success">
          <span className="alert-icon">★</span>
          <div className="alert-body">
            <strong>Target Reached!</strong>
            <div>Expression reduced successfully.</div>
            {onReset && (
              <button className="btn-alert-action btn-alert-success" onClick={onReset}>
                ↺ Play Again
              </button>
            )}
          </div>
        </div>
      )}

      {status === 'DEAD_END' && (
        <div className="workspace-alert deadend">
          <span className="alert-icon">🤔</span>
          <div className="alert-body">
            <strong>Math Check!</strong>
            <div className="alert-sub">
              {wallReason || message || 'In BODMAS, multiplication & division come before addition & subtraction!'}
            </div>
            {onReset && (
              <button className="btn-alert-action btn-alert-deadend" onClick={onReset}>
                ↺ Try Again
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
export default LiveTrace;
