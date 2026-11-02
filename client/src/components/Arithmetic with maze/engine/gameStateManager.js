/**
 * Game State Manager for BODMAS Interactive Snake Maze
 * 
 * Orchestrates:
 * - Mathematical expression reduction state (ExpressionEngine)
 * - Continuously growing snake tracking full explored corridor route
 * - Full multi-step backtracking (undo restores all mathematical and visual states)
 * - Dynamic empty brackets and value feeding into stations
 * - Natural dead-end termination (zero artificial gates/overlays)
 */

import {
  createInitialCalculationState,
  executeOperationStep,
  validateCompletedSequence,
  canExecuteStationWithSnake,
  getStationRequiredOperands
} from './expressionEngine.js';

import {
  generateMazeGrid,
  canMoveInGrid,
  getNextCell
} from './mazeEngine.js';

/**
 * Finds if the snake is directly adjacent to and about to bite an uncompleted station
 * (Distance 1 only, through open corridor without separating walls).
 * Excludes stations with token provenance conflicts (defunct/consumed stations).
 */
export function findNearbyStation(grid, snake, solvedStationIds = [], calculation = null, expression = null) {
  if (!grid || !snake) return null;

  function isUnlocked(st) {
    if (!st) return false;
    if (st.isOpeningState || !st.prerequisiteStationId) return true;
    return solvedStationIds.includes(st.prerequisiteStationId);
  }

  function isConflicted(st) {
    if (!st || !calculation || !expression) return false;
    return isStationDefunct(st, calculation, expression, grid) || Boolean(checkStationProvenanceConflict(st, calculation, expression)?.hasConflict);
  }

  // 1. Check if snake head is directly on an unsolved station cell
  const currentKey = `${snake.c},${snake.r}`;
  const currentStation = grid.stationsByPos && grid.stationsByPos[currentKey];
  if (currentStation && !solvedStationIds.includes(currentStation.id) && isUnlocked(currentStation) && !isConflicted(currentStation)) {
    return currentStation;
  }

  // 2. Check 4 directly adjacent open neighbors (only distance 1, and only if no separating wall)
  // The snake is "about to bite" the station if it can physically step directly onto it.
  const DIRS = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
  for (const dir of DIRS) {
    if (canMoveInGrid(grid, snake.c, snake.r, dir)) {
      const next = getNextCell(snake.c, snake.r, dir);
      const key = `${next.c},${next.r}`;
      const station = grid.stationsByPos && grid.stationsByPos[key];
      if (station && !solvedStationIds.includes(station.id) && isUnlocked(station) && !isConflicted(station)) {
        return station;
      }
    }
  }

  return null;
}

/**
 * Returns the raw token IDs and values that this station DIRECTLY consumes as literal operands.
 * Calculated / reference operands (results carried in the mouth) are NOT literal tokens.
 */
export function getStationDirectLiteralTokens(station, expression) {
  const direct = [];
  const stOp = station?.operation || station;
  if (!stOp) return direct;

  const tokens = expression?.tokens || [];

  const resolveLiteral = (operandDesc, fallbackVal, side) => {
    if (!operandDesc) return;
    const type = operandDesc.type;
    const isRef = type === 'ref' || type === 'calculated';
    if (isRef) return; // Carried in mouth, not a raw token

    // 1. If explicit token id is given
    if (operandDesc.id && typeof operandDesc.id === 'string' && operandDesc.id.startsWith('t_')) {
      direct.push({ id: operandDesc.id, value: operandDesc.value ?? fallbackVal, side });
      return;
    }

    // 2. If tokenIndex is given
    if (operandDesc.tokenIndex !== undefined && tokens[operandDesc.tokenIndex]) {
      const tok = tokens[operandDesc.tokenIndex];
      direct.push({ id: tok.id, value: tok.value, side });
      return;
    }

    // 3. Match against expression tokens using operandDesc.value or fallbackVal
    const val = operandDesc.value ?? fallbackVal;
    if (val !== null && val !== undefined) {
      const stTokens = stOp.sourceTokens || stOp.provenance || [];
      const match = tokens.find(t => t.type === 'number' && t.value === val && (stTokens.length === 0 || stTokens.includes(t.id)));
      if (match && !direct.some(d => d.id === match.id)) {
        direct.push({ id: match.id, value: match.value, side });
      }
    }
  };

  resolveLiteral(stOp.leftOperand, station?.leftOperand, 'left');
  resolveLiteral(stOp.rightOperand, station?.rightOperand, 'right');

  return direct;
}

