import React, { useState, useEffect, useCallback } from 'react';
import './index.css';
import { EXPRESSION_PRESETS } from './engine/expressionEngine.js';
import {
  createInitialGameState,
  moveSnake,
  undoLastMove
} from './engine/gameStateManager.js';
import { ExpressionHeader } from './components/ExpressionHeader.jsx';
import { MazeCanvas } from './components/MazeCanvas.jsx';
import { RightPanel } from './components/RightPanel/RightPanel.jsx';

/**
 * SnakeMazeApp Component
 * 
 * Main container for BODMAS Interactive Snake Maze
 * Restored to match original hand-drawn reference design:
 * - Rounded outer rectangular container (#111111 with #D0D0D0 border)
 * - 72/28 two-column split with continuous vertical divider
 * - Prominent blue centered expression at top of left section
 * - Centered compact maze with clean margins
 * - Calculation workspace on top right, diamond directional controls on bottom right
 */
export function SnakeMazeApp({ onBack }) {
  const [currentExpression, setCurrentExpression] = useState(EXPRESSION_PRESETS[0]);
  const [gameState, setGameState] = useState(() => createInitialGameState(EXPRESSION_PRESETS[0]));

  // Switch expression challenge
  const handleSelectExpression = (newExpr) => {
    setCurrentExpression(newExpr);
    setGameState(createInitialGameState(newExpr));
  };

  // Reset current challenge
  const handleReset = () => {
    setGameState(createInitialGameState(currentExpression));
  };

  // Movement handler
  const handleMove = useCallback((direction) => {
    setGameState((prev) => moveSnake(prev, direction));
  }, []);

  // Backtracking / Undo handler
  const handleUndo = useCallback(() => {
    setGameState((prev) => undoLastMove(prev));
  }, []);

  // Global Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Prevent default scrolling on arrow keys
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          handleMove('UP');
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          handleMove('DOWN');
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          handleMove('LEFT');
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          handleMove('RIGHT');
          break;
        case 'Backspace':
        case 'u':
        case 'U':
        case 'z':
          handleUndo();
          break;
        case 'r':
        case 'R':
          handleReset();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleMove, handleUndo]);

  // Auto-dismiss transient conflict animation after 1.8s
  useEffect(() => {
    if (gameState.conflictAnimation) {
      const timer = setTimeout(() => {
        setGameState(prev => (prev.conflictAnimation ? { ...prev, conflictAnimation: null } : prev));
      }, 1800);
      return () => clearTimeout(timer);
    }
  }, [gameState.conflictAnimation?.id]);

  return (
    <div className="snake-maze-viewport">
      <div className="snake-maze-app">
        {/* Left Section (~72%): Expression Header at top, then centered compact Maze */}
        <section className="maze-left-section">
          <ExpressionHeader
            currentExpression={currentExpression}
            onSelectExpression={handleSelectExpression}
            calculation={gameState.calculation}
            nearbyStation={gameState.nearbyStation}
            status={gameState.status}
            onBack={onBack}
            onReset={handleReset}
            conflictAnimation={gameState.conflictAnimation}
          />

          <div className="status-banner">
            <span className="status-text">{gameState.message}</span>
          </div>

          <div className="maze-wrapper-centered">
            <MazeCanvas
              mazeGraph={gameState.mazeGraph}
              snake={gameState.snake}
              calculation={gameState.calculation}
              mazeState={gameState.mazeState}
              nearbyStation={gameState.nearbyStation}
              conflictAnimation={gameState.conflictAnimation}
            />
          </div>
        </section>

        {/* Right Section (~28%): Calculation Workspace (upper) & Directional Controls (lower) */}
        <RightPanel
          calculation={gameState.calculation}
          snake={gameState.snake}
          status={gameState.status}
          message={gameState.message}
          mazeState={gameState.mazeState}
          onMove={handleMove}
          onUndo={handleUndo}
          onReset={handleReset}
          historyCount={gameState.historyStack.length}
        />
      </div>
    </div>
  );
}
export default SnakeMazeApp;
