/**
 * stateGraph.js
 * 
 * Game State Graph (DAG) Generator and Value Store.
 * Performs breadth-first exploration of valid and trap calculation paths.
 * Merges equivalent mathematical states via canonical keys so different valid
 * execution orders converge on the exact same graph nodes.
 */

import { reduceWorkingTerms, createInitialWorkingTerms, formatWorkingExpression } from './expressionReducer.js';
import { getAllPossibleMoves } from './reductionEngine.js';

/**
 * Initializes the value store from parsed tokens.
 */
export function createInitialValueStore(tokens) {
  const availableValues = {};
  for (const t of tokens) {
    if (t.type === 'number') {
      availableValues[t.id] = {
        id: t.id,
        value: t.value,
        provenance: [t.id],
        isOriginal: true
      };
    }
  }
  return availableValues;
}

/**
 * Checks whether an operation's required operands exist in the value store.
 */
export function areOperandsAvailable(op, valueStore) {
  const left = op.leftOperand;
  const right = op.rightOperand;

  function hasOperand(opDesc) {
    if (opDesc.type === 'token') {
      return Boolean(valueStore[opDesc.id]);
    }
    if (opDesc.type === 'ref') {
      const resKey = `res_${opDesc.opId}`;
      return Boolean(valueStore[resKey]);
    }
    return false;
  }

  return hasOperand(left) && hasOperand(right);
}

/**
 * Executes an operation on a state's value store and working expression.
 */
export function executeOperationOnState(state, op, expressionModel) {
  const newValueStore = { ...state.valueStore };

  // Consume required operands
  if (op.leftOperand.type === 'token') {
    delete newValueStore[op.leftOperand.id];
  } else if (op.leftOperand.type === 'ref') {
    delete newValueStore[`res_${op.leftOperand.opId}`];
  }

  if (op.rightOperand.type === 'token') {
    delete newValueStore[op.rightOperand.id];
  } else if (op.rightOperand.type === 'ref') {
    delete newValueStore[`res_${op.rightOperand.opId}`];
  }

  // Store new intermediate result
  const resKey = `res_${op.id}`;
  newValueStore[resKey] = {
    id: resKey,
    opId: op.id,
    value: op.result,
    provenance: [...op.provenance],
    isOriginal: false
  };

  const newCompletedOpIds = [...state.completedOpIds, op.id].sort();
  const newWorkingTerms = reduceWorkingTerms(state.workingTerms, op, expressionModel);
  const newRemainingExpr = formatWorkingExpression(newWorkingTerms);

  return {
    completedOpIds: newCompletedOpIds,
    valueStore: newValueStore,
    carriedValue: op.result,
    workingTerms: newWorkingTerms,
    remainingExpression: newRemainingExpr,
    lastOperation: op
  };
}

/**
 * Generates canonical key for a state.
 * States with identical completed operations share the same canonical node.
 */
export function getCanonicalStateKey(completedOpIds, isTrap = false) {
  const sorted = [...completedOpIds].sort().join('+');
  return isTrap ? `TRAP:${sorted}` : `STATE:${sorted || 'START'}`;
}

/**
 * Generates the complete reachable State Graph (DAG).
 */