/**
 * Checks whether an unsolved station is defunct / blocked because
 * a conflicting branch was chosen or required operands can never be satisfied.
 */
export function isStationDefunct(station, calculation, expression, mazeGrid = null) {
  if (!station || !calculation?.completedOperations || calculation.completedOperations.length === 0) {
    return false;
  }

  // 1. Direct literal token conflict
  if (checkStationProvenanceConflict(station, calculation, expression)) {
    return true;
  }

  // 2. Check if this station's calculated operands can still be satisfied
  const stOp = station.operation || station;
  const carried = calculation.carriedValues || (calculation.carriedValue !== null ? [calculation.carriedValue] : []);
  const allStations = mazeGrid?.stationsByPos ? Object.values(mazeGrid.stationsByPos) : (mazeGrid?.stations || []);

  const isRefUnobtainable = (operandDesc, fallbackVal) => {
    if (!operandDesc) return false;
    const isRef = operandDesc.type === 'ref' || operandDesc.type === 'calculated';
    if (!isRef) return false;

    const val = operandDesc.value ?? fallbackVal;
    if (val === null || val === undefined) return false;

    // Currently held in snake's mouth? Then it's available!
    if (carried.includes(val)) return false;

    // If not in mouth: can any available station in the maze produce this value?
    if (allStations.length === 0) return false;

    const producers = allStations.filter(s => s.id !== station.id && s.result === val);
    if (producers.length === 0) return true; // No station produces this value

    // If all producers are already completed (and result is no longer in mouth), it was lost
    const hasAvailableProducer = producers.some(p => {
      const isCompleted = calculation.completedOperations.some(o => o.id === p.id || o.id === p.opId);
      if (isCompleted) return false;
      // Is producer itself conflicted?
      if (checkStationProvenanceConflict(p, calculation, expression)) return false;
      return true;
    });

    return !hasAvailableProducer;
  };

  if (isRefUnobtainable(stOp.leftOperand, station.leftOperand)) return true;
  if (isRefUnobtainable(stOp.rightOperand, station.rightOperand)) return true;

  return false;
}

/**
 * Detects whether a station's required source tokens (operands) have already been
 * consumed by an earlier completed operation. If so, this station is defunct/impossible
 * and must act as a solid wall.
 * 
 * Returns { hasConflict: true, conflictingTokenId, conflictingTokenValue, consumingOp, ... } or null.
 */
export function checkStationProvenanceConflict(station, calculation, expression) {
  if (!calculation?.completedOperations || calculation.completedOperations.length === 0) {
    return null;
  }

  // 1. Get the direct literal tokens required by this station
  const directLiterals = getStationDirectLiteralTokens(station, expression);
  if (directLiterals.length === 0) {
    // This station consumes NO literal tokens from the question
    // (e.g. composite station like 15 - 5 where both operands are carried in mouth).
    return null;
  }

  // 2. Check if ANY completed operation already consumed any of these direct literal tokens
  for (const compOp of calculation.completedOperations) {
    const compTokens = compOp.provenance || [];
    if (compTokens.length === 0) continue;

    for (const lit of directLiterals) {
      if (compTokens.includes(lit.id)) {
        // Token lit.id was already consumed by compOp!
        const tokenObj = expression?.tokens?.find(t => t.id === lit.id) || { value: lit.value };
        const tokenVal = tokenObj.value ?? lit.value;
        const opLabel = compOp.stationLabel || compOp.equationText || `${compOp.leftVal} ${compOp.operator} ${compOp.rightVal}`;
        const eqText = compOp.equationText || `${opLabel} = ${compOp.result}`;

        return {
          hasConflict: true,
          conflictingStation: station,
          conflictingTokenId: lit.id,
          conflictingTokenValue: tokenVal,
          consumingOp: compOp,
          consumingOpTokens: compTokens,
          resultValue: compOp.result,
          equationText: eqText,
          message: `"${tokenVal}" was already used in (${opLabel} = ${compOp.result})!`
        };
      }
    }
  }

  return null;
}

/**
 * Generates concise, actionable player guidance when bumping into an unexecutable station.
 * Rather than technical logs ("Needs [15 and 5] in mouth"), it tells the player directly
 * what needs to be collected: e.g. "Collect (5 × 3) and (10 ÷ 2) first!"
 */
