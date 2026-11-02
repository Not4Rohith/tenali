/**
 * routeCandidateEngine.js
 * 
 * Part 2 & Part 3 of New Architecture:
 * Precomputes Complete Mathematical Traversals before physical maze generation.
 * 
 * Functions:
 * 1. enumerateRouteCandidates(exprInput):
 *    - Parses expression into AST & ordered sequence
 *    - Explores all complete evaluation sequences (valid BODMAS and alternative parenthesizations)
 *    - Compares each complete reduction tree against standard AST
 *    - Builds rich route candidate objects with steps, expressionBefore/After, operands, result, provenance
 * 2. selectMazeRoutes(allCandidates, options):
 *    - Selects 2-3 distinct complete valid routes to the goal
 *    - Selects diverse, complete invalid routes (prioritizing distinct first operations, precedence errors, integer results)
 *    - Limits route count to match physical maze capacity
 */

import { parseExpressionAST } from './astParser.js';
import { buildDependencyGraph } from './dependencyGraph.js';
import {
  createExpressionSequence,
  getAllPossibleMoves,
  executeReduction,
  formatSequence,
  validateTreeAgainstAST
} from './reductionEngine.js';

/**
 * Enumerates all complete reduction paths from an expression.
 */
export function enumerateRouteCandidates(exprInput) {
  const astResult = typeof exprInput === 'string'
    ? parseExpressionAST(exprInput)
    : (exprInput.astResult || parseExpressionAST(exprInput.display || exprInput.raw));

  const standardAST = astResult.ast;
  const depGraph = buildDependencyGraph(astResult);
  const targetResult = depGraph.targetResult;
  const initialSequence = createExpressionSequence(exprInput);
  const initialFormatted = formatSequence(initialSequence);

  const completeRoutes = [];
  let routeCounter = 0;

  // DFS to enumerate all complete evaluation paths
  function explore(curSequence, completedSteps = []) {
    const moves = getAllPossibleMoves(curSequence);

    // If no moves left, expression is reduced to a single value
    if (moves.length === 0) {
      if (curSequence.length === 1 && curSequence[0].type === 'calculated') {
        const finalNode = curSequence[0];
        const finalResult = finalNode.value;

        // Discard mathematically undefined or non-finite results
        if (typeof finalResult !== 'number' || !Number.isFinite(finalResult)) {
          return;
        }

        routeCounter++;
        const routeId = `route_${routeCounter}`;

        // Validate tree against standard AST
        const isBODMASValid = validateTreeAgainstAST(finalNode.tree, standardAST, true);
        const isNumericallyCorrect = finalResult === targetResult;

        // Check if any step was a premature addition/subtraction
        const hasPrecedenceViolation = completedSteps.some(step => step.isPrecedenceViolation);
        const classification = (isBODMASValid && isNumericallyCorrect && !hasPrecedenceViolation)
          ? 'valid'
          : 'invalid';

        let invalidReason = null;
        if (classification === 'invalid') {
          if (hasPrecedenceViolation) {
            invalidReason = 'Calculation order violated standard BODMAS precedence.';
          } else if (!isBODMASValid) {
            invalidReason = 'Expression grouping did not follow standard BODMAS rules.';
          } else if (!isNumericallyCorrect) {
            invalidReason = `Final result is ${finalResult} instead of ${targetResult}.`;
          } else {
            invalidReason = 'Incorrect calculation sequence.';
          }
        }

        completeRoutes.push({
          routeId,
          classification,
          steps: [...completedSteps],
          finalResult,
          targetResult,
          isComplete: true,
          invalidReason,
          initialExpression: initialFormatted,
          finalExpression: String(finalResult)
        });
      }
      return;
    }

    for (const move of moves) {
      const exprBefore = formatSequence(curSequence);
      const { nextSequence, calculatedNode, formatted: exprAfter } = executeReduction(curSequence, move);

      // Check if this move was a precedence violation (e.g. + or − when competing × or ÷ on same operands)
      let isPrecedenceViolation = false;
      if (move.operatorSymbol === '+' || move.operatorSymbol === '−') {
        const hasCompetingMulDiv = moves.some(otherMove =>
          (otherMove.operatorSymbol === '×' || otherMove.operatorSymbol === '÷') &&
          (otherMove.leftOperand.id === move.rightOperand.id || otherMove.rightOperand.id === move.leftOperand.id)
        );
        if (hasCompetingMulDiv) {
          isPrecedenceViolation = true;
        }
      }

      const step = {
        operationId: move.id,
        expressionBefore: exprBefore,
        leftOperand: move.leftOperand.value,
        leftOperandType: move.leftOperand.type,
        leftOperandId: move.leftOperand.id,
        operator: move.operatorSymbol,
        rightOperand: move.rightOperand.value,
        rightOperandType: move.rightOperand.type,
        rightOperandId: move.rightOperand.id,
        result: move.result,
        expressionAfter: exprAfter,
        stationLabel: move.stationLabel,
        unsolvedLabel: move.unsolvedLabel,
        provenance: move.provenance,
        isPrecedenceViolation
      };

      explore(nextSequence, [...completedSteps, step]);
    }
  }

  explore(initialSequence, []);

  // Deduplicate routes that have identical step sequences
  const uniqueRoutes = [];
  const seenSignatures = new Set();

  for (const r of completeRoutes) {
    const signature = `${r.classification}:${r.steps.map(s => s.stationLabel).join('->')}`;
    if (!seenSignatures.has(signature)) {
      seenSignatures.add(signature);
      uniqueRoutes.push(r);
    }
  }

  return {
    routes: uniqueRoutes,
    targetResult,
    standardAST,
    initialFormatted,
    validRoutes: uniqueRoutes.filter(r => r.classification === 'valid'),
    invalidRoutes: uniqueRoutes.filter(r => r.classification === 'invalid')
  };
}