export function generateStateGraph(depGraphResult, expressionModel) {
  const { tokens, operations, trapOperations, targetResult } = depGraphResult;
  const initialValueStore = createInitialValueStore(tokens);
  const initialWorkingTerms = createInitialWorkingTerms(expressionModel);

  const initialState = {
    id: 's_start',
    canonicalKey: 'STATE:START',
    completedOpIds: [],
    valueStore: initialValueStore,
    carriedValue: null,
    workingTerms: initialWorkingTerms,
    remainingExpression: expressionModel.display,
    depth: 0,
    isTerminal: false,
    isGoal: false,
    isTrap: false
  };

  const nodes = new Map();
  const edges = [];
  const queue = [initialState];

  nodes.set(initialState.canonicalKey, initialState);

  const allOpCount = Object.keys(operations).length;

  while (queue.length > 0) {
    const current = queue.shift();

    // Check if goal reached (all valid operations completed)
    if (!current.isTrap && current.completedOpIds.length === allOpCount) {
      current.isTerminal = true;
      current.isGoal = true;
      continue;
    }

    // Find available operations using Dynamic Expression Reduction Engine (Algorithm B)
    // Every adjacent OPERAND -> OPERATOR -> OPERAND is an available choice for the child to explore.
    const availableOps = [];
    const seq = current.workingTerms.map(t => {
      if (t.type === 'number') {
        return {
          type: 'operand',
          id: t.id,
          value: t.value,
          text: t.text,
          provenance: t.provenance || [t.id]
        };
      }
      return {
        type: t.type === 'bracket' ? 'bracket' : 'operator',
        id: t.id,
        operator: t.text,
        text: t.text,
        provenance: t.provenance || [t.id]
      };
    });

    const possibleMoves = getAllPossibleMoves(seq);

    for (const move of possibleMoves) {
      // Find matching op in operations or dynamically create an operation descriptor
      const matchingOp = Object.values(operations).find(o =>
        o.operator === move.operatorSymbol &&
        ((o.leftOperand.id === move.leftOperand.id && o.rightOperand.id === move.rightOperand.id) ||
         (o.stationLabel === move.stationLabel))
      );

      // Determine if this move is a trap (e.g. violates BODMAS precedence relative to competing moves)
      let isTrapMove = false;
      let trapReason = '';

      if (move.operatorSymbol === '+' || move.operatorSymbol === '−') {
        const hasCompetingMulDiv = possibleMoves.some(otherMove =>
          (otherMove.operatorSymbol === '×' || otherMove.operatorSymbol === '÷') &&
          (otherMove.leftOperand.id === move.rightOperand.id || otherMove.rightOperand.id === move.leftOperand.id)
        );
        if (hasCompetingMulDiv) {
          isTrapMove = true;
          trapReason = `Premature ${move.operatorSymbol === '+' ? 'addition' : 'subtraction'} before multiplication/division.`;
        }
      }

      const opDef = matchingOp ? {
        ...matchingOp,
        stationLabel: move.stationLabel,
        unsolvedLabel: move.unsolvedLabel,
        isTrap: matchingOp.isTrap || isTrapMove,
        reason: matchingOp.reason || trapReason
      } : {
        id: move.id,
        operator: move.operatorSymbol,
        operatorTokenId: move.operator.id,
        operatorTokenIndex: 0,
        leftOperand: { type: 'token', id: move.leftOperand.id, value: move.leftOperand.value, sourceTokens: move.leftOperand.provenance },
        rightOperand: { type: 'token', id: move.rightOperand.id, value: move.rightOperand.value, sourceTokens: move.rightOperand.provenance },
        dependencies: [],
        sourceTokens: move.provenance,
        provenance: move.provenance,
        result: move.result,
        stationLabel: move.stationLabel,
        unsolvedLabel: move.unsolvedLabel,
        isTrap: isTrapMove,
        reason: trapReason
      };

      availableOps.push(opDef);
    }

    if (availableOps.length === 0) {
      current.isTerminal = true;
      continue;
    }

    for (const op of availableOps) {
      const isTrapTransition = Boolean(op.isTrap || current.isTrap);
      const nextData = executeOperationOnState(current, op, expressionModel);
      const nextKey = getCanonicalStateKey(nextData.completedOpIds, isTrapTransition);

      let nextNode = nodes.get(nextKey);
      if (!nextNode) {
        const isGoalNode = !isTrapTransition && nextData.completedOpIds.length === allOpCount;
        nextNode = {
          id: `s_${nodes.size}`,
          canonicalKey: nextKey,
          completedOpIds: nextData.completedOpIds,
          valueStore: nextData.valueStore,
          carriedValue: nextData.carriedValue,
          workingTerms: nextData.workingTerms,
          remainingExpression: nextData.remainingExpression,
          depth: current.depth + 1,
          isTerminal: isGoalNode,
          isGoal: isGoalNode,
          isTrap: isTrapTransition,
          trapReason: op.reason || current.trapReason || ''
        };
        nodes.set(nextKey, nextNode);
        queue.push(nextNode);
      }

      edges.push({
        id: `edge_${edges.length + 1}`,
        fromStateId: current.id,
        toStateId: nextNode.id,
        fromKey: current.canonicalKey,
        toKey: nextKey,
        operation: op,
        requiredValues: [op.leftOperand.value, op.rightOperand.value],
        resultingValue: op.result,
        isTrap: isTrapTransition
      });
    }
  }

  return {
    nodes: Array.from(nodes.values()),
    nodesByKey: nodes,
    edges,
    initialState,
    targetResult
  };
}