export function getPrerequisiteStationsMessage(station, check, expression, mazeGrid, solvedStationIds = []) {
  const stations = mazeGrid?.stationsByPos ? Object.values(mazeGrid.stationsByPos) : [];
  const missingLabels = [];

  for (const missingVal of (check.missing || [])) {
    // Look for station in maze that produces this value
    const foundSt = stations.find(s => !solvedStationIds.includes(s.id) && s.result === missingVal && s.id !== station.id)
      || stations.find(s => s.result === missingVal && s.id !== station.id);

    let label = '';
    if (foundSt) {
      label = foundSt.label || foundSt.unsolvedLabel;
    } else if (expression?.operations) {
      const op = Object.values(expression.operations).find(o => o.result === missingVal);
      if (op) label = op.stationLabel || op.unsolvedLabel;
    }

    if (!label) {
      label = String(missingVal);
    }

    const trimmed = label.trim();
    const wrapped = (trimmed.startsWith('(') && trimmed.endsWith(')')) ? trimmed : `(${trimmed})`;
    if (!missingLabels.includes(wrapped)) {
      missingLabels.push(wrapped);
    }
  }

  if (missingLabels.length === 0) {
    return 'Collect prerequisites first!';
  }

  if (missingLabels.length === 1) {
    return `Collect ${missingLabels[0]} first!`;
  }

  if (missingLabels.length === 2) {
    return `Collect ${missingLabels[0]} and ${missingLabels[1]} first!`;
  }

  return `Collect ${missingLabels.slice(0, -1).join(', ')} and ${missingLabels[missingLabels.length - 1]} first!`;
}

/**
 * Initializes the entire game state for a given expression
 */
export function createInitialGameState(expression, config = {}) {
  const mazeGrid = generateMazeGrid(expression, config);
  const activeExpression = mazeGrid.expressionModel || expression;
  const calculation = createInitialCalculationState(activeExpression);
  const startPos = mazeGrid.startPos;
  const cellSize = mazeGrid.cellSize;

  const startX = startPos.c * cellSize + cellSize / 2;
  const startY = startPos.r * cellSize + cellSize / 2;

  // Initial snake starts at the entrance
  const initialSegments = [
    { c: startPos.c, r: startPos.r, x: startX, y: startY }
  ];

  const initialSnake = {
    c: startPos.c,
    r: startPos.r,
    x: startX,
    y: startY,
    currentNodeId: `${startPos.c},${startPos.r}`,
    heading: 'DOWN',
    segments: initialSegments,
    isAnimating: false,
    carriedValue: null,
    carriedValues: []
  };

  const initialMazeState = {
    currentCell: { ...startPos },
    currentNodeId: `${startPos.c},${startPos.r}`,
    visitedKeys: [`${startPos.c},${startPos.r}`],
    solvedStationIds: [],
    isAtFinish: false,
    isAtDeadEnd: false,
    deadEndReason: null
  };

  return {
    expression: activeExpression,
    mazeGraph: mazeGrid,
    mazeGrid,
    snake: initialSnake,
    calculation,
    mazeState: initialMazeState,
    nearbyStation: findNearbyStation(mazeGrid, initialSnake, [], calculation, activeExpression),
    conflictAnimation: null,
    historyStack: [],
    status: 'NAVIGATING',
    message: `Target is ${activeExpression.targetResult || 13} ★ Which operation should we solve first in BODMAS?`
  };
}

/**
 * Creates an immutable snapshot of current state for the history stack
 */
function createSnapshot(state) {
  return {
    snake: {
      c: state.snake.c,
      r: state.snake.r,
      x: state.snake.x,
      y: state.snake.y,
      currentNodeId: state.snake.currentNodeId,
      heading: state.snake.heading,
      segments: state.snake.segments.map(s => ({ ...s })),
      carriedValue: state.snake.carriedValue,
      carriedValues: state.snake.carriedValues ? [...state.snake.carriedValues] : []
    },
    calculation: {
      carriedValue: state.calculation.carriedValue,
      carriedValues: state.calculation.carriedValues ? [...state.calculation.carriedValues] : [],
      pendingTray: state.calculation.pendingTray.map(p => ({ ...p })),
      completedOperations: state.calculation.completedOperations.map(o => ({
        ...o,
        provenance: o.provenance ? [...o.provenance] : []
      })),
      executedOpIds: [...state.calculation.executedOpIds],
      reductionTrace: [...state.calculation.reductionTrace],
      isSequenceValid: state.calculation.isSequenceValid,
      invalidationReasons: [...state.calculation.invalidationReasons],
      finalResult: state.calculation.finalResult,
      isComplete: state.calculation.isComplete
    },
    mazeState: {
      currentCell: { ...state.mazeState.currentCell },
      currentNodeId: state.mazeState.currentNodeId,
      visitedKeys: [...state.mazeState.visitedKeys],
      solvedStationIds: [...state.mazeState.solvedStationIds],
      isAtFinish: state.mazeState.isAtFinish,
      isAtDeadEnd: state.mazeState.isAtDeadEnd,
      deadEndReason: state.mazeState.deadEndReason
    },
    nearbyStation: state.nearbyStation ? { ...state.nearbyStation } : null,
    status: state.status,
    message: state.message
  };
}

