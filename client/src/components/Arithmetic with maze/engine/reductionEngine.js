/**
 * reductionEngine.js
 * 
 * Dynamic Expression Reduction Engine.
 * 
 * Implements:
 * - Algorithm A: Ordered sequence representation from expression tokens
 * - Algorithm B: getAllPossibleMoves(expressionSequence) -> scans for all adjacent
 *                OPERAND -> OPERATOR -> OPERAND combinations without AST precedence restriction.
 * - Algorithm C: executeReduction(state, move) -> evaluates arithmetic, wraps in calculated node,
 *                formats bracketed representations (e.g. 3 + 5 × (3 − 10) ÷ 2), tracks provenance.
 * - Algorithm D: generateReductionGraph(initialSequence, standardAST) -> BFS with memoization,
 *                merging equivalent partial states across independent operation orders,
 *                classifying completed routes as BODMAS-valid or dead ends.
 * - AST Precedence Validation: compares completed reduction tree against standard AST.
 */

import { parseExpressionTokens, normalizeOperators } from './expressionParser.js';
import { parseExpressionAST } from './astParser.js';
import { buildDependencyGraph } from './dependencyGraph.js';
import { applyOp } from './stationGenerator.js';

/**
 * Algorithm A: Convert expression string or parsed tokens into an ordered sequence
 * of operand and operator tokens.
 */
export function createExpressionSequence(exprInput) {
  const tokens = typeof exprInput === 'string'
    ? parseExpressionTokens(exprInput)
    : (exprInput.tokens || parseExpressionTokens(exprInput.display || exprInput.raw));

  const sequence = [];

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === 'number') {
      sequence.push({
        type: 'operand',
        subType: 'literal',
        id: t.id,
        value: t.value,
        text: t.text,
        provenance: [t.id],
        bracketCount: 0
      });
    } else if (t.type === 'operator') {
      sequence.push({
        type: 'operator',
        id: t.id,
        operator: t.text,
        text: t.text,
        provenance: [t.id]
      });
    } else if (t.type === 'bracket') {
      // Retain explicit brackets from original input
      sequence.push({
        type: 'bracket',
        id: t.id,
        text: t.text,
        provenance: [t.id]
      });
    }
  }

  return sequence;
}

/**
 * Helper to check if a sequence element is a reducible operand
 */
export function isReducibleOperand(elem) {
  return elem && (elem.type === 'operand' || elem.type === 'calculated');
}

/**
 * Formats a sequence into a human-readable mathematical expression string
 */
export function formatSequence(sequence) {
  if (!sequence || sequence.length === 0) return '';
  const parts = [];

  for (let i = 0; i < sequence.length; i++) {
    const item = sequence[i];
    const prev = i > 0 ? sequence[i - 1] : null;

    let itemText = item.text !== undefined ? String(item.text) : String(item.value);
    if (item.type === 'calculated' && item.bracketed && !itemText.startsWith('(')) {
      itemText = `(${itemText})`;
    }

    if (!prev || itemText === ')' || (prev && prev.text === '(')) {
      parts.push(itemText);
    } else {
      parts.push(' ' + itemText);
    }
  }

  return parts.join('').trim();
}

/**
 * Algorithm B: Generate all possible next operations
 * Scans for every OPERAND -> OPERATOR -> OPERAND pattern in the current sequence.
 * Respects explicit bracket boundaries if present.
 */
