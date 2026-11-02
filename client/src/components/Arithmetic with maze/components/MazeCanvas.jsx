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
/**
 * Finds the immediate next step direction from snake's head towards clicked cell (targetC, targetR)
 * using BFS through walkable carved maze corridors.
 */
function getNextStepDirection(grid, startC, startR, targetC, targetR, snakeSegments = []) {
  if (!grid || !grid.cells) return null;
  if (startC === targetC && startR === targetR) return null;

  const targetCell = grid.cells[targetC]?.[targetR];
  if (!targetCell || !targetCell.isCarved) return null;

  const queue = [{ c: startC, r: startR, firstDir: null }];
  const visited = new Set([`${startC},${startR}`]);

  const DIRS = [
    { dir: 'UP', dc: 0, dr: -1 },
    { dir: 'RIGHT', dc: 1, dr: 0 },
    { dir: 'DOWN', dc: 0, dr: 1 },
    { dir: 'LEFT', dc: -1, dr: 0 }
  ];

  while (queue.length > 0) {
    const { c, r, firstDir } = queue.shift();
    if (c === targetC && r === targetR) {
      return firstDir;
    }

    const currentCell = grid.cells[c]?.[r];
    if (!currentCell || !currentCell.isCarved) continue;

    for (const { dir, dc, dr } of DIRS) {
      const nc = c + dc;
      const nr = r + dr;
      const key = `${nc},${nr}`;
      if (visited.has(key)) continue;

      // Check walls
      let blocked = false;
      if (dir === 'UP') blocked = currentCell.walls.top;
      else if (dir === 'DOWN') blocked = currentCell.walls.bottom;
      else if (dir === 'LEFT') blocked = currentCell.walls.left;
      else if (dir === 'RIGHT') blocked = currentCell.walls.right;
      if (blocked) continue;

      const nextCell = grid.cells[nc]?.[nr];
      if (!nextCell || !nextCell.isCarved) continue;

      // Check snake body collision
      const isBody = snakeSegments.some(seg => seg.c === nc && seg.r === nr);
      if (isBody) continue;

      visited.add(key);
      queue.push({
        c: nc,
        r: nr,
        firstDir: firstDir || dir
      });
    }
  }

  return null;
}

/**
 * Determines whether a mathematical station should be visible to the child.
 * Progressive fog-of-war:
 * - Opening stations (no prerequisite) are visible at start.
 * - Stations whose prerequisite station is solved become revealed.
 * - Already solved stations remain visible.
 * - Stations within close proximity (Manhattan distance <= 2) to the snake reveal.
 */
function isStationVisible(station, solvedStationIds = [], snake = null) {
  if (!station) return false;

  // 1. Solved stations always stay visible
  if (solvedStationIds.includes(station.id)) return true;

  // 2. Opening stations (prerequisiteStationId is null) are visible at start
  if (station.isOpeningState || station.prerequisiteStationId === null || station.prerequisiteStationId === undefined) {
    return true;
  }

  // 3. Revealed when its prerequisite station is solved
  if (station.prerequisiteStationId && solvedStationIds.includes(station.prerequisiteStationId)) {
    return true;
  }

  // 4. Proximity reveal if the snake is physically exploring near this corridor
  if (snake) {
    const dist = Math.abs(snake.c - station.c) + Math.abs(snake.r - station.r);
    if (dist <= 2) return true;
  }

  return false;
}

export function MazeCanvas({
  mazeGraph,
  snake,
  calculation,
  mazeState,
  nearbyStation,
  conflictAnimation = null,
  onMove = null
}) {
  const grid = mazeGraph;
  const { width, height, cellSize, wallLines, startPos, finishPos, stationsByPos } = grid;

  const startX = startPos.c * cellSize + cellSize / 2;
  const startY = startPos.r * cellSize + cellSize / 2;

  const finishX = finishPos.c * cellSize + cellSize / 2;
  const finishY = finishPos.r * cellSize + cellSize / 2;

  // Mouse / Tap Click Navigation Handler
  const handleSvgClick = (e) => {
    if (!onMove) return;
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
    const c = Math.floor(svgP.x / cellSize);
    const r = Math.floor(svgP.y / cellSize);
    if (c < 0 || c >= grid.cols || r < 0 || r >= grid.rows) return;

    // Check adjacent first (instant single step)
    if (c === snake.c + 1 && r === snake.r) return onMove('RIGHT');
    if (c === snake.c - 1 && r === snake.r) return onMove('LEFT');
    if (c === snake.c && r === snake.r + 1) return onMove('DOWN');
    if (c === snake.c && r === snake.r - 1) return onMove('UP');

    // If clicked further along the corridor, take first step towards target
    const nextDir = getNextStepDirection(grid, snake.c, snake.r, c, r, snake.segments || []);
    if (nextDir) {
      onMove(nextDir);
    }
  };

  return (
    <div className="maze-canvas-container">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="maze-svg"
        preserveAspectRatio="xMidYMid meet"
        onClick={handleSvgClick}
        style={{ cursor: 'pointer' }}
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
            const isVisible = isStationVisible(station, mazeState.solvedStationIds, snake);
            if (!isVisible) return null;

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