/**
/**
 * Handles directional movement command (UP, DOWN, LEFT, RIGHT)
 * Automatically detects reverse traversal into the immediately previous cell
 * to trigger automatic undo and state restoration without any separate button.
 */
export function moveSnake(state, direction) {
  const { mazeGrid, snake, mazeState, calculation, expression, historyStack } = state;

  // 1. Check for automatic reverse traversal (backtracking along the exact corridor):
  // If moving in `direction` steps back into the immediately previous cell in history:
  if (historyStack && historyStack.length > 0) {
    const prevSnapshot = historyStack[historyStack.length - 1];
    const targetCell = getNextCell(snake.c, snake.r, direction);

    if (prevSnapshot && prevSnapshot.snake.c === targetCell.c && prevSnapshot.snake.r === targetCell.r) {
      // Retracing the immediately previous edge in the active movement history!
      // Automatically undo the previous step, retract the snake body, and restore mathematical state.
      return undoLastMove(state, direction);
    }
  }

  // 2. If already reached goal and not backtracking, keep state
  if (state.status === 'GOAL_REACHED') {
    return state;
  }

  // 3. Physical wall collision check
  const isMoveAllowed = canMoveInGrid(mazeGrid, snake.c, snake.r, direction);
  if (!isMoveAllowed) {
    return {
      ...state,
      conflictAnimation: null,
      message: 'Wall ahead! Turn along the corridor.'
    };
  }

  // 4. Snake body collision check:
  // The snake's body acts like a wall to its mouth. The snake cannot move over itself.
  const nextCell = getNextCell(snake.c, snake.r, direction);
  if (!mazeGrid.isLegacyHardcoded) {
    const isBodyCollision = snake.segments && snake.segments.some(seg => seg.c === nextCell.c && seg.r === nextCell.r);
    if (isBodyCollision) {
      return {
        ...state,
        conflictAnimation: null,
        message: "The snake's body blocks the path! Cannot cross your own trail."
      };
    }
  }

  // 5. Unexecutable station blocking check:
  // If target cell contains an unsolved station that cannot be executed (e.g. missing required operands
  // or invalid mathematical state), the station acts like a solid wall and blocks the snake from entering!
  const cellKey = `${nextCell.c},${nextCell.r}`;
  const targetStation = mazeGrid.stationsByPos[cellKey];
  const currentCarriedValues = snake.carriedValues ? [...snake.carriedValues] : (snake.carriedValue !== null ? [snake.carriedValue] : []);
  if (targetStation && !mazeState.solvedStationIds.includes(targetStation.id)) {
    // Check if station is locked because previous prerequisite state has not been solved
    if (targetStation.prerequisiteStationId && !mazeState.solvedStationIds.includes(targetStation.prerequisiteStationId)) {
      return {
        ...state,
        conflictAnimation: null,
        message: '⛔ Path is locked! Solve the previous operation first.'
      };
    }

    // 5A. Check Token Provenance Conflict (Universal)
    // If ANY raw token required by targetStation was already consumed by an earlier completed operation,
    // that station is defunct / impossible to evaluate and acts as a solid wall!
    const conflict = checkStationProvenanceConflict(targetStation, calculation, expression);
    if (conflict && conflict.hasConflict) {
      return {
        ...state,
        message: conflict.message,
        conflictAnimation: {
          id: Date.now(),
          conflictingStationId: targetStation.id,
          conflictingTokenId: conflict.conflictingTokenId,
          conflictingTokenValue: conflict.conflictingTokenValue,
          consumingEquation: conflict.equationText,
          consumingOpTokens: conflict.consumingOpTokens,
          consumingOpLabel: conflict.consumingOp.stationLabel || conflict.consumingOp.equationText,
          resultValue: conflict.resultValue
        }
      };
    }

    if (isStationDefunct(targetStation, calculation, expression, mazeGrid)) {
      const firstComp = calculation.completedOperations[0];
      const opLabel = firstComp?.stationLabel || firstComp?.equationText || 'an earlier move';
      return {
        ...state,
        conflictAnimation: null,
        message: `⛔ Path is blocked! You already chose (${opLabel} = ${firstComp?.result}). Move backward to retrace.`
      };
    }

    // 5B. Check operand values carried in mouth
    const check = canExecuteStationWithSnake(targetStation, currentCarriedValues, expression);
    if (!check.canExecute) {
      const guideMessage = getPrerequisiteStationsMessage(
        targetStation,
        check,
        expression,
        mazeGrid,
        mazeState.solvedStationIds
      );
      return {
        ...state,
        conflictAnimation: null,
        message: guideMessage
      };
    }
  }

  // 6. Goal Star executable check:
  // The snake cannot step onto the Goal Star unless all operations are completed and target result is in mouth
  if (nextCell.c === mazeGrid.finishPos.c && nextCell.r === mazeGrid.finishPos.r) {
    const hasTargetResult = currentCarriedValues.includes(expression.targetResult);
    if (!hasTargetResult || !calculation.isComplete) {
      return {
        ...state,
        conflictAnimation: null,
        message: `⛔ Goal Star is locked! Complete all operations to carry target ${expression.targetResult} in mouth.`
      };
    }
  }

  // Push current snapshot to history stack before moving
  const snapshot = createSnapshot(state);
  const newHistory = [...state.historyStack, snapshot];
  const cellSize = mazeGrid.cellSize;
  const targetX = nextCell.c * cellSize + cellSize / 2;
  const targetY = nextCell.r * cellSize + cellSize / 2;

  // Update snake position & GROW body trail (retaining complete explored route)
  const newHead = {
    c: nextCell.c,
    r: nextCell.r,
    x: targetX,
    y: targetY
  };
  const newSegments = [
    newHead,
    ...snake.segments
  ];

  // Check if target cell contains a calculation station
  let updatedCalculation = { ...calculation };
  let newSolvedStations = [...mazeState.solvedStationIds];
  let newCarriedValues = snake.carriedValues ? [...snake.carriedValues] : (snake.carriedValue !== null ? [snake.carriedValue] : []);
  let newCarriedValue = snake.carriedValue;
  let newStatus = 'NAVIGATING';
  let newMessage = `Moving ${direction}`;

  const station = mazeGrid.stationsByPos[cellKey];
  if (station && !newSolvedStations.includes(station.id)) {
    const check = canExecuteStationWithSnake(station, newCarriedValues, expression);
    if (check.canExecute) {
      // Execute the operation and update expression reduction trace
      updatedCalculation = executeOperationStep(
        calculation,
        expression,
        station.operation || station.opId,
        newCarriedValues,
        check.requiredValues
      );
      newSolvedStations.push(station.id);
      newCarriedValues = updatedCalculation.carriedValues;
      newCarriedValue = updatedCalculation.carriedValue;
      const latestReduced = updatedCalculation.reductionTrace[updatedCalculation.reductionTrace.length - 1];
      newMessage = `Reduced: ${latestReduced}`;
    }
  }

  // Check if reached Goal or Natural Dead End
  let isAtFinish = false;
  let isAtDeadEnd = false;
  let deadEndReason = mazeState.deadEndReason;

  if (nextCell.c === mazeGrid.finishPos.c && nextCell.r === mazeGrid.finishPos.r) {
    const hasTargetResult = newCarriedValues.includes(expression.targetResult);
    if (hasTargetResult && updatedCalculation.isComplete) {
      // Reached destination goal star!
      isAtFinish = true;
      newStatus = 'GOAL_REACHED';
      newMessage = `🎉 Goal Reached! Expression reduced to target ${expression.targetResult}!`;
    } else {
      newStatus = 'NAVIGATING';
      newMessage = `Goal reached, but expression not fully reduced! Target: ${expression.targetResult}. In mouth: [${newCarriedValues.join(', ')}].`;
    }
  } else if (
    (nextCell.c === mazeGrid.deadEndPos.c && nextCell.r === mazeGrid.deadEndPos.r) ||
    (mazeGrid.cells[nextCell.c] && mazeGrid.cells[nextCell.c][nextCell.r].isDeadEnd)
  ) {
    // Reached natural dead-end wall
    isAtDeadEnd = true;
    newStatus = 'DEAD_END';
    const target = expression.targetResult;

    // Dynamically retrieve the child's current evaluated value or carried number
    const latestTrace = updatedCalculation.reductionTrace?.[updatedCalculation.reductionTrace.length - 1];
    const isTraceNumber = latestTrace !== undefined && latestTrace !== null && latestTrace !== '' && !isNaN(Number(latestTrace));

    let resultVal = null;
    if (isTraceNumber) {
      resultVal = latestTrace;
    } else if (newCarriedValues.length > 0) {
      resultVal = newCarriedValues[newCarriedValues.length - 1];
    } else if (updatedCalculation.completedOperations?.length > 0) {
      resultVal = updatedCalculation.completedOperations[updatedCalculation.completedOperations.length - 1].result;
    } else if (snake.carriedValue !== null && snake.carriedValue !== undefined) {
      resultVal = snake.carriedValue;
    }

    if (resultVal !== null && resultVal !== undefined) {
      deadEndReason = `🤔 Got ${resultVal}, but target is ${target}! Try another path.`;
    } else {
      deadEndReason = `🤔 Dead end! Target is ${target}. Try another path.`;
    }
    newMessage = deadEndReason;
  }

  // Find nearby station for expression term highlighting (excluding conflicted stations)
  const nearbyStation = findNearbyStation(mazeGrid, newHead, newSolvedStations, updatedCalculation, expression);

  const newMazeState = {
    ...mazeState,
    currentCell: { ...nextCell },
    currentNodeId: cellKey,
    visitedKeys: [...new Set([...mazeState.visitedKeys, cellKey])],
    solvedStationIds: newSolvedStations,
    isAtFinish,
    isAtDeadEnd,
    deadEndReason
  };

  return {
    ...state,
    snake: {
      ...snake,
      c: nextCell.c,
      r: nextCell.r,
      x: targetX,
      y: targetY,
      currentNodeId: cellKey,
      heading: direction,
      segments: newSegments,
      carriedValue: newCarriedValue,
      carriedValues: newCarriedValues
    },
    calculation: updatedCalculation,
    mazeState: newMazeState,
    nearbyStation,
    conflictAnimation: null,
    historyStack: newHistory,
    status: newStatus,
    message: newMessage
  };
}