export function getAllPossibleMoves(sequence) {
  const moves = [];

  for (let i = 0; i <= sequence.length - 3; i++) {
    const left = sequence[i];
    const op = sequence[i + 1];
    const right = sequence[i + 2];

    // Must be operand -> operator -> operand
    if (isReducibleOperand(left) && op.type === 'operator' && isReducibleOperand(right)) {
      // Check if bracket boundaries prevent this reduction:
      // If immediately preceded by '(' and immediately followed by ')', it is within brackets.
      // If one operand is inside brackets and the other is outside, skip until brackets are resolved.
      const hasPrecedingOpenBracket = i > 0 && sequence[i - 1].text === '(';
      const hasFollowingCloseBracket = i + 3 < sequence.length && sequence[i + 3].text === ')';

      // If an open bracket exists earlier without a matching close bracket before this op,
      // only operations strictly enclosed within innermost brackets can be reduced.
      const leftBracketDepth = getBracketDepthAt(sequence, i);
      const rightBracketDepth = getBracketDepthAt(sequence, i + 2);

      if (leftBracketDepth === rightBracketDepth) {
        const maxDepth = getMaxBracketDepth(sequence);
        // Only allow moves at the innermost bracket depth
        if (leftBracketDepth === maxDepth) {
          const moveId = `move_${left.id}_${op.id}_${right.id}`;
          const leftVal = left.value;
          const rightVal = right.value;
          const result = applyOp(op.operator, leftVal, rightVal);

          // Station label
          const stationLabel = `${leftVal} ${op.operator} ${rightVal}`;
          const unsolvedLabel = (left.type === 'calculated' && right.type === 'calculated')
            ? `(   ) ${op.operator} (   )`
            : left.type === 'calculated'
              ? `(   ) ${op.operator} (${rightVal})`
              : right.type === 'calculated'
                ? `(${leftVal}) ${op.operator} (   )`
                : `${leftVal} ${op.operator} ${rightVal}`;

          moves.push({
            id: moveId,
            startIndex: i,
            leftOperand: left,
            operator: op,
            rightOperand: right,
            operatorSymbol: op.operator,
            result,
            stationLabel,
            unsolvedLabel,
            provenance: [...left.provenance, op.id, ...right.provenance],
            enclosedByBrackets: hasPrecedingOpenBracket && hasFollowingCloseBracket
          });
        }
      }
    }
  }

  return moves;
}

function getBracketDepthAt(sequence, index) {
  let depth = 0;
  for (let i = 0; i < index; i++) {
    if (sequence[i].text === '(') depth++;
    if (sequence[i].text === ')') depth--;
  }
  return depth;
}

function getMaxBracketDepth(sequence) {
  let max = 0;
  let cur = 0;
  for (const item of sequence) {
    if (item.text === '(') {
      cur++;
      if (cur > max) max = cur;
    } else if (item.text === ')') {
      cur--;
    }
  }
  return max;
}

/**
 * Algorithm C: Execute the selected reduction on an expression state
 */
export function executeReduction(sequence, move) {
  const { startIndex, leftOperand, operator, rightOperand, result, provenance, enclosedByBrackets } = move;

  // Check if intermediate result needs bracket representation when formatted:
  // e.g. when 3 - 10 becomes (-7) or 3 + 5 becomes (8) before multiplication
  const prevSeq = startIndex > 0 ? sequence[startIndex - 1] : null;
  const nextSeq = startIndex + 3 < sequence.length ? sequence[startIndex + 3] : null;

  let needsBrackets = enclosedByBrackets;
  // If adjacent to a higher-precedence operator or negative number
  if (result < 0) {
    needsBrackets = true;
  } else if (operator.operator === '+' || operator.operator === '−') {
    const isAdjacentToMulOrDiv = (prevSeq && (prevSeq.operator === '×' || prevSeq.operator === '÷')) ||
                                 (nextSeq && (nextSeq.operator === '×' || nextSeq.operator === '÷'));
    if (isAdjacentToMulOrDiv) {
      needsBrackets = true;
    }
  }

  const resultText = needsBrackets ? `(${result})` : String(result);

  const calculatedNode = {
    type: 'calculated',
    id: `calc_${move.id}`,
    operator: operator.operator,
    left: leftOperand,
    right: rightOperand,
    value: result,
    text: resultText,
    bracketed: needsBrackets,
    provenance,
    tree: {
      type: 'BinaryOp',
      operator: operator.operator,
      left: leftOperand.tree || { type: 'Number', value: leftOperand.value, id: leftOperand.id },
      right: rightOperand.tree || { type: 'Number', value: rightOperand.value, id: rightOperand.id }
    }
  };

  // Replace [left, op, right] with calculatedNode
  // If enclosed by explicit brackets, remove the surrounding brackets as well
  let replaceStart = startIndex;
  let replaceEnd = startIndex + 3;

  if (enclosedByBrackets) {
    replaceStart = startIndex - 1;
    replaceEnd = startIndex + 4;
  }

  const nextSequence = [
    ...sequence.slice(0, replaceStart),
    calculatedNode,
    ...sequence.slice(replaceEnd)
  ];

  return {
    nextSequence,
    calculatedNode,
    formatted: formatSequence(nextSequence)
  };
}

