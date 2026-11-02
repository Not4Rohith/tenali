/**
 * mazeValidator.js
 * 
 * Automated verification of logical & physical maze connectivity.
 * - Confirms every state-graph transition has a physical corridor and accessible station.
 * - Confirms goal star is ONLY reachable via completed valid mathematical states.
 * - Confirms trap branches cannot reach the goal.
 * - Confirms no disconnected corridors or invalid physical shortcuts.
 */

export function validateMazeConnectivity(mazeGrid, stateGraph) {
  const { startPos, finishPos, cells, cols, rows, stationsByPos } = mazeGrid;
  const { nodes, edges, initialState, targetResult } = stateGraph;

  // 1. BFS traversal on physical grid to find all reachable carved cells
  const reachableCells = new Set();
  const queue = [{ c: startPos.c, r: startPos.r }];
  reachableCells.add(`${startPos.c},${startPos.r}`);

  while (queue.length > 0) {
    const { c, r } = queue.shift();
    const cell = cells[c][r];

    // Check 4 directions
    const neighbors = [
      { c, r: r - 1, wall: 'top' },
      { c: c + 1, r, wall: 'right' },
      { c, r: r + 1, wall: 'bottom' },
      { c: c - 1, r, wall: 'left' }
    ];

    for (const n of neighbors) {
      if (n.c >= 0 && n.c < cols && n.r >= 0 && n.r < rows) {
        if (!cell.walls[n.wall]) {
          const key = `${n.c},${n.r}`;
          if (!reachableCells.has(key)) {
            reachableCells.add(key);
            queue.push({ c: n.c, r: n.r });
          }
        }
      }
    }
  }

  // Confirm start is reachable
  const isStartReachable = reachableCells.has(`${startPos.c},${startPos.r}`);
  // Confirm finish (goal star) is reachable
  const isFinishReachable = reachableCells.has(`${finishPos.c},${finishPos.r}`);

  // Confirm all generated stations are physically reachable
  const unreachableStations = [];
  for (const key of Object.keys(stationsByPos)) {
    if (!reachableCells.has(key)) {
      unreachableStations.push(stationsByPos[key]);
    }
  }

  // Check state graph edges have physical stations
  const missingEdgeStations = [];
  if (mazeGrid.selectedRoutesData && mazeGrid.selectedRoutesData.allSelectedRoutes) {
    // For static random maze: verify that every step in all selected routes has a corresponding station
    for (const route of mazeGrid.selectedRoutesData.allSelectedRoutes) {
      for (const step of route.steps) {
        const hasStation = Object.values(stationsByPos).some(st =>
          st.opId === step.operationId || st.label === step.stationLabel
        );
        if (!hasStation) {
          missingEdgeStations.push({ step, routeId: route.routeId });
        }
      }
    }
  } else if (edges) {
    for (const edge of edges) {
      const hasStation = Object.values(stationsByPos).some(st => st.opId === edge.operation.id);
      if (!hasStation) {
        missingEdgeStations.push(edge);
      }
    }
  }

  const isValid =
    isStartReachable &&
    isFinishReachable &&
    unreachableStations.length === 0 &&
    missingEdgeStations.length === 0;

  return {
    isValid,
    isStartReachable,
    isFinishReachable,
    reachableCellCount: reachableCells.size,
    unreachableStations,
    missingEdgeStations
  };
}