/**
 * Reverses the last move / calculation completely (Backtracking / Undo)
 * Restores position, retracts snake body, and completely restores mathematical state.
 */
export function undoLastMove(state, overrideHeading = null) {
  if (state.historyStack.length === 0) {
    return {
      ...state,
      conflictAnimation: null,
      message: 'Already at the beginning of the maze.'
    };
  }

  const newHistory = [...state.historyStack];
  const previousSnapshot = newHistory.pop();

  // Re-evaluate nearby station at restored position
  const restoredNearby = findNearbyStation(
    state.mazeGrid,
    previousSnapshot.snake,
    previousSnapshot.mazeState.solvedStationIds,
    previousSnapshot.calculation,
    state.expression
  );

  return {
    ...state,
    conflictAnimation: null,
    snake: {
      ...previousSnapshot.snake,
      heading: overrideHeading || previousSnapshot.snake.heading,
      segments: previousSnapshot.snake.segments.map(s => ({ ...s })),
      carriedValue: previousSnapshot.snake.carriedValue,
      carriedValues: previousSnapshot.snake.carriedValues ? [...previousSnapshot.snake.carriedValues] : []
    },
    calculation: {
      ...previousSnapshot.calculation,
      carriedValue: previousSnapshot.calculation.carriedValue,
      carriedValues: previousSnapshot.calculation.carriedValues ? [...previousSnapshot.calculation.carriedValues] : [],
      pendingTray: previousSnapshot.calculation.pendingTray.map(p => ({ ...p })),
      completedOperations: previousSnapshot.calculation.completedOperations.map(o => ({
        ...o,
        provenance: o.provenance ? [...o.provenance] : []
      })),
      executedOpIds: [...previousSnapshot.calculation.executedOpIds],
      reductionTrace: [...previousSnapshot.calculation.reductionTrace]
    },
    mazeState: {
      ...previousSnapshot.mazeState,
      currentCell: { ...previousSnapshot.mazeState.currentCell },
      visitedKeys: [...previousSnapshot.mazeState.visitedKeys],
      solvedStationIds: [...previousSnapshot.mazeState.solvedStationIds]
    },
    nearbyStation: restoredNearby,
    historyStack: newHistory,
    status: previousSnapshot.status,
    message: 'Reversed step. Snake retracted and mathematical state restored.'
  };
}