/**
 * Canonical State Key:
 * Preserves the reduction tree identities and remaining sequence structure.
 * Equivalent partial states (where the set of completed operations is identical)
 * merge to the same canonical key regardless of order of independent evaluations.
 */
export function getCanonicalSequenceKey(sequence, completedMoves = []) {
  // Sort completed move IDs to merge independent evaluation orders
  const moveSignature = completedMoves
    .map(m => `${m.operatorSymbol}(${m.leftOperand.id},${m.rightOperand.id})`)
    .sort()
    .join('|');

  const seqSignature = sequence.map(elem => {
    if (elem.type === 'operator' || elem.type === 'bracket') return elem.text;
    return `[${elem.provenance.slice().sort().join(',')}:${elem.value}]`;
  }).join(' ');

  return `STATE[${moveSignature}]:${seqSignature}`;
}

/**
 * Compares a completed reduction tree against standard BODMAS AST
 */
export function validateTreeAgainstAST(completedTree, standardAST, allowAlgebraicEquivalence = true) {
  function areTreesEquivalent(nodeA, nodeB) {
    if (!nodeA || !nodeB) return false;
    if (nodeA.type !== nodeB.type) return false;

    if (nodeA.type === 'Number') {
      return nodeA.value === nodeB.value;
    }

    if (nodeA.type === 'BinaryOp') {
      if (nodeA.operator !== nodeB.operator) return false;

      // Check strict structural equivalence
      const strictMatch = areTreesEquivalent(nodeA.left, nodeB.left) &&
                          areTreesEquivalent(nodeA.right, nodeB.right);
      if (strictMatch) return true;

      // Allow commutative equivalence for + and ×
      if (nodeA.operator === '+' || nodeA.operator === '×') {
        const commMatch = areTreesEquivalent(nodeA.left, nodeB.right) &&
                          areTreesEquivalent(nodeA.right, nodeB.left);
        if (commMatch) return true;
      }
    }

    return false;
  }

  if (areTreesEquivalent(completedTree, standardAST)) {
    return true;
  }

  // If algebraic equivalence is allowed:
  // e.g., (A + B) - C is algebraically equivalent to A + (B - C)
  if (allowAlgebraicEquivalence && completedTree.type === 'BinaryOp' && standardAST.type === 'BinaryOp') {
    // Check if both produce identical results and only swap associative + and − terms
    // Standard: (A + B) - C  vs  Completed: A + (B - C)
    if (
      standardAST.operator === '−' && standardAST.left.operator === '+' &&
      completedTree.operator === '+' && completedTree.right.operator === '−'
    ) {
      const matchA = areTreesEquivalent(standardAST.left.left, completedTree.left);
      const matchB = areTreesEquivalent(standardAST.left.right, completedTree.right.left);
      const matchC = areTreesEquivalent(standardAST.right, completedTree.right.right);
      if (matchA && matchB && matchC) return true;
    }
  }

  return false;
}

/**
 * Algorithm D: Generate the complete Dynamic Expression Reduction Graph.
 * Explores all adjacent reduction choices (BODMAS-valid and invalid),
 * merges equivalent states, and classifies completed routes.
 */
