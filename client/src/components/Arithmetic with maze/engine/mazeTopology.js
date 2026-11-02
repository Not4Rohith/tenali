/**
 * mazeTopology.js
 * 
 * Dynamic Maze Topology Generator via Orthogonal State-Graph Embedding.
 * 
 * Pipeline:
 * State Graph (DAG) -> Layering & Node Embedding -> Orthogonal Corridor Routing
 * -> Dynamic Station Placement -> Wall Extraction & Merging.
 * 
 * The maze topology is mathematically derived from the expression's state graph.
 * Merges equivalent states at the same physical junction and ensures mini-expressions
 * only appear on corridors where their required operands have been calculated.
 * 
 * Features:
 * - Dynamic placement of all stations derived from the state graph (no static hardcoding)
 * - Independent operations (e.g. 5 × 3 and 10 ÷ 2) are dynamically placed sequentially along both routes
 *   so the snake only moves forward without backtracking or self-intersection
 * - Strict vertical band isolation: valid calculation corridors in upper band, trap/distractor corridors
 *   in lower band, completely eliminating accidental cross-corridor shortcuts
 * - Continuous smooth merged walls (SVG wallLines) with no grid-cell artifacts
 */

export function generateMazeFromStateGraph(stateGraph, expressionModel, options = {}) {
  const { nodes, edges, initialState, targetResult } = stateGraph;

  // 1. Group nodes by depth / layer
  const layers = [];
  for (const node of nodes) {
    const d = node.depth;
    if (!layers[d]) layers[d] = [];
    layers[d].push(node);
  }
  const maxDepth = layers.length - 1;

  // Separate valid and trap nodes per layer
  const validNodesByDepth = [];
  const trapNodesByDepth = [];
  for (let d = 0; d <= maxDepth; d++) {
    const layer = layers[d] || [];
    validNodesByDepth[d] = layer.filter(n => !n.isTrap);
    trapNodesByDepth[d] = layer.filter(n => n.isTrap);
  }

  // Group edges by their source node's depth
  const edgesByDepth = [];
  for (let d = 0; d < maxDepth; d++) {
    edgesByDepth[d] = edges.filter(e => {
      const fromNode = nodes.find(n => n.id === e.fromStateId);
      return fromNode && fromNode.depth === d;
    });
  }

  const maxValidEdges = Math.max(...edgesByDepth.map(list => list.filter(e => !e.isTrap).length), 1);
  const maxTrapEdges = Math.max(...edgesByDepth.map(list => list.filter(e => e.isTrap).length), 0);

  // 2. Vertical Band Allocations:
  // Upper band: Valid corridors & states [rows 2 .. validBandMax]
  // Buffer wall: row (validBandMax + 1)
  // Lower band: Trap / distractor corridors & states [rows trapBandMin .. rows - 2]
  const validBandHeight = Math.max(7, maxValidEdges * 2 + 1);
  const validBandMax = 1 + validBandHeight;
  const trapBandMin = validBandMax + 2;
  const trapBandHeight = maxTrapEdges > 0 ? Math.max(5, maxTrapEdges * 2 + 1) : 0;
  const rows = maxTrapEdges > 0 ? trapBandMin + trapBandHeight + 1 : validBandMax + 2;

  // Horizontal column sizing:
  // 4 columns per depth layer (junction, branch, station, merge)
  const colStep = 4;
  const cols = Math.max(17, 1 + maxDepth * colStep + 3);

  // Initialize cells
  const cells = [];
  for (let c = 0; c < cols; c++) {
    cells[c] = [];
    for (let r = 0; r < rows; r++) {
      cells[c][r] = {
        c,
        r,
        isCarved: false,
        walls: { top: true, right: true, bottom: true, left: true },
        isStart: false,
        isFinish: false,
        isDeadEnd: false,
        station: null
      };
    }
  }

  // Carve corridor helper
  function carve(c1, r1, c2, r2) {
    const minC = Math.min(c1, c2);
    const maxC = Math.max(c1, c2);
    const minR = Math.min(r1, r2);
    const maxR = Math.max(r1, r2);

    for (let c = minC; c <= maxC; c++) {
      for (let r = minR; r <= maxR; r++) {
        if (cells[c] && cells[c][r]) {
          cells[c][r].isCarved = true;
        }
      }
    }

    if (c1 === c2) {
      const c = c1;
      for (let r = minR; r < maxR; r++) {
        if (cells[c] && cells[c][r] && cells[c][r + 1]) {
          cells[c][r].walls.bottom = false;
          cells[c][r + 1].walls.top = false;
        }
      }
    } else if (r1 === r2) {
      const r = r1;
      for (let c = minC; c < maxC; c++) {
        if (cells[c] && cells[c + 1] && cells[c][r] && cells[c + 1][r]) {
          cells[c][r].walls.right = false;
          cells[c + 1][r].walls.left = false;
        }
      }
    }
  }

  // 3. Assign node positions cleanly within respective bands
  const nodePositions = new Map();
  const startC = 1;
  const startR = 2;
  nodePositions.set(initialState.id, { c: startC, r: startR });
  cells[startC][startR].isCarved = true;
  cells[startC][startR].isStart = true;

  for (let d = 1; d <= maxDepth; d++) {
    const layerX = 1 + d * colStep;
    const valids = validNodesByDepth[d] || [];
    const traps = trapNodesByDepth[d] || [];

    // Valid nodes in upper band
    const validSpacing = Math.max(2, Math.floor((validBandMax - 2) / Math.max(1, valids.length)));
    valids.forEach((node, idx) => {
      let layerY;
      if (node.isGoal) {
        layerY = Math.floor(validBandMax / 2) + 2;
      } else if (valids.length === 1) {
        layerY = Math.floor(validBandMax / 2);
      } else {
        layerY = 2 + idx * validSpacing;
      }
      layerY = Math.max(2, Math.min(validBandMax, layerY));

      nodePositions.set(node.id, { c: layerX, r: layerY });
      cells[layerX][layerY].isCarved = true;
      if (node.isGoal) cells[layerX][layerY].isFinish = true;
    });

    // Trap nodes in lower band
    if (traps.length > 0) {
      const trapSpacing = Math.max(2, Math.floor((rows - 2 - trapBandMin) / Math.max(1, traps.length)));
      traps.forEach((node, idx) => {
        let layerY = trapBandMin + idx * trapSpacing;
        layerY = Math.max(trapBandMin, Math.min(rows - 2, layerY));

        nodePositions.set(node.id, { c: layerX, r: layerY });
        cells[layerX][layerY].isCarved = true;
        if (node.isTrap && node.isTerminal) {
          cells[layerX][layerY].isDeadEnd = true;
        }
      });
    }
  }

  // 4. Route edges along dedicated non-colliding row tracks
  const stationPlacements = [];
  const stationsByPos = {};

  for (let d = 0; d < maxDepth; d++) {
    const layerEdges = edgesByDepth[d] || [];
    const fromX = 1 + d * colStep;
    const toX = 1 + (d + 1) * colStep;
    const midX = fromX + 2;

    const valEdges = layerEdges.filter(e => !e.isTrap);
    const trEdges = layerEdges.filter(e => e.isTrap);

    // Route Valid Edges in Upper Band
    valEdges.forEach((edge, edgeIdx) => {
      const fromPos = nodePositions.get(edge.fromStateId);
      const toPos = nodePositions.get(edge.toStateId);
      if (!fromPos || !toPos) return;

      const edgeRow = Math.max(2, Math.min(validBandMax, 2 + edgeIdx * 2));

      // Carve corridor
      carve(fromPos.c, fromPos.r, fromX + 1, fromPos.r);
      carve(fromX + 1, fromPos.r, fromX + 1, edgeRow);
      carve(fromX + 1, edgeRow, toX - 1, edgeRow);
      carve(toX - 1, edgeRow, toX - 1, toPos.r);
      carve(toX - 1, toPos.r, toPos.c, toPos.r);

      const stC = midX;
      const stR = edgeRow;

      const stationData = {
        id: `st_${edge.operation.id}_${edgeIdx}_d${d}`,
        opId: edge.operation.id,
        c: stC,
        r: stR,
        label: edge.operation.stationLabel,
        unsolvedLabel: edge.operation.unsolvedLabel,
        operation: edge.operation,
        fromStateId: edge.fromStateId,
        toStateId: edge.toStateId,
        isTrap: false
      };

      stationPlacements.push(stationData);
      cells[stC][stR].station = stationData;
      stationsByPos[`${stC},${stR}`] = stationData;
    });

    // Route Trap Edges in Lower Band
    trEdges.forEach((edge, edgeIdx) => {
      const fromPos = nodePositions.get(edge.fromStateId);
      const toPos = nodePositions.get(edge.toStateId);
      if (!fromPos || !toPos) return;

      const edgeRow = Math.max(trapBandMin, Math.min(rows - 2, trapBandMin + edgeIdx * 2));

      if (edge.fromStateId === initialState.id) {
        // Entrance fork: carve vertically down from entrance (startC, startR) at startC into trapBandMin
        carve(fromPos.c, fromPos.r, fromPos.c, edgeRow);
        carve(fromPos.c, edgeRow, toX - 1, edgeRow);
        carve(toX - 1, edgeRow, toX - 1, toPos.r);
        carve(toX - 1, toPos.r, toPos.c, toPos.r);
      } else {
        carve(fromPos.c, fromPos.r, fromX + 1, fromPos.r);
        carve(fromX + 1, fromPos.r, fromX + 1, edgeRow);
        carve(fromX + 1, edgeRow, toX - 1, edgeRow);
        carve(toX - 1, edgeRow, toX - 1, toPos.r);
        carve(toX - 1, toPos.r, toPos.c, toPos.r);
      }

      const stC = midX;
      const stR = edgeRow;

      const stationData = {
        id: `st_${edge.operation.id}_${edgeIdx}_d${d}`,
        opId: edge.operation.id,
        c: stC,
        r: stR,
        label: edge.operation.stationLabel,
        unsolvedLabel: edge.operation.unsolvedLabel,
        operation: edge.operation,
        fromStateId: edge.fromStateId,
        toStateId: edge.toStateId,
        isTrap: true
      };

      stationPlacements.push(stationData);
      cells[stC][stR].station = stationData;
      stationsByPos[`${stC},${stR}`] = stationData;
    });
  }

  // 5. Goal & Dead-End locations
  const goalNode = nodes.find(n => n.isGoal);
  const goalPos = goalNode ? nodePositions.get(goalNode.id) : { c: cols - 2, r: 4 };
  const trapTerminal = nodes.find(n => n.isTrap && n.isTerminal);
  const deadEndPos = trapTerminal ? nodePositions.get(trapTerminal.id) : { c: 5, r: rows - 2 };

  // 6. Continuous merged wall extraction
  const rawH = [];
  const rawV = [];

  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const cell = cells[c][r];
      if (!cell.isCarved) continue;
      if (cell.walls.top) rawH.push({ r, c1: c, c2: c + 1 });
      if (cell.walls.bottom) rawH.push({ r: r + 1, c1: c, c2: c + 1 });
      if (cell.walls.left) rawV.push({ c, r1: r, r2: r + 1 });
      if (cell.walls.right) rawV.push({ c: c + 1, r1: r, r2: r + 1 });
    }
  }

  // Merge horizontal segments
  const mergedH = [];
  const hByRow = {};
  for (const seg of rawH) {
    if (!hByRow[seg.r]) hByRow[seg.r] = [];
    hByRow[seg.r].push({ c1: seg.c1, c2: seg.c2 });
  }
  for (const rKey of Object.keys(hByRow)) {
    const r = parseInt(rKey, 10);
    const segs = hByRow[r].sort((a, b) => a.c1 - b.c1);
    let cur = { ...segs[0] };
    for (let i = 1; i < segs.length; i++) {
      if (segs[i].c1 <= cur.c2) {
        cur.c2 = Math.max(cur.c2, segs[i].c2);
      } else {
        mergedH.push({ r, c1: cur.c1, c2: cur.c2 });
        cur = { ...segs[i] };
      }
    }
    mergedH.push({ r, c1: cur.c1, c2: cur.c2 });
  }

  // Merge vertical segments
  const mergedV = [];
  const vByCol = {};
  for (const seg of rawV) {
    if (!vByCol[seg.c]) vByCol[seg.c] = [];
    vByCol[seg.c].push({ r1: seg.r1, r2: seg.r2 });
  }
  for (const cKey of Object.keys(vByCol)) {
    const c = parseInt(cKey, 10);
    const segs = vByCol[c].sort((a, b) => a.r1 - b.r1);
    let cur = { ...segs[0] };
    for (let i = 1; i < segs.length; i++) {
      if (segs[i].r1 <= cur.r2) {
        cur.r2 = Math.max(cur.r2, segs[i].r2);
      } else {
        mergedV.push({ c, r1: cur.r1, r2: cur.r2 });
        cur = { ...segs[i] };
      }
    }
    mergedV.push({ c, r1: cur.r1, r2: cur.r2 });
  }

  // Dynamic cell size to fit cleanly in viewport
  const maxW = 560;
  const maxH = 400;
  const cellSize = Math.min(36, Math.floor(Math.min(maxW / cols, maxH / rows)));

  const wallLines = [];
  let lineId = 1;
  for (const seg of mergedH) {
    wallLines.push({
      id: `wl_h_${lineId++}`,
      x1: seg.c1 * cellSize,
      y1: seg.r * cellSize,
      x2: seg.c2 * cellSize,
      y2: seg.r * cellSize
    });
  }
  for (const seg of mergedV) {
    wallLines.push({
      id: `wl_v_${lineId++}`,
      x1: seg.c * cellSize,
      y1: seg.r1 * cellSize,
      x2: seg.c * cellSize,
      y2: seg.r2 * cellSize
    });
  }

  return {
    cols,
    rows,
    cellSize,
    width: cols * cellSize,
    height: rows * cellSize,
    cells,
    wallLines,
    startPos: { c: startC, r: startR },
    finishPos: goalPos,
    deadEndPos,
    stations: stationPlacements,
    stationsByPos,
    mergedWalls: {
      horizontal: mergedH,
      vertical: mergedV
    },
    stateGraph,
    expressionModel
  };
}
