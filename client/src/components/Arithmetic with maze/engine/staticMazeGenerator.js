/**
 * staticMazeGenerator.js
 * 
 * Mathematical State-Graph Driven Procedural Labyrinth Generator (Bridge-Zone Architecture)
 * 
 * Solves all architectural, gameplay, and pedagogical challenges:
 * 1. REAL LABYRINTHINE MAZE:
 *    Generates a dense, rich, interconnected procedural maze across the entire 15×11 grid.
 *    No more empty black voids or bare "two-tunnel" tracks! Players explore real forks,
 *    corridors, loops, and dead-end alleys.
 * 
 * 2. ZERO-BYPASS PHYSICAL GATING (Bridge / Articulation Point):
 *    The board is divided into Zone 1 (Exploration Labyrinth) and Zone 2 (Final Sanctum).
 *    A solid continental divide wall isolates Zone 2, with exactly ONE gateway at (9, 7).
 *    Placed directly on this gateway is Station 3: ( ) − ( ).
 *    It is mathematically and physically impossible to reach the Goal Star without
 *    passing through the gateway and evaluating the required math.
 * 
 * 3. SMOOTH FEEDER LOOP FOR MULTI-VALUE COLLECTION:
 *    A solid central island (columns 8-10, rows 4-5) creates a wide loop.
 *    Feeder 1 (10 ÷ 2) and Feeder 2 (5 × 3) sit on the arcs of this loop.
 *    The snake can enter, visit both in either order without tail collisions,
 *    and exit carrying dual values [15, 5] into the gateway.
 * 
 * 4. CASCADING WRONG-STATE EXPLORATION:
 *    The Precedence Trap (3 + 5) branches into a dedicated Distractor sub-maze
 *    that cascades through all 4 steps of the misconception (8 × 3 -> 24 - 10 -> 14 ÷ 2 = 7)
 *    and terminates at a dead-end wall with educational feedback.
 * 
 * 5. PROCEDURAL MICRO-RANDOMIZATION:
 *    Randomized DFS carving + loop braiding is executed across Zone 1 with random seeds,
 *    guaranteeing a unique, fresh layout on every single playthrough.
 */