export function generateReductionGraph(exprInput, options = {}) {
  const { maxNodes = 60 } = options;

  const astResult = typeof exprInput === 'string'
    ? parseExpressionAST(exprInput)
    : (exprInput.astResult || parseExpressionAST(exprInput.display || exprInput.raw));

  const initialSequence = createExpressionSequence(exprInput);
  const depGraph = buildDependencyGraph(astResult);
  const targetResult = depGraph.targetResult;
  const standardAST = astResult.ast;

  const initialState = {
    id: 's_start',
    canonicalKey: getCanonicalSequenceKey(initialSequence, []),
    sequence: initialSequence,
    completedMoves: [],
    depth: 0,
    formatted: formatSequence(initialSequence),
    carriedValue: null,
    isTerminal: false,
    isGoal: false,
    isTrap: false,
    trapReason: null
  };

  const nodes = new Map();
  const edges = [];
  const queue = [initialState];
  nodes.set(initialState.canonicalKey, initialState);

  let stateCounter = 0;

  while (queue.length > 0 && nodes.size < maxNodes) {
    const current = queue.shift();

    // Check if terminal: only one operand remains
    const operandsRemaining = current.sequence.filter(isReducibleOperand);
    if (operandsRemaining.length === 1 && current.sequence.length === 1) {
      current.isTerminal = true;
      const finalNode = operandsRemaining[0];
      const finalResult = finalNode.value;
      const isValidBODMAS = validateTreeAgainstAST(finalNode.tree, standardAST);

      if (isValidBODMAS && finalResult === targetResult) {
        current.isGoal = true;
      } else {
        current.isTrap = true;
        current.trapReason = isValidBODMAS
          ? `Result arithmetic mismatch.`
          : `Calculation order violated standard BODMAS rules.`;
      }
      continue;
    }

    const availableMoves = getAllPossibleMoves(current.sequence);
    if (availableMoves.length === 0) {
      current.isTerminal = true;
      continue;
    }

    for (const move of availableMoves) {
      const { nextSequence, calculatedNode, formatted } = executeReduction(current.sequence, move);
      const nextCompletedMoves = [...current.completedMoves, move];
      const nextKey = getCanonicalSequenceKey(nextSequence, nextCompletedMoves);

      // Determine if this specific move violates BODMAS precedence at this step
      // (e.g. performing + or − when an adjacent × or ÷ is available on the same operands)
      let moveIsTrap = false;
      let moveTrapReason = '';

      if (move.operatorSymbol === '+' || move.operatorSymbol === '−') {
        const hasCompetingMulDiv = availableMoves.some(otherMove =>
          (otherMove.operatorSymbol === '×' || otherMove.operatorSymbol === '÷') &&
          (otherMove.leftOperand.id === move.rightOperand.id || otherMove.rightOperand.id === move.leftOperand.id)
        );
        if (hasCompetingMulDiv) {
          moveIsTrap = true;
          moveTrapReason = `Operation ${move.stationLabel} performed before adjacent multiplication/division.`;
        }
      }

      const isSubtreeTrap = Boolean(current.isTrap || moveIsTrap);

      let nextNode = nodes.get(nextKey);
      if (!nextNode) {
        stateCounter++;
        const nextOperands = nextSequence.filter(isReducibleOperand);
        const isNextTerminal = nextOperands.length === 1 && nextSequence.length === 1;
        let isNextGoal = false;
        let nextTrapReason = isSubtreeTrap ? (current.trapReason || moveTrapReason) : null;

        if (isNextTerminal) {
          const isValidBODMAS = validateTreeAgainstAST(nextOperands[0].tree, standardAST);
          if (isValidBODMAS && !isSubtreeTrap && nextOperands[0].value === targetResult) {
            isNextGoal = true;
          } else {
            nextTrapReason = nextTrapReason || 'Calculation sequence violated BODMAS precedence.';
          }
        }

        nextNode = {
          id: `s_${stateCounter}`,
          canonicalKey: nextKey,
          sequence: nextSequence,
          completedMoves: nextCompletedMoves,
          depth: current.depth + 1,
          formatted,
          carriedValue: calculatedNode.value,
          isTerminal: isNextTerminal,
          isGoal: isNextGoal,
          isTrap: isSubtreeTrap || (isNextTerminal && !isNextGoal),
          trapReason: nextTrapReason
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
        move,
        operation: {
          id: move.id,
          operator: move.operatorSymbol,
          leftOperand: move.leftOperand,
          rightOperand: move.rightOperand,
          result: move.result,
          stationLabel: move.stationLabel,
          unsolvedLabel: move.unsolvedLabel,
          provenance: move.provenance,
          sourceTokens: move.provenance,
          isInvalid: isSubtreeTrap,
          reason: moveTrapReason
        },
        isTrap: isSubtreeTrap
      });
    }
  }

  return {
    initialState,
    initialSequence,
    nodes: Array.from(nodes.values()),
    nodesByKey: nodes,
    edges,
    standardAST,
    targetResult,
    astResult
  };
}
