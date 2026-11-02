/**
 * pipeline.js
 * 
 * End-to-End Pipeline:
 * Expression String -> AST -> Dependency Graph -> Value Store & State Graph
 * -> Dynamic Maze Topology -> Automated Connectivity Validation.
 * 
 * Central Invariant:
 * The mathematics determines the maze; the maze never determines the mathematics.
 * Mini-expression stations are placed only on corridor transitions where their
 * operand dependencies have been satisfied.
 */

import { parseExpressionAST } from './astParser.js';
import { buildDependencyGraph } from './dependencyGraph.js';
import { generateStateGraph } from './stateGraph.js';
import { generateMazeFromStateGraph } from './mazeTopology.js';
import { validateMazeConnectivity } from './mazeValidator.js';
import { buildExpressionModel } from './stationGenerator.js';
import { enumerateRouteCandidates, selectMazeRoutes } from './routeCandidateEngine.js';
import { generateRandomStaticMaze } from './staticMazeGenerator.js';

export function runExpressionMazePipeline(exprStr, customPreset = null, options = {}) {
  // 1. AST Parser
  const astResult = parseExpressionAST(exprStr);

  // 2. Operation Dependency Graph
  const depGraph = buildDependencyGraph(astResult);

  // 3. Precomputed Mathematical Route Enumeration & Selection (Part 2 & 3)
  const candidateResult = enumerateRouteCandidates(astResult);
  const selectedRoutesData = selectMazeRoutes(candidateResult, {
    maxValidRoutes: options.maxValidRoutes || 3,
    maxInvalidRoutes: options.maxInvalidRoutes !== undefined ? options.maxInvalidRoutes : 2
  });

  // 4. Dynamic Expression Model
  // Gather all operations from depGraph, traps, and all selected route steps
  const opMap = new Map();

  for (const op of [...Object.values(depGraph.operations), ...Object.values(depGraph.trapOperations || {})]) {
    opMap.set(op.id, {
      id: op.id,
      stage: op.isTrap ? 'INVALID' : (op.stage || 'MD'),
      operator: op.operator,
      operatorTokenId: op.operatorTokenId,
      operatorTokenIndex: op.operatorTokenIndex,
      leftOperand: op.leftOperand,
      rightOperand: op.rightOperand,
      bracketTokenIds: op.bracketTokenIds || [],
      dependencies: op.dependencies || [],
      result: op.result,
      isInvalid: Boolean(op.isTrap),
      reason: op.reason,
      sourceTokens: op.sourceTokens,
      provenance: op.provenance
    });
  }

  // Also include operations defined in selectedRoutesData
  if (selectedRoutesData && selectedRoutesData.allSelectedRoutes) {
    for (const route of selectedRoutesData.allSelectedRoutes) {
      for (const step of route.steps) {
        if (!opMap.has(step.operationId)) {
          const isLeftCalc = step.leftOperandType === 'calculated' || (typeof step.unsolvedLabel === 'string' && step.unsolvedLabel.startsWith('(   )'));
          const isRightCalc = step.rightOperandType === 'calculated' || (typeof step.unsolvedLabel === 'string' && step.unsolvedLabel.endsWith('(   )'));
          opMap.set(step.operationId, {
            id: step.operationId,
            stage: route.classification === 'invalid' ? 'INVALID' : 'NORMAL',
            operator: step.operator,
            operatorTokenId: null,
            operatorTokenIndex: 0,
            leftOperand: {
              type: isLeftCalc ? 'ref' : 'token',
              value: step.leftOperand,
              id: !isLeftCalc ? step.leftOperandId : undefined,
              opId: isLeftCalc ? step.leftOperandId : undefined
            },
            rightOperand: {
              type: isRightCalc ? 'ref' : 'token',
              value: step.rightOperand,
              id: !isRightCalc ? step.rightOperandId : undefined,
              opId: isRightCalc ? step.rightOperandId : undefined
            },
            bracketTokenIds: [],
            dependencies: [],
            result: step.result,
            isInvalid: route.classification === 'invalid',
            reason: route.invalidReason || '',
            sourceTokens: step.provenance,
            provenance: step.provenance,
            stationLabel: step.stationLabel,
            unsolvedLabel: step.unsolvedLabel
          });
        }
      }
    }
  }

  const operationsConfig = Array.from(opMap.values());

  const exprModel = buildExpressionModel({
    id: customPreset && customPreset.id ? customPreset.id : `expr_${Date.now()}`,
    display: astResult.normalized,
    targetResult: depGraph.targetResult,
    description: customPreset && customPreset.description ? customPreset.description : 'Dynamic mathematical challenge',
    operationsConfig,
    validRoutes: selectedRoutesData.selectedValid.map(r => ({
      id: r.routeId,
      name: r.steps.map(s => s.stationLabel).join(' → '),
      sequence: r.steps.map(s => s.operationId)
    })),
    invalidRoutes: selectedRoutesData.selectedInvalid.map(r => ({
      id: r.routeId,
      name: r.steps.map(s => s.stationLabel).join(' → '),
      sequence: r.steps.map(s => s.operationId),
      finalWallReason: r.invalidReason
    }))
  });

  // 5. Game State Graph (DAG) with Merged Canonical States
  const stateGraph = generateStateGraph(depGraph, exprModel);

  // 6. Generate Static Random Maze Embedding Selected Routes (Part 4 & 5)
  // If options.useDynamicGraphMaze is requested, uses generateMazeFromStateGraph;
  // default is the new random static maze architecture.
  let mazeGrid;
  if (options.useDynamicGraphMaze) {
    mazeGrid = generateMazeFromStateGraph(stateGraph, exprModel);
  } else {
    mazeGrid = generateRandomStaticMaze(selectedRoutesData, { seed: options.seed });
    mazeGrid.stateGraph = stateGraph;
    mazeGrid.expressionModel = exprModel;
  }

  // 7. Automated Logical & Physical Validation
  const validation = validateMazeConnectivity(mazeGrid, stateGraph);

  return {
    exprStr,
    astResult,
    depGraph,
    stateGraph,
    selectedRoutesData,
    mazeGrid,
    validation,
    targetResult: depGraph.targetResult
  };
}