function createSeededRandom(seed = 12345) {
  let s = (typeof seed === 'number' ? seed : 12345) % 2147483647;
  if (s <= 0) s += 2147483646;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function generateRandomStaticMaze(selectedRoutesData, options = {}) {
  const {
    selectedValid = [],
    selectedInvalid = [],
    targetResult = 13
  } = selectedRoutesData;

  const seed = options.seed || Math.floor(Math.random() * 1000000);
  const random = createSeededRandom(seed);

  const cols = 17;
  const rows = 10;
  const cellSize = 44;

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
        deadEndReason: null,
        station: null
      };
    }
  }

  // Zone 2 definition (lower-right final sanctum)
  function isZone2(c, r) {
    return c >= 12 && c <= 15 && r >= 6 && r <= 8;
  }

  // Solid central island inside the feeder loop
  function isIsland(c, r) {
    return (c >= 7 && c <= 9) && (r >= 3 && r <= 4);
  }

  // Playable Zone 1 bounds
  function isZone1Playable(c, r) {
    return c >= 1 && c <= cols - 2 && r >= 1 && r <= rows - 2 && !isZone2(c, r) && !isIsland(c, r);
  }

  // Helper to open wall between two adjacent cells
  function openWall(c1, r1, c2, r2) {
    if (!cells[c1] || !cells[c1][r1] || !cells[c2] || !cells[c2][r2]) return;
    cells[c1][r1].isCarved = true;
    cells[c2][r2].isCarved = true;
    if (c1 === c2) {
      if (r1 < r2) {
        cells[c1][r1].walls.bottom = false;
        cells[c2][r2].walls.top = false;
      } else {
        cells[c1][r1].walls.top = false;
        cells[c2][r2].walls.bottom = false;
      }
    } else if (r1 === r2) {
      if (c1 < c2) {
        cells[c1][r1].walls.right = false;
        cells[c2][r2].walls.left = false;
      } else {
        cells[c1][r1].walls.left = false;
        cells[c2][r2].walls.right = false;
      }
    }
  }

  // Carve corridor helper
  function carve(c1, r1, c2, r2) {
    const minC = Math.min(c1, c2);
    const maxC = Math.max(c1, c2);
    const minR = Math.min(r1, r2);
    const maxR = Math.max(r1, r2);

    if (c1 === c2) {
      for (let r = minR; r < maxR; r++) {
        openWall(c1, r, c1, r + 1);
      }
    } else if (r1 === r2) {
      for (let c = minC; c < maxC; c++) {
        openWall(c, r1, c + 1, r1);
      }
    }
  }

  // Start and Finish positions
  const startPos = { c: 1, r: 1 };
  const finishPos = { c: 15, r: 8 };
  cells[startPos.c][startPos.r].isStart = true;
  cells[finishPos.c][finishPos.r].isFinish = true;

  // -------------------------------------------------------------------------
  // 1. CARVE CORE MATHEMATICAL BACKBONE IN ZONE 1
  // -------------------------------------------------------------------------
  // Entrance corridor
  carve(1, 1, 3, 1);
  carve(3, 1, 3, 2);
  carve(3, 2, 5, 2);

  // Feeder Loop encircling island [c: 7..9, r: 3..4]
  carve(5, 2, 11, 2);   // Top loop corridor
  carve(11, 2, 11, 5);  // Right loop corridor
  carve(5, 5, 12, 5);   // Bottom loop corridor (connects directly to gateway at (12, 5))
  carve(5, 2, 5, 5);    // Left loop corridor

  // -------------------------------------------------------------------------
  // 2. CARVE ZONE 2 & THE ONLY GATEWAY (ARTICULATION BRIDGE)
  // -------------------------------------------------------------------------
  // (12, 5) in Zone 1 connects to (12, 6) in Zone 2.
  // This is the ONLY door into Zone 2!
  openWall(12, 5, 12, 6);
  carve(12, 6, 12, 8);
  carve(12, 8, 15, 8);

  // Decorative safe alcove in Zone 2
  if (random() > 0.4) {
    carve(15, 6, 15, 7);
  }

  // -------------------------------------------------------------------------
  // 3. CARVE DEAD STATE 1 (LOWER-LEFT CASCADING SUB-MAZE)
  // -------------------------------------------------------------------------
  carve(3, 2, 3, 4);
  carve(3, 4, 3, 6);
  carve(1, 6, 3, 6);
  carve(1, 6, 1, 8);
  carve(1, 8, 4, 8);
  carve(4, 8, 4, 7);
  carve(4, 7, 6, 7);
  carve(6, 7, 6, 6);
  const deadEndPos = { c: 6, r: 6 };
  cells[deadEndPos.c][deadEndPos.r].isDeadEnd = true;
  cells[deadEndPos.c][deadEndPos.r].deadEndReason = null;

  // -------------------------------------------------------------------------
  // 4. CARVE DEAD STATE 2 (UPPER-RIGHT EAST SUB-MAZE - NEW!)
  // -------------------------------------------------------------------------
  openWall(11, 2, 12, 2);
  carve(12, 2, 15, 2);
  carve(15, 2, 15, 4);
  carve(13, 4, 15, 4);
  carve(13, 4, 13, 5);
  carve(13, 5, 15, 5);
  const deadEndPos2 = { c: 15, r: 5 };
  cells[deadEndPos2.c][deadEndPos2.r].isDeadEnd = true;
  cells[deadEndPos2.c][deadEndPos2.r].deadEndReason = null;

  // -------------------------------------------------------------------------
  // 5. DENSE PROCEDURAL MAZE EXPANSION ACROSS ZONE 1
  // -------------------------------------------------------------------------
  const DIRS = [
    { dc: 0, dr: -1, name: 'top' },
    { dc: 1, dr: 0, name: 'right' },
    { dc: 0, dr: 1, name: 'bottom' },
    { dc: -1, dr: 0, name: 'left' }
  ];

  // Carve branches into uncarved playable Zone 1 cells (eliminates empty space)
  for (let pass = 0; pass < 110; pass++) {
    const candidates = [];
    for (let c = 1; c <= cols - 2; c++) {
      for (let r = 1; r <= rows - 2; r++) {
        if (!cells[c][r].isCarved && isZone1Playable(c, r)) {
          for (const d of DIRS) {
            const nc = c + d.dc;
            const nr = r + d.dr;
            if (isZone1Playable(nc, nr) && cells[nc][nr].isCarved) {
              candidates.push({ c, r, nc, nr });
            }
          }
        }
      }
    }
    if (candidates.length === 0) break;
    const pick = candidates[Math.floor(random() * candidates.length)];
    openWall(pick.c, pick.r, pick.nc, pick.nr);
  }

  // -------------------------------------------------------------------------
  // 6. RANDOM BRAIDING IN ZONE 1 (CREATES ALTERNATE LOOPS & EXPLORATION)
  // -------------------------------------------------------------------------
  let braided = 0;
  for (let attempt = 0; attempt < 140 && braided < 14; attempt++) {
    const c = 1 + Math.floor(random() * (cols - 2));
    const r = 1 + Math.floor(random() * (rows - 2));
    const d = DIRS[Math.floor(random() * DIRS.length)];
    const nc = c + d.dc;
    const nr = r + d.dr;
    if (isZone1Playable(c, r) && isZone1Playable(nc, nr)) {
      if (cells[c][r].isCarved && cells[nc][nr].isCarved && cells[c][r].walls[d.name]) {
        openWall(c, r, nc, nr);
        braided++;
      }
    }
  }

  // -------------------------------------------------------------------------
  // 7. STAMP CALCULATION STATIONS
  // -------------------------------------------------------------------------
  const stations = [];
  const stationsByPos = {};

  function registerStation(st) {
    if (!st) return;
    stations.push(st);
    stationsByPos[`${st.c},${st.r}`] = st;
    cells[st.c][st.r].station = st;
  }

  function makeStation(id, step, c, r, isTrap = false, prerequisiteStationId = null) {
    if (!step) return null;
    const isLeftCalc = step.leftOperandType === 'calculated' || (typeof step.unsolvedLabel === 'string' && step.unsolvedLabel.startsWith('(   )'));
    const isRightCalc = step.rightOperandType === 'calculated' || (typeof step.unsolvedLabel === 'string' && step.unsolvedLabel.endsWith('(   )'));
    const isOpening = prerequisiteStationId === null;
    return {
      id,
      opId: step.operationId,
      c,
      r,
      label: step.stationLabel,
      unsolvedLabel: step.unsolvedLabel,
      leftOperand: step.leftOperand,
      rightOperand: step.rightOperand,
      prerequisiteStationId,
      isOpeningState: isOpening,
      operation: {
        id: step.operationId,
        operator: step.operator,
        leftOperand: {
          type: isLeftCalc ? 'ref' : 'token',
          value: step.leftOperand,
          id: !isLeftCalc ? step.leftOperandId : undefined,
          opId: isLeftCalc ? (step.leftOperandId || `calc_${step.leftOperand}`) : undefined
        },
        rightOperand: {
          type: isRightCalc ? 'ref' : 'token',
          value: step.rightOperand,
          id: !isRightCalc ? step.rightOperandId : undefined,
          opId: isRightCalc ? (step.rightOperandId || `calc_${step.rightOperand}`) : undefined
        },
        result: step.result,
        stationLabel: step.stationLabel,
        unsolvedLabel: step.unsolvedLabel,
        provenance: step.provenance,
        sourceTokens: step.provenance,
        isInvalid: isTrap
      },
      result: step.result,
      expressionBefore: step.expressionBefore,
      expressionAfter: step.expressionAfter,
      isTrap,
      isTrapStation: isTrap
    };
  }

  // Pick canonical valid route with dual combiner at step 2 (combines the two feeder terms)
  let bestValid = selectedValid[0];
  const directCombiner = selectedValid.find(r =>
    r.steps && r.steps.length >= 3 && r.steps[2].leftOperandType === 'calculated' && r.steps[2].rightOperandType === 'calculated'
  );
  if (directCombiner) bestValid = directCombiner;

  // Stamp Valid Route in strict topological dependency order:
  // Step 0: Feeder 1 on top corridor of Feeder Loop at (8, 2) [Opening Station]
  // Step 1: Feeder 2 on right corridor of Feeder Loop at (11, 4) [Reveals after Feeder 1]
  // Step 2: Bridge Doorway at (12, 6) -> combines Feeder 1 & Feeder 2 [Reveals after Feeder 2]
  // Step 3: Final Stage inside Zone 2 corridor at (14, 8) -> produces targetResult for Goal Star
  if (bestValid && bestValid.steps) {
    const steps = bestValid.steps;
    const step0 = steps[0]; // Feeder 1 (MD)
    const step1 = steps[1]; // Feeder 2 (MD)
    const step2 = steps[2]; // Doorway Combiner (e.g. 15 − 5)
    const step3 = steps[3]; // Final Operation before Goal Star

    const f1Col = random() > 0.5 ? 9 : 8;

    if (step0) registerStation(makeStation('st_feeder_0', step0, f1Col, 2, false, null));
    if (step1) registerStation(makeStation('st_feeder_1', step1, 11, 4, false, 'st_feeder_0'));
    if (step2) registerStation(makeStation('st_bridge_door', step2, 12, 6, false, 'st_feeder_1')); // Articulation bridge!
    if (step3) registerStation(makeStation('st_final_stage', step3, 14, 8, false, 'st_bridge_door'));
  }

  // Stamp Dead State 1 (Cascading Distractor Route 1 in lower-left sub-maze):
  // Step 0: 3 + 5 (Premature addition error = 8) [Opening Distractor]
  // Step 1: ( ) × (3) (Cascading error = 24) [Reveals after st_trap_0]
  // Step 2: ( ) − (10) (Cascading error = 14) [Reveals after st_trap_1]
  // Step 3: ( ) ÷ (2) (Cascading error = 7) -> Dead End Wall 1!
  if (selectedInvalid && selectedInvalid[0] && selectedInvalid[0].steps) {
    const invSteps = selectedInvalid[0].steps;
    if (invSteps[0]) registerStation(makeStation('st_trap_0', invSteps[0], 3, 4, true, null));
    if (invSteps[1]) registerStation(makeStation('st_trap_1', invSteps[1], 1, 7, true, 'st_trap_0'));
    if (invSteps[2]) registerStation(makeStation('st_trap_2', invSteps[2], 3, 8, true, 'st_trap_1'));
    if (invSteps[3]) registerStation(makeStation('st_trap_3', invSteps[3], 5, 7, true, 'st_trap_2'));
  }

  // Stamp Dead State 2 (Cascading Distractor Route 2 in upper-right sub-maze - NEW!):
  // Step 1: (3) + (15) (Premature addition before division = 18) [Reveals after st_feeder_0]
  // Step 2: (18) − (10) (Cascading error = 8) [Reveals after st_trap2_1]
  // Step 3: (8) ÷ (2) (Cascading error = 4) -> Dead End Wall 2!
  if (selectedInvalid && selectedInvalid[1] && selectedInvalid[1].steps) {
    const inv2Steps = selectedInvalid[1].steps;
    if (inv2Steps[1]) registerStation(makeStation('st_trap2_1', inv2Steps[1], 13, 2, true, 'st_feeder_0'));
    if (inv2Steps[2]) registerStation(makeStation('st_trap2_2', inv2Steps[2], 15, 3, true, 'st_trap2_1'));
    if (inv2Steps[3]) registerStation(makeStation('st_trap2_3', inv2Steps[3], 13, 4, true, 'st_trap2_2'));
  }

  // =========================================================================
  // 7. MERGE COLLINEAR WALL SEGMENTS INTO SEAMLESS CHALK LINES
  // =========================================================================
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

  const mergedH = [];
  const hByRow = {};
  for (const seg of rawH) {
    if (!hByRow[seg.r]) hByRow[seg.r] = [];
    hByRow[seg.r].push({ c1: seg.c1, c2: seg.c2 });
  }
  for (const rKey of Object.keys(hByRow)) {
    const r = parseInt(rKey, 10);
    const segs = hByRow[r].sort((a, b) => a.c1 - b.c1);
    let cur = { r, ...segs[0] };
    for (let i = 1; i < segs.length; i++) {
      if (segs[i].c1 <= cur.c2) {
        cur.c2 = Math.max(cur.c2, segs[i].c2);
      } else {
        mergedH.push(cur);
        cur = { r, ...segs[i] };
      }
    }
    mergedH.push(cur);
  }

  const mergedV = [];
  const vByCol = {};
  for (const seg of rawV) {
    if (!vByCol[seg.c]) vByCol[seg.c] = [];
    vByCol[seg.c].push({ r1: seg.r1, r2: seg.r2 });
  }
  for (const cKey of Object.keys(vByCol)) {
    const c = parseInt(cKey, 10);
    const segs = vByCol[c].sort((a, b) => a.r1 - b.r1);
    let cur = { c, ...segs[0] };
    for (let i = 1; i < segs.length; i++) {
      if (segs[i].r1 <= cur.r2) {
        cur.r2 = Math.max(cur.r2, segs[i].r2);
      } else {
        mergedV.push(cur);
        cur = { c, ...segs[i] };
      }
    }
    mergedV.push(cur);
  }

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

  const deadEndLocations = [
    {
      c: deadEndPos.c,
      r: deadEndPos.r,
      routeId: 'route_distractor_1'
    },
    {
      c: deadEndPos2.c,
      r: deadEndPos2.r,
      routeId: 'route_distractor_2'
    }
  ];

  return {
    cols,
    rows,
    cellSize,
    width: cols * cellSize,
    height: rows * cellSize,
    cells,
    wallLines,
    startPos,
    finishPos,
    deadEndPos,
    deadEndLocations,
    stations,
    stationsByPos,
    mergedWalls: { horizontal: mergedH, vertical: mergedV },
    selectedRoutesData,
    seed
  };
}