/**
 * Part 3: Select a limited number of complete routes to fit into the maze.
 * - Target: 2-3 distinct valid complete routes to the goal.
 * - Target: Diverse invalid routes covering distinct first calculations, integer results, precedence errors.
 */
export function selectMazeRoutes(candidateResult, options = {}) {
  const {
    maxValidRoutes = 3,
    maxInvalidRoutes = 3
  } = options;

  const { validRoutes, invalidRoutes, targetResult, initialFormatted } = candidateResult;

  // 1. Select up to maxValidRoutes (2-3) distinct valid sequences
  // Prioritize sequences that complete higher-precedence operations (× and ÷) together
  const prioritizedValid = [...validRoutes].sort((a, b) => {
    const countMulDivA = a.steps.slice(0, 2).filter(s => s.operator === '×' || s.operator === '÷').length;
    const countMulDivB = b.steps.slice(0, 2).filter(s => s.operator === '×' || s.operator === '÷').length;
    return countMulDivB - countMulDivA;
  });

  const selectedValid = [];
  for (const vr of prioritizedValid) {
    if (selectedValid.length >= maxValidRoutes) break;
    // Ensure distinct sequence
    const alreadySelected = selectedValid.some(s =>
      s.steps.map(st => st.stationLabel).join('->') === vr.steps.map(st => st.stationLabel).join('->')
    );
    if (!alreadySelected) {
      selectedValid.push(vr);
    }
  }

  // 2. Select diverse invalid complete routes
  // Prioritize:
  // a) Different first operations
  // b) Integer results over fractions
  // c) Clear, pedagogical errors (e.g. 3 + 5 premature addition)
  const selectedInvalid = [];
  const coveredFirstOps = new Set();

  // First pass: distinct first operations with integer results
  for (const ir of invalidRoutes) {
    if (selectedInvalid.length >= maxInvalidRoutes) break;
    const firstOp = ir.steps[0] ? ir.steps[0].stationLabel : '';
    const isInteger = Number.isInteger(ir.finalResult);

    if (isInteger && !coveredFirstOps.has(firstOp)) {
      coveredFirstOps.add(firstOp);
      selectedInvalid.push(ir);
    }
  }

  // Second pass: if slots remain, add more integer-result routes
  if (selectedInvalid.length < maxInvalidRoutes) {
    for (const ir of invalidRoutes) {
      if (selectedInvalid.length >= maxInvalidRoutes) break;
      if (!selectedInvalid.includes(ir) && Number.isInteger(ir.finalResult)) {
        selectedInvalid.push(ir);
      }
    }
  }

  // Final fallback: any valid remaining route
  if (selectedInvalid.length < maxInvalidRoutes) {
    for (const ir of invalidRoutes) {
      if (selectedInvalid.length >= maxInvalidRoutes) break;
      if (!selectedInvalid.includes(ir)) {
        selectedInvalid.push(ir);
      }
    }
  }

  return {
    selectedValid,
    selectedInvalid,
    allSelectedRoutes: [...selectedValid, ...selectedInvalid],
    targetResult,
    initialFormatted,
    totalSelected: selectedValid.length + selectedInvalid.length
  };
}
