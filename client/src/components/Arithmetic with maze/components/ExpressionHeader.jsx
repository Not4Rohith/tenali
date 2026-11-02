import React from 'react';
import { EXPRESSION_PRESETS } from '../engine/expressionEngine.js';
import { parseExpressionSegments, parseCurrentExpressionSegments } from '../engine/highlightEngine.js';

/**
 * ExpressionHeader Component
 * 
 * Displays:
 * - Row 1: Permanently static original question with glowing provenance terms.
 * - Row 2: Live current working expression directly below it, matching the sidebar blue CURRENT expression.
 * 
 * Expression-agnostic: derives all highlights dynamically from provenance token IDs.
 */
export function ExpressionHeader({
  currentExpression,
  onSelectExpression,
  calculation,
  nearbyStation,
  status,
  onBack,
  onReset,
  onUndo,
  canUndo = false,
  conflictAnimation = null
}) {
  const currentWorkingExpression =
    calculation?.reductionTrace && calculation.reductionTrace.length > 0
      ? calculation.reductionTrace[calculation.reductionTrace.length - 1]
      : currentExpression.display;

  // Render expression with completed, approaching, and conflict terms highlighted
  const renderExpressionContent = () => {
    const segments = parseExpressionSegments(
      currentExpression,
      calculation?.completedOperations || [],
      nearbyStation,
      conflictAnimation
    );

    return (
      <span className="expr-main-text">
        {segments.map((seg, i) => {
          if (seg.type === 'conflict-source') {
            return (
              <span key={i} className="expr-term-bracketed conflict-source" title={`Already used: ${seg.text}`}>
                <span className="glowing-bracket left conflict-bracket">(</span>
                <span className="expr-term-content conflict-source-text">{seg.text}</span>
                <span className="glowing-bracket right conflict-bracket">)</span>
              </span>
            );
          }
          if (seg.type === 'approaching') {
            return (
              <span key={i} className="expr-term-bracketed approaching" title={`Target: ${seg.text}`}>
                <span className="glowing-bracket left pulse-bracket">(</span>
                <span className="expr-term-content">{seg.text}</span>
                <span className="glowing-bracket right pulse-bracket">)</span>
              </span>
            );
          }
          if (seg.type === 'solved') {
            return (
              <span key={i} className="expr-term-solved" title={`Solved: ${seg.text}`}>
                {seg.text}
              </span>
            );
          }
          return <span key={i} className="expr-term-normal">{seg.text}</span>;
        })}
      </span>
    );
  };

  // Render live current working expression with glowing brackets for upcoming or conflict operation
  const renderCurrentExpressionContent = () => {
    const segments = parseCurrentExpressionSegments(
      currentExpression,
      calculation,
      nearbyStation,
      conflictAnimation
    );

    return (
      <span className="expr-main-text current-expr-text">
        {segments.map((seg, i) => {
          if (seg.type === 'conflict-target') {
            const displayText = seg.text.replace(/^\(([^()]+)\)$/, '$1');
            return (
              <span key={i} className="expr-term-bracketed conflict-target" title={`Contains used operands: ${displayText}`}>
                <span className="glowing-bracket left conflict-target-bracket">(</span>
                <span className="expr-term-content conflict-target-text">{displayText}</span>
                <span className="glowing-bracket right conflict-target-bracket">)</span>
              </span>
            );
          }
          if (seg.type === 'approaching') {
            // Strip outer parentheses if the term is already an isolated bracketed value like (8)
            const displayText = seg.text.replace(/^\(([^()]+)\)$/, '$1');
            return (
              <span key={i} className="expr-term-bracketed approaching current-expr-bracketed" title={`Target: ${displayText}`}>
                <span className="glowing-bracket left pulse-bracket">(</span>
                <span className="expr-term-content">{displayText}</span>
                <span className="glowing-bracket right pulse-bracket">)</span>
              </span>
            );
          }
          return <span key={i} className="expr-term-normal">{seg.text}</span>;
        })}
      </span>
    );
  };

  return (
    <header className="handdrawn-expression-header">
      <div className="header-nav-left">
        {onBack && (
          <button
            onClick={onBack}
            className="btn-minimal-back"
            title="Return to Menu"
          >
            ← Back
          </button>
        )}
        {onUndo && (
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="btn-minimal-undo"
            title="Undo Step (Z or Backspace)"
          >
            ↶ Undo
          </button>
        )}
        {onReset && (
          <button
            onClick={onReset}
            className="btn-minimal-restart"
            title="Restart Challenge (Press 'R')"
          >
            ↺ Restart
          </button>
        )}
      </div>

      {/* Prominent, Centered Expression with Two Distinct Rows */}
      <div className="header-expression-center">
        {/* Floating Conflict Badge Animation Overlay */}
        {conflictAnimation && (
          <div key={conflictAnimation.id} className="conflict-flying-badge-wrapper">
            <div className="conflict-flying-badge">
              <span className="badge-op-label">{conflictAnimation.consumingOpLabel}</span>
              <span className="badge-arrow">➔</span>
              <span className="badge-res-val">({conflictAnimation.resultValue})</span>
            </div>
          </div>
        )}

        {/* Row 1: Big Live Working Expression (reducing dynamically with glowing brackets) */}
        <div className={`header-row-original header-row-formula ${conflictAnimation ? 'conflict-target-active' : ''}`}>
          <div className="expression-formula">
            {renderCurrentExpressionContent()}
          </div>
          {status === 'GOAL_REACHED' && (
            <span className="goal-badge-minimal">{`= ${currentExpression.targetResult} ★`}</span>
          )}
        </div>

        {/* Row 2: Small Main Question Reference (with glowing brackets) */}
        <div className={`header-row-current header-row-sub ${conflictAnimation ? 'conflict-source-active' : ''}`}>
          <span className="question-expr-label current-expr-label">QUESTION:</span>
          <span className="question-expr-value current-expr-value">{renderExpressionContent()}</span>
        </div>
      </div>

      {/* Minimal challenge selector */}
      <div className="header-nav-right">
        <select
          id="expr-select"
          className="minimal-select"
          value={currentExpression.id}
          onChange={(e) => {
            const selected = EXPRESSION_PRESETS.find(p => p.id === e.target.value);
            if (selected) onSelectExpression(selected);
          }}
          title="Select Challenge Expression"
        >
          {EXPRESSION_PRESETS.map((preset, idx) => (
            <option key={preset.id} value={preset.id}>
              {`Expr ${idx + 1}: ${preset.display}`}
            </option>
          ))}
        </select>
      </div>
    </header>
  );
}

export default ExpressionHeader;
