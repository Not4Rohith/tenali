/**
 * dependencyGraph.js
 * 
 * Traverses an expression AST to build the Operation Dependency Graph (DAG).
 * Determines operand dependencies, source tokens, and execution precedence.
 * Also derives educational trap operations (e.g. addition before multiplication).
 */

import { applyOp } from './stationGenerator.js';

export function buildDependencyGraph(astResult) {
  const { ast, tokens, raw } = astResult;
  const operations = {};
  const operationList = [];
  let opIndex = 0;

  function traverse(node) {
    if (node.type === 'Number') {
      return {
        type: 'token',
        id: node.token.id,
        value: node.value,
        sourceTokens: [node.token.id]
      };
    }

    if (node.type === 'BinaryOp') {
      const leftDesc = traverse(node.left);
      const rightDesc = traverse(node.right);

      opIndex++;
      const opId = `op_${opIndex}`;

      const dependencies = [];
      if (leftDesc.type === 'ref') {
        dependencies.push(leftDesc.opId);
      }
      if (rightDesc.type === 'ref') {
        dependencies.push(rightDesc.opId);
      }

      const leftVal = leftDesc.value;
      const rightVal = rightDesc.value;
      const result = applyOp(node.operator, leftVal, rightVal);

      // Bracket token IDs if any
      const bracketTokenIds = (node.bracketTokens || []).map(t => t.id);

      const sourceTokens = [
        ...bracketTokenIds,
        ...leftDesc.sourceTokens,
        node.operatorToken.id,
        ...rightDesc.sourceTokens
      ];

      // Build labels
      const isLeftRef = leftDesc.type === 'ref';
      const isRightRef = rightDesc.type === 'ref';
      let unsolvedLabel = '';
      if (isLeftRef && isRightRef) {
        unsolvedLabel = `(   ) ${node.operator} (   )`;
      } else if (isLeftRef) {
        unsolvedLabel = `(   ) ${node.operator} (${rightVal})`;
      } else if (isRightRef) {
        unsolvedLabel = `(${leftVal}) ${node.operator} (   )`;
      } else {
        unsolvedLabel = `${leftVal} ${node.operator} ${rightVal}`;
      }

      const stationLabel = `${leftVal} ${node.operator} ${rightVal}`;

      const opDef = {
        id: opId,
        operator: node.operator,
        operatorTokenId: node.operatorToken.id,
        operatorTokenIndex: node.operatorToken.index,
        leftOperand: leftDesc,
        rightOperand: rightDesc,
        dependencies,
        bracketTokenIds,
        sourceTokens: Array.from(new Set(sourceTokens)),
        provenance: Array.from(new Set(sourceTokens)),
        result,
        stationLabel,
        unsolvedLabel,
        isRoot: false
      };

      operations[opId] = opDef;
      operationList.push(opDef);

      return {
        type: 'ref',
        opId,
        value: result,
        sourceTokens: opDef.sourceTokens
      };
    }

    throw new Error(`Unknown AST node type: ${node.type}`);
  }

  const rootDesc = traverse(ast);
  if (rootDesc.type === 'ref' && operations[rootDesc.opId]) {
    operations[rootDesc.opId].isRoot = true;
  }

  // Derive potential educational trap operations (left-to-right precedence violations)
  const trapOperations = findTrapOperations(tokens, operations);

  return {
    raw,
    tokens,
    operations,
    operationList,
    trapOperations,
    targetResult: rootDesc.value
  };
}

/**
 * Identifies premature left-to-right operations that violate BODMAS precedence
 * to create educational dead-end branches.
 */
function findTrapOperations(tokens, validOperations) {
  const traps = {};

  // Check for adjacent Number -> '+' or '−' -> Number where the second number is followed by '×' or '÷'
  for (let i = 0; i < tokens.length - 4; i++) {
    const t0 = tokens[i];
    const t1 = tokens[i + 1];
    const t2 = tokens[i + 2];
    const t3 = tokens[i + 3];
    const t4 = tokens[i + 4];

    if (
      t0.type === 'number' &&
      t1.type === 'operator' && (t1.text === '+' || t1.text === '−') &&
      t2.type === 'number' &&
      t3.type === 'operator' && (t3.text === '×' || t3.text === '÷') &&
      t4.type === 'number'
    ) {
      // Found premature addition/subtraction! e.g. 3 + 5 before 5 × 3
      const trap1Id = 'trap_premature_add';
      const trap1Result = applyOp(t1.text, t0.value, t2.value);
      traps[trap1Id] = {
        id: trap1Id,
        isTrap: true,
        operator: t1.text,
        operatorTokenId: t1.id,
        operatorTokenIndex: t1.index,
        leftOperand: { type: 'token', id: t0.id, value: t0.value, sourceTokens: [t0.id] },
        rightOperand: { type: 'token', id: t2.id, value: t2.value, sourceTokens: [t2.id] },
        dependencies: [],
        sourceTokens: [t0.id, t1.id, t2.id],
        provenance: [t0.id, t1.id, t2.id],
        result: trap1Result,
        stationLabel: `${t0.value} ${t1.text} ${t2.value}`,
        unsolvedLabel: `${t0.value} ${t1.text} ${t2.value}`,
        reason: `Premature ${t1.text === '+' ? 'addition' : 'subtraction'} before multiplication/division.`
      };

      // Following trap step: (result) × t4
      const trap2Id = 'trap_following_mul';
      const trap2Result = applyOp(t3.text, trap1Result, t4.value);
      traps[trap2Id] = {
        id: trap2Id,
        isTrap: true,
        operator: t3.text,
        operatorTokenId: t3.id,
        operatorTokenIndex: t3.index,
        leftOperand: { type: 'ref', opId: trap1Id, value: trap1Result, sourceTokens: traps[trap1Id].sourceTokens },
        rightOperand: { type: 'token', id: t4.id, value: t4.value, sourceTokens: [t4.id] },
        dependencies: [trap1Id],
        sourceTokens: [...traps[trap1Id].sourceTokens, t3.id, t4.id],
        provenance: [...traps[trap1Id].sourceTokens, t3.id, t4.id],
        result: trap2Result,
        stationLabel: `${trap1Result} ${t3.text} ${t4.value}`,
        unsolvedLabel: `(   ) ${t3.text} (${t4.value})`,
        reason: `Wrong calculation order continues down distractor branch.`
      };
      break;
    }
  }

  return traps;
}
