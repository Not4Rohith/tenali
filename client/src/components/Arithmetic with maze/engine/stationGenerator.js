/**
 * Station Generator Module
 * 
 * Generates dynamic mathematical operation stations, empty bracket formats,
 * dependencies, and provenance mappings for any supported mathematical expression.
 */

import { parseExpressionTokens } from './expressionParser.js';
import { computeOperationProvenance } from './provenanceEngine.js';

/**
 * Standard calculation for elementary operators
 */
export function applyOp(op, a, b) {
  switch (op) {
    case '+':
      return a + b;
    case '-':
    case '−':
      return a - b;
    case '*':
    case '×':
      return a * b;
    case '/':
    case '÷':
      if (b === 0) throw new Error('Division by zero');
      return a / b;
    default:
      throw new Error(`Unknown operator: ${op}`);
  }
}

/**
 * Resolves a numerical value from an operand descriptor.
 */
export function resolveOperandValue(operand, completedOperations = []) {
  if (!operand) return 0;
  if (operand.type === 'literal' || operand.type === 'token') {
    return operand.value;
  }
  if (operand.type === 'ref') {
    const rawId = operand.opId;
    const strippedId = rawId ? rawId.replace(/^calc_/, '') : '';
    const found = completedOperations.find(op =>
      op.id === rawId ||
      op.id === strippedId ||
      `calc_${op.id}` === rawId ||
      op.result === operand.value
    );
    if (found) {
      return found.result;
    }
    if (typeof operand.value === 'number') {
      return operand.value;
    }
    throw new Error(`Referenced operation not yet completed: ${operand.opId}`);
  }
  if (typeof operand.value === 'number') {
    return operand.value;
  }
  throw new Error(`Unknown operand type: ${JSON.stringify(operand)}`);
}

/**
 * Builds a single dynamic operation definition.
 */
export function createOperationDefinition({
  id,
  stage = 'NORMAL',
  operator,
  operatorTokenIndex,
  leftOperand,
  rightOperand,
  bracketTokenIds = [],
  dependencies = [],
  isInvalid = false,
  reason = '',
  tokens = [],
  sourceTokens = [],
  provenance = []
}) {
  const opToken = tokens[operatorTokenIndex];
  const operatorTokenId = opToken ? opToken.id : null;

  // Compute result for literal operands
  const leftVal = leftOperand.value;
  const rightVal = rightOperand.value;
  let result = null;
  if (typeof leftVal === 'number' && typeof rightVal === 'number') {
    result = applyOp(operator, leftVal, rightVal);
  }

  // Generate dynamic labels with brackets
  const isLeftRef = leftOperand.type === 'ref';
  const isRightRef = rightOperand.type === 'ref';

  let unsolvedLabel = '';
  if (isLeftRef && isRightRef) {
    unsolvedLabel = `(   ) ${operator} (   )`;
  } else if (isLeftRef) {
    unsolvedLabel = `(   ) ${operator} (${rightVal})`;
  } else if (isRightRef) {
    unsolvedLabel = `(${leftVal}) ${operator} (   )`;
  } else {
    unsolvedLabel = `${leftVal} ${operator} ${rightVal}`;
  }

  const stationLabel = (typeof leftVal === 'number' && typeof rightVal === 'number')
    ? `${leftVal} ${operator} ${rightVal}`
    : unsolvedLabel;

  return {
    id,
    stage,
    operator,
    operatorTokenIndex,
    operatorTokenId,
    leftOperand,
    rightOperand,
    bracketTokenIds,
    result,
    dependencies,
    isInvalid,
    reason,
    stationLabel,
    unsolvedLabel,
    stationType: 'bracket',
    sourceTokens,
    provenance
  };
}

/**
 * Builds a complete expression model with tokens, operations, provenance, and routes.
 */
export function buildExpressionModel({
  id,
  display,
  targetResult,
  description = '',
  operationsConfig = [],
  validRoutes = [],
  invalidRoutes = []
}) {
  const tokens = parseExpressionTokens(display);

  const operations = {};
  for (const cfg of operationsConfig) {
    // Resolve token IDs for operands if token indices provided
    const leftOp = { ...cfg.leftOperand };
    if (leftOp.type === 'literal' && typeof leftOp.tokenIndex === 'number' && tokens[leftOp.tokenIndex]) {
      leftOp.tokenId = tokens[leftOp.tokenIndex].id;
      leftOp.value = tokens[leftOp.tokenIndex].value;
    }

    const rightOp = { ...cfg.rightOperand };
    if (rightOp.type === 'literal' && typeof rightOp.tokenIndex === 'number' && tokens[rightOp.tokenIndex]) {
      rightOp.tokenId = tokens[rightOp.tokenIndex].id;
      rightOp.value = tokens[rightOp.tokenIndex].value;
    }

    const opDef = createOperationDefinition({
      ...cfg,
      tokens,
      leftOperand: leftOp,
      rightOperand: rightOp
    });

    operations[opDef.id] = opDef;
  }

  // Precompute provenance and static results for all operations
  for (const opId of Object.keys(operations)) {
    const op = operations[opId];
    op.provenance = computeOperationProvenance(op, operations, tokens);

    // If result was not computed yet (because of refs), compute statically
    if (op.result === null) {
      function getStaticVal(operand) {
        if (operand.type === 'literal' || operand.type === 'token') return operand.value;
        if (operand.type === 'ref') {
          const refOp = operations[operand.opId];
          return getStaticVal(refOp.leftOperand) !== null && getStaticVal(refOp.rightOperand) !== null
            ? applyOp(refOp.operator, getStaticVal(refOp.leftOperand), getStaticVal(refOp.rightOperand))
            : null;
        }
        return null;
      }
      const l = getStaticVal(op.leftOperand);
      const r = getStaticVal(op.rightOperand);
      if (l !== null && r !== null) {
        op.result = applyOp(op.operator, l, r);
        if (op.stationLabel.includes('(   )')) {
          op.stationLabel = `${l} ${op.operator} ${r}`;
        }
      }
    }
  }

  return {
    id,
    display,
    targetResult,
    description,
    tokens,
    operations,
    validRoutes,
    invalidRoutes
  };
}
