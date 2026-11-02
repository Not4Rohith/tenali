import React from 'react';
import { SnakeCharacter } from './SnakeCharacter.jsx';
import { isStationDefunct } from '../engine/gameStateManager.js';

/**
 * MazeCanvas component
 * 
 * Recreates the hand-drawn 2D labyrinth reference:
 * - Clean black corridor paths with thin light-grey walls
 * - Continuous merged walls with proper joins (no square tile grids)
 * - Mathematical labels written directly in the corridor floor in bright blue
 * - Natural dead-end corridors and Goal destination star
 * - Zero artificial gates, zero lock icons, zero dynamic overlays
 * - Animated snake navigating corridor centerlines
 */
export function MazeCanvas({ mazeGraph, snake, calculation, mazeState, nearbyStation, conflictAnimation = null }) {
  const grid = mazeGraph;
  const { width, height, cellSize, wallLines, startPos, finishPos, stationsByPos } = grid;

  const startX = startPos.c * cellSize + cellSize / 2;
  const startY = startPos.r * cellSize + cellSize / 2;

  const finishX = finishPos.c * cellSize + cellSize / 2;
  const finishY = finishPos.r * cellSize + cellSize / 2;

  return (
    <div className="maze-canvas-container">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="maze-svg"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Subtle glow filter for Goal star and approaching station */}
          <filter id="glow-star" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="glow-station" x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* 1. Labyrinth Background (Bedrock / Solid Walls) */}
        <rect width={width} height={height} rx="8" fill="#090d16" />

        {/* 2. Walkable Corridor Paths with high-contrast floor & centerline navigation dots */}
        <g className="maze-corridor-paths">
          {grid.cells.flatMap((col) =>
            col.filter(cell => cell.isCarved).map(cell => (
              <g key={`corridor_${cell.c}_${cell.r}`}>
                {/* Clearly visible rich slate-indigo walkable corridor floor */}
                <rect
                  x={cell.c * cellSize}
                  y={cell.r * cellSize}
                  width={cellSize}
                  height={cellSize}
                  fill="#131b2e"
                />
                {/* Luminous path guidance dot along corridor center */}
                <circle
                  cx={cell.c * cellSize + cellSize / 2}
                  cy={cell.r * cellSize + cellSize / 2}
                  r="2.2"
                  fill="rgba(56, 189, 248, 0.4)"
                />
              </g>
            ))
          )}
        </g>

        {/* 3. Mathematical Labels Written Along Corridor Paths */}
        <g className="maze-floor-stations">
          {Object.values(stationsByPos).map((station) => {
            const isSolved = mazeState.solvedStationIds.includes(station.id);
            const isDefunct = !isSolved && isStationDefunct(station, calculation, grid?.expressionModel, grid);
            const isApproaching = !isDefunct && nearbyStation && nearbyStation.id === station.id;
            const isConflictBlocked = conflictAnimation && conflictAnimation.conflictingStationId === station.id;
            const completedOp = calculation.completedOperations.find(o => o.id === station.opId);

            const cx = station.c * cellSize + cellSize / 2;
            const cy = station.r * cellSize + cellSize / 2;
            const displayLabel = isSolved
              ? (completedOp ? `${completedOp.result}` : station.label)
              : (station.unsolvedLabel || station.label);

            return (
              <g
                key={station.id}
                className={`station-group ${isApproaching ? 'approaching' : ''} ${isConflictBlocked ? 'station-conflict-blocked' : ''} ${isDefunct ? 'station-defunct' : ''}`}
                filter={isApproaching ? 'url(#glow-station)' : undefined}
              >
                {/* High-visibility tactile station floor pill */}
                <rect
                  x={station.c * cellSize + 2.5}
                  y={station.r * cellSize + 2.5}
                  width={cellSize - 5}
                  height={cellSize - 5}
                  rx="7"
                  fill={
                    isConflictBlocked
                      ? 'rgba(239, 68, 68, 0.45)'
                      : isSolved
                      ? 'rgba(16, 185, 129, 0.35)'
                      : isDefunct
                      ? '#1e293b'
                      : isApproaching
                      ? 'rgba(56, 189, 248, 0.5)'
                      : 'rgba(14, 116, 144, 0.42)'
                  }
                  stroke={
                    isConflictBlocked
                      ? '#ef4444'
                      : isSolved
                      ? '#10b981'
                      : isDefunct
                      ? '#64748b'
                      : isApproaching
                      ? '#7dd3fc'
                      : '#38bdf8'
                  }
                  strokeWidth={isConflictBlocked ? '2.5' : isApproaching ? '2.4' : isSolved ? '2' : isDefunct ? '1.5' : '1.8'}
                  strokeDasharray={isDefunct ? '4 3' : undefined}
                />

                {/* Bold, prominent mathematical notation */}
                <text
                  x={cx}
                  y={cy + 4.5}
                  textAnchor="middle"
                  fill={isSolved ? '#34d399' : isDefunct ? '#cbd5e1' : '#ffffff'}
                  fontSize={displayLabel.length > 7 ? '11.5' : '12.5'}
                  fontWeight="800"
                  fontFamily="'Fredoka', 'Outfit', sans-serif"
                  letterSpacing="0.3px"
                >
                  {displayLabel}
                </text>

                {/* Clear Disabled / Padlock Badge for defunct stations */}
                {isDefunct && (
                  <g transform={`translate(${cx + cellSize / 2 - 7}, ${cy - cellSize / 2 + 7})`}>
                    <circle r="4.5" fill="#0f172a" stroke="#64748b" strokeWidth="0.8" />
                    <text x="0" y="2.2" textAnchor="middle" fontSize="6.5" fill="#94a3b8">🔒</text>
                  </g>
                )}

                {/* Solved check indicator */}
                {isSolved && (
                  <circle
                    cx={cx + cellSize / 2 - 5}
                    cy={cy - cellSize / 2 + 5}
                    r="2.8"
                    fill="#10b981"
                  />
                )}
              </g>
            );
          })}
        </g>

        {/* 4. Entrance Portal at (1, 1) */}
        <g transform={`translate(${startX}, ${startY})`}>
          <circle r="11" fill="#0284c7" stroke="#38bdf8" strokeWidth="2" />
          <text
            x="0"
            y="3.5"
            textAnchor="middle"
            fill="#ffffff"
            fontSize="9"
            fontWeight="800"
            fontFamily="'Fredoka', 'Outfit', sans-serif"
          >
            IN
          </text>
        </g>

        {/* 5. Destination Goal Star at (13, 9) */}
        <g
          transform={`translate(${finishX}, ${finishY})`}
          filter="url(#glow-star)"
        >
          <circle
            r="13"
            fill={mazeState.isAtFinish ? '#10b981' : '#f59e0b'}
            stroke="#ffffff"
            strokeWidth="1.5"
            opacity="0.3"
          />
          <circle
            r="9"
            fill={mazeState.isAtFinish ? '#10b981' : '#f59e0b'}
            stroke="#ffffff"
            strokeWidth="1.3"
          />
          <path
            d="M 0 -5 L 1.5 -1.5 L 5.2 -1.5 L 2.4 0.9 L 3.3 4.5 L 0 2.4 L -3.3 4.5 L -2.4 0.9 L -5.2 -1.5 L -1.5 -1.5 Z"
            fill="#ffffff"
          />
          <text
            x="0"
            y="17"
            textAnchor="middle"
            fill="#fcd34d"
            fontSize="8.5"
            fontWeight="800"
            fontFamily="'Fredoka', 'Outfit', sans-serif"
          >
            GOAL
          </text>
        </g>

        {/* 5b. Natural Dead-End Markers for Wrong Branches */}
        {(grid.deadEndLocations || (grid.deadEndPos ? [grid.deadEndPos] : [])).map((loc, idx) => {
          if (!loc) return null;
          const cx = loc.c * cellSize + cellSize / 2;
          const cy = loc.r * cellSize + cellSize / 2;
          return (
            <g key={`dead_end_loc_${idx}_${loc.c}_${loc.r}`} transform={`translate(${cx}, ${cy})`}>
              <circle
                r="11"
                fill="rgba(239, 68, 68, 0.14)"
                stroke="#f87171"
                strokeWidth="1.2"
                strokeDasharray="3 2"
              />
              <text
                x="0"
                y="3.5"
                textAnchor="middle"
                fill="#fca5a5"
                fontSize="9.5"
                fontWeight="800"
                fontFamily="'Fredoka', 'Outfit', sans-serif"
              >
                ✕
              </text>
            </g>
          );
        })}

        {/* 6. Crisp, High-Contrast Chalk Walls (Thick Merged Collinear Segments) */}
        <g className="maze-walls">
          {wallLines.map((line) => (
            <line
              key={line.id}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke="#ffffff"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {/* Prominent Outer Frame */}
          <rect
            x="1.5"
            y="1.5"
            width={width - 3}
            height={height - 3}
            fill="none"
            stroke="rgba(85, 165, 237, 0.45)"
            strokeWidth="2"
            rx="8"
          />
        </g>

        {/* 7. The Animated Snake Character */}
        <SnakeCharacter
          x={snake.x}
          y={snake.y}
          heading={snake.heading}
          segments={snake.segments}
          carriedValue={snake.carriedValue}
          carriedValues={snake.carriedValues}
        />
      </svg>
    </div>
  );
}
