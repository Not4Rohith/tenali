/**
 * Provenance Engine Module
 * 
 * Tracks the originating source expression tokens for every calculation and intermediate value.
 * Operates purely on unique token IDs rather than literal values or string matching.
 * Handles recursion: provenance(A op B) = provenance(A) ∪ {op} ∪ provenance(B).
 */

/**
 * Resolves the array of original token IDs contributing to an operand.
 */
export function resolveOperandProvenance(operand, operations = {}, tokens = []) {
  if (!operand) return [];

  if (operand.sourceTokens && Array.isArray(operand.sourceTokens)) {
    return operand.sourceTokens.filter(Boolean);
  }
  if (operand.provenance && Array.isArray(operand.provenance)) {
    return operand.provenance.filter(Boolean);
  }

  // 1. Literal or direct token reference
  if (operand.type === 'token') {
    const tid = operand.tokenId || operand.id;
    return tid ? [tid] : [];
  }
  if (operand.type === 'literal') {
    const tid = operand.tokenId || operand.id;
    if (tid) {
      return [tid];
    }
    if (typeof operand.tokenIndex === 'number' && tokens[operand.tokenIndex]) {
      return [tokens[operand.tokenIndex].id];
    }
  }

  // 2. Reference to an intermediate operation
  if (operand.type === 'ref') {
    const refOp = operations[operand.opId];
    if (refOp) {
      return computeOperationProvenance(refOp, operations, tokens);
    }
  }

  return [];
}

/**
 * Computes the full provenance (set of original token IDs) for an operation.
 */
export function computeOperationProvenance(op, operations = {}, tokens = []) {
  if (!op) return [];

  if (op.provenance && Array.isArray(op.provenance) && op.provenance.length > 0 && !op.provenance.includes(undefined)) {
    return op.provenance;
  }

  const leftTokens = resolveOperandProvenance(op.leftOperand, operations, tokens);
  const rightTokens = resolveOperandProvenance(op.rightOperand, operations, tokens);

  let opTokenIds = [];
  if (op.operatorTokenId) {
    opTokenIds = [op.operatorTokenId];
  } else if (typeof op.operatorTokenIndex === 'number' && tokens[op.operatorTokenIndex]) {
    opTokenIds = [tokens[op.operatorTokenIndex].id];
  }

  // Include enclosing bracket tokens if this operation corresponds to a bracketed term
  let bracketTokenIds = [];
  if (op.bracketTokenIds && Array.isArray(op.bracketTokenIds)) {
    bracketTokenIds = op.bracketTokenIds;
  }

  const combined = new Set([
    ...bracketTokenIds,
    ...leftTokens,
    ...opTokenIds,
    ...rightTokens
  ].filter(Boolean));

  // Sort by token index for deterministic ordering
  const tokenIndexMap = new Map();
  tokens.forEach((t, i) => tokenIndexMap.set(t.id, i));

  return Array.from(combined).sort((a, b) => {
    const idxA = tokenIndexMap.has(a) ? tokenIndexMap.get(a) : 999;
    const idxB = tokenIndexMap.has(b) ? tokenIndexMap.get(b) : 999;
    return idxA - idxB;
  });
}

/**
 * Gets the provenance token IDs for an operation in a given expression object.
 */
export function getOperationProvenance(expression, opId) {
  if (opId && typeof opId === 'object') {
    if (opId.provenance && opId.provenance.length > 0) return opId.provenance;
    if (opId.sourceTokens && opId.sourceTokens.length > 0) return opId.sourceTokens;
  }
  if (!expression || !expression.operations) return [];
  const op = expression.operations[opId];
  if (!op) return [];

  const tokens = expression.tokens || [];
  return computeOperationProvenance(op, expression.operations, tokens);
}
