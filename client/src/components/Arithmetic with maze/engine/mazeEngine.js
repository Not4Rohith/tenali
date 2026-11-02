/**
 * mazeEngine.js
 * 
 * Procedural Maze Generation Adapter:
 * Invokes the end-to-end mathematical expression pipeline to generate
 * procedural random mazes with embedded causal calculation stations.
 */

import { runExpressionMazePipeline } from './pipeline.js';

/**
 * Generates the compact procedural maze grid for the given expression challenge
 */
export function generateMazeGrid(expression, config = {}) {
  const exprStr = (expression && expression.display) ? expression.display : (typeof expression === 'string' ? expression : '3 + 5 × 3 − 10 ÷ 2');
  const pipeline = runExpressionMazePipeline(exprStr, expression, config);
  return pipeline.mazeGrid;
}

/**
 * Validates whether the snake can move from (c, r) in a given direction
 * Pure physical corridor wall collision check.
 */
export function canMoveInGrid(grid, c, r, direction) {
  const { cols, rows, cells } = grid;
  if (c < 0 || c >= cols || r < 0 || r >= rows) return false;

  const currentCell = cells[c][r];
  if (!currentCell || !currentCell.isCarved) return false;

  switch (direction) {
    case 'UP':
      if (currentCell.walls.top) return false;
      return r > 0 && cells[c][r - 1] && cells[c][r - 1].isCarved;
    case 'DOWN':
      if (currentCell.walls.bottom) return false;
      return r < rows - 1 && cells[c][r + 1] && cells[c][r + 1].isCarved;
    case 'LEFT':
      if (currentCell.walls.left) return false;
      return c > 0 && cells[c - 1][r] && cells[c - 1][r].isCarved;
    case 'RIGHT':
      if (currentCell.walls.right) return false;
      return c < cols - 1 && cells[c + 1][r] && cells[c + 1][r].isCarved;
    default:
      return false;
  }
}

/**
 * Helper to get the target cell coordinate given current (c, r) and direction
 */
export function getNextCell(c, r, direction) {
  switch (direction) {
    case 'UP':
      return { c, r: r - 1 };
    case 'DOWN':
      return { c, r: r + 1 };
    case 'LEFT':
      return { c: c - 1, r };
    case 'RIGHT':
      return { c: c + 1, r };
    default:
      return { c, r };
  }
}
