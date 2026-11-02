/**
 * Expression Engine for BODMAS Interactive Snake Maze
 * 
 * Modular, expression-agnostic architecture:
 * - Expression Parser (token identities, positions, structure)
 * - Provenance Engine (recursive token inheritance for intermediate results)
 * - Expression Reducer (dynamic step reduction without hardcoded strings)
 * - Highlight Engine (provenance-driven visual segments on static display)
 * - Station Generator (dynamic station labels, bracket formatting, operands)
 */

import { parseExpressionTokens, normalizeOperators } from './expressionParser.js';
import { getOperationProvenance, computeOperationProvenance } from './provenanceEngine.js';
import { getDynamicReductionTrace } from './expressionReducer.js';
import { parseExpressionSegments } from './highlightEngine.js';
import { applyOp, resolveOperandValue, buildExpressionModel } from './stationGenerator.js';

export {
  parseExpressionTokens,
  normalizeOperators,
  getOperationProvenance,
  computeOperationProvenance,
  getDynamicReductionTrace,
  parseExpressionSegments,
  applyOp,
  resolveOperandValue,
  buildExpressionModel
};

export const OPERATORS = {
  ADD: '+',
  SUB: '−',
  MUL: '×',
  DIV: '÷'
};

/**
 * Validates whether an operation's dependencies have been met in the current history
 */
export function canExecuteOperation(op, completedOpIds) {
  if (!op.dependencies || op.dependencies.length === 0) {
    return true;
  }
  return op.dependencies.every(depId => completedOpIds.includes(depId));
}

/**
 * Computes step-by-step reduction trace dynamically
 */
export function getExpressionReductionTrace(expression, executedOpIds) {
  return getDynamicReductionTrace(expression, executedOpIds);
}

/**
 * Curated library of dynamic expressions designed for multi-route BODMAS maze gameplay
 */
export const EXPRESSION_PRESETS = [
  // Preset 0 (Test A): Classic 4-step BODMAS with 2 MD and 2 AS terms
  buildExpressionModel({
    id: 'sample_primary',
    display: '3 + 5 × 3 − 10 ÷ 2',
    targetResult: 13,
    description: 'Classic BODMAS challenge with two independent MD terms and flexible AS terms',
    operationsConfig: [
      {
        id: 'op_mul',
        stage: 'MD',
        operator: '×',
        operatorTokenIndex: 3,
        leftOperand: { type: 'literal', tokenIndex: 2 },
        rightOperand: { type: 'literal', tokenIndex: 4 },
        dependencies: []
      },
      {
        id: 'op_div',
        stage: 'MD',
        operator: '÷',
        operatorTokenIndex: 7,
        leftOperand: { type: 'literal', tokenIndex: 6 },
        rightOperand: { type: 'literal', tokenIndex: 8 },
        dependencies: []
      },
      {
        id: 'op_add_routeA',
        stage: 'AS',
        operator: '+',
        operatorTokenIndex: 1,
        leftOperand: { type: 'literal', tokenIndex: 0 },
        rightOperand: { type: 'ref', opId: 'op_mul' },
        dependencies: ['op_mul']
      },
      {
        id: 'op_sub_routeA',
        stage: 'AS',
        operator: '−',
        operatorTokenIndex: 5,
        leftOperand: { type: 'ref', opId: 'op_add_routeA' },
        rightOperand: { type: 'ref', opId: 'op_div' },
        dependencies: ['op_add_routeA', 'op_div']
      },
      {
        id: 'op_sub_routeB',
        stage: 'AS',
        operator: '−',
        operatorTokenIndex: 5,
        leftOperand: { type: 'ref', opId: 'op_mul' },
        rightOperand: { type: 'ref', opId: 'op_div' },
        dependencies: ['op_mul', 'op_div']
      },
      {
        id: 'op_add_routeB',
        stage: 'AS',
        operator: '+',
        operatorTokenIndex: 1,
        leftOperand: { type: 'literal', tokenIndex: 0 },
        rightOperand: { type: 'ref', opId: 'op_sub_routeB' },
        dependencies: ['op_sub_routeB']
      },
      {
        id: 'op_distractor_add_premature',
        stage: 'INVALID',
        operator: '+',
        operatorTokenIndex: 1,
        leftOperand: { type: 'literal', tokenIndex: 0 },
        rightOperand: { type: 'literal', tokenIndex: 2 },
        isInvalid: true,
        reason: 'Addition was attempted before multiplication (3 + 5 = 8)',
        dependencies: []
      },
      {
        id: 'op_distractor_mul_following',
        stage: 'INVALID',
        operator: '×',
        operatorTokenIndex: 3,
        leftOperand: { type: 'ref', opId: 'op_distractor_add_premature' },
        rightOperand: { type: 'literal', tokenIndex: 4 },
        isInvalid: true,
        dependencies: ['op_distractor_add_premature']
      },
      {
        id: 'op_distractor_sub_following',
        stage: 'INVALID',
        operator: '−',
        operatorTokenIndex: 5,
        leftOperand: { type: 'ref', opId: 'op_distractor_mul_following' },
        rightOperand: { type: 'literal', tokenIndex: 6 },
        isInvalid: true,
        dependencies: ['op_distractor_mul_following']
      },
      {
        id: 'op_distractor_div_terminal',
        stage: 'INVALID',
        operator: '÷',
        operatorTokenIndex: 7,
        leftOperand: { type: 'ref', opId: 'op_distractor_sub_following' },
        rightOperand: { type: 'literal', tokenIndex: 8 },
        isInvalid: true,
        reason: 'Wrong calculation order resulted in 7 instead of 13.',
        dependencies: ['op_distractor_sub_following']
      }
    ],
    validRoutes: [
      {
        id: 'route_mul_div_add_sub',
        name: 'Multiplication first → Division → Addition → Subtraction',
        sequence: ['op_mul', 'op_div', 'op_add_routeA', 'op_sub_routeA']
      },
      {
        id: 'route_div_mul_add_sub',
        name: 'Division first → Multiplication → Addition → Subtraction',
        sequence: ['op_div', 'op_mul', 'op_add_routeA', 'op_sub_routeA']
      },
      {
        id: 'route_mul_div_sub_add',
        name: 'Multiplication first → Division → Subtraction → Addition',
        sequence: ['op_mul', 'op_div', 'op_sub_routeB', 'op_add_routeB']
      },
      {
        id: 'route_div_mul_sub_add',
        name: 'Division first → Multiplication → Subtraction → Addition',
        sequence: ['op_div', 'op_mul', 'op_sub_routeB', 'op_add_routeB']
      }
    ],
    invalidRoutes: [
      {
        id: 'route_invalid_left_to_right',
        name: 'Strict left-to-right error (Addition before Multiplication)',
        sequence: [
          'op_distractor_add_premature',
          'op_distractor_mul_following',
          'op_distractor_sub_following',
          'op_distractor_div_terminal'
        ],
        finalWallReason: 'Addition was performed before multiplication. Under BODMAS, × and ÷ have precedence over + and −.'
      }
    ]
  }),

  // Preset 1: 6 × 4 − 8 ÷ 2 + 5
  buildExpressionModel({
    id: 'preset_two',
    display: '6 × 4 − 8 ÷ 2 + 5',
    targetResult: 25,
    description: 'Precedence with multiple independent terms and commutative addition',
    operationsConfig: [
      {
        id: 'op_mul',
        stage: 'MD',
        operator: '×',
        operatorTokenIndex: 1,
        leftOperand: { type: 'literal', tokenIndex: 0 },
        rightOperand: { type: 'literal', tokenIndex: 2 },
        dependencies: []
      },
      {
        id: 'op_div',
        stage: 'MD',
        operator: '÷',
        operatorTokenIndex: 5,
        leftOperand: { type: 'literal', tokenIndex: 4 },
        rightOperand: { type: 'literal', tokenIndex: 6 },
        dependencies: []
      },
      {
        id: 'op_sub_routeA',
        stage: 'AS',
        operator: '−',
        operatorTokenIndex: 3,
        leftOperand: { type: 'ref', opId: 'op_mul' },
        rightOperand: { type: 'ref', opId: 'op_div' },
        dependencies: ['op_mul', 'op_div']
      },
      {
        id: 'op_add_routeA',
        stage: 'AS',
        operator: '+',
        operatorTokenIndex: 7,
        leftOperand: { type: 'ref', opId: 'op_sub_routeA' },
        rightOperand: { type: 'literal', tokenIndex: 8 },
        dependencies: ['op_sub_routeA']
      },
      {
        id: 'op_add_routeB',
        stage: 'AS',
        operator: '+',
        operatorTokenIndex: 7,
        leftOperand: { type: 'ref', opId: 'op_mul' },
        rightOperand: { type: 'literal', tokenIndex: 8 },
        dependencies: ['op_mul']
      },
      {
        id: 'op_sub_routeB',
        stage: 'AS',
        operator: '−',
        operatorTokenIndex: 3,
        leftOperand: { type: 'ref', opId: 'op_add_routeB' },
        rightOperand: { type: 'ref', opId: 'op_div' },
        dependencies: ['op_add_routeB', 'op_div']
      },
      {
        id: 'op_distractor_sub_premature',
        stage: 'INVALID',
        operator: '−',
        operatorTokenIndex: 3,
        leftOperand: { type: 'literal', tokenIndex: 2 },
        rightOperand: { type: 'literal', tokenIndex: 4 },
        isInvalid: true,
        reason: 'Subtraction attempted before division of (8 ÷ 2)',
        dependencies: ['op_mul']
      },
      {
        id: 'op_distractor_div_late',
        stage: 'INVALID',
        operator: '÷',
        operatorTokenIndex: 5,
        leftOperand: { type: 'ref', opId: 'op_distractor_sub_premature' },
        rightOperand: { type: 'literal', tokenIndex: 6 },
        isInvalid: true,
        dependencies: ['op_distractor_sub_premature']
      },
      {
        id: 'op_distractor_add_terminal',
        stage: 'INVALID',
        operator: '+',
        operatorTokenIndex: 7,
        leftOperand: { type: 'ref', opId: 'op_distractor_div_late' },
        rightOperand: { type: 'literal', tokenIndex: 8 },
        isInvalid: true,
        dependencies: ['op_distractor_div_late']
      }
    ],
    validRoutes: [
      {
        id: 'p2_route_mul_div_sub_add',
        name: 'Multiplication → Division → Subtraction → Addition',
        sequence: ['op_mul', 'op_div', 'op_sub_routeA', 'op_add_routeA']
      },
      {
        id: 'p2_route_div_mul_sub_add',
        name: 'Division → Multiplication → Subtraction → Addition',
        sequence: ['op_div', 'op_mul', 'op_sub_routeA', 'op_add_routeA']
      },
      {
        id: 'p2_route_mul_div_add_sub',
        name: 'Multiplication → Division → Addition → Subtraction',
        sequence: ['op_mul', 'op_div', 'op_add_routeB', 'op_sub_routeB']
      },
      {
        id: 'p2_route_div_mul_add_sub',
        name: 'Division → Multiplication → Addition → Subtraction',
        sequence: ['op_div', 'op_mul', 'op_add_routeB', 'op_sub_routeB']
      }
    ],
    invalidRoutes: [
      {
        id: 'p2_invalid_sub_first',
        name: 'Subtraction before Division Error',
        sequence: ['op_mul', 'op_distractor_sub_premature', 'op_distractor_div_late', 'op_distractor_add_terminal'],
        finalWallReason: 'Subtraction was performed before division (8 ÷ 2 had to be resolved first).'
      }
    ]
  }),

  // Preset 2: 12 ÷ 3 + 4 × 2 − 3
  buildExpressionModel({
    id: 'preset_three',
    display: '12 ÷ 3 + 4 × 2 − 3',
    targetResult: 9,
    description: 'Division leading, with symmetric independent multiplication and alternating addition/subtraction',
    operationsConfig: [
      {
        id: 'op_div',
        stage: 'MD',
        operator: '÷',
        operatorTokenIndex: 1,
        leftOperand: { type: 'literal', tokenIndex: 0 },
        rightOperand: { type: 'literal', tokenIndex: 2 },
        dependencies: []
      },
      {
        id: 'op_mul',
        stage: 'MD',
        operator: '×',
        operatorTokenIndex: 5,
        leftOperand: { type: 'literal', tokenIndex: 4 },
        rightOperand: { type: 'literal', tokenIndex: 6 },
        dependencies: []
      },
      {
        id: 'op_add_routeA',
        stage: 'AS',
        operator: '+',
        operatorTokenIndex: 3,
        leftOperand: { type: 'ref', opId: 'op_div' },
        rightOperand: { type: 'ref', opId: 'op_mul' },
        dependencies: ['op_div', 'op_mul']
      },
      {
        id: 'op_sub_routeA',
        stage: 'AS',
        operator: '−',
        operatorTokenIndex: 7,
        leftOperand: { type: 'ref', opId: 'op_add_routeA' },
        rightOperand: { type: 'literal', tokenIndex: 8 },
        dependencies: ['op_add_routeA']
      },
      {
        id: 'op_sub_routeB',
        stage: 'AS',
        operator: '−',
        operatorTokenIndex: 7,
        leftOperand: { type: 'ref', opId: 'op_mul' },
        rightOperand: { type: 'literal', tokenIndex: 8 },
        dependencies: ['op_mul']
      },
      {
        id: 'op_add_routeB',
        stage: 'AS',
        operator: '+',
        operatorTokenIndex: 3,
        leftOperand: { type: 'ref', opId: 'op_div' },
        rightOperand: { type: 'ref', opId: 'op_sub_routeB' },
        dependencies: ['op_div', 'op_sub_routeB']
      },
      {
        id: 'op_distractor_add_premature',
        stage: 'INVALID',
        operator: '+',
        operatorTokenIndex: 3,
        leftOperand: { type: 'literal', tokenIndex: 2 },
        rightOperand: { type: 'literal', tokenIndex: 4 },
        isInvalid: true,
        reason: 'Addition (3 + 4) was attempted across division and multiplication boundaries',
        dependencies: []
      },
      {
        id: 'op_distractor_mul_following',
        stage: 'INVALID',
        operator: '×',
        operatorTokenIndex: 5,
        leftOperand: { type: 'ref', opId: 'op_distractor_add_premature' },
        rightOperand: { type: 'literal', tokenIndex: 6 },
        isInvalid: true,
        dependencies: ['op_distractor_add_premature']
      },
      {
        id: 'op_distractor_sub_following',
        stage: 'INVALID',
        operator: '−',
        operatorTokenIndex: 7,
        leftOperand: { type: 'ref', opId: 'op_distractor_mul_following' },
        rightOperand: { type: 'literal', tokenIndex: 8 },
        isInvalid: true,
        dependencies: ['op_distractor_mul_following']
      }
    ],
    validRoutes: [
      {
        id: 'p3_route_div_mul_add_sub',
        name: 'Division → Multiplication → Addition → Subtraction',
        sequence: ['op_div', 'op_mul', 'op_add_routeA', 'op_sub_routeA']
      },
      {
        id: 'p3_route_mul_div_add_sub',
        name: 'Multiplication → Division → Addition → Subtraction',
        sequence: ['op_mul', 'op_div', 'op_add_routeA', 'op_sub_routeA']
      },
      {
        id: 'p3_route_div_mul_sub_add',
        name: 'Division → Multiplication → Subtraction → Addition',
        sequence: ['op_div', 'op_mul', 'op_sub_routeB', 'op_add_routeB']
      },
      {
        id: 'p3_route_mul_div_sub_add',
        name: 'Multiplication → Division → Subtraction → Addition',
        sequence: ['op_mul', 'op_div', 'op_sub_routeB', 'op_add_routeB']
      }
    ],
    invalidRoutes: [
      {
        id: 'p3_invalid_add_first',
        name: 'Addition before Division Error',
        sequence: ['op_distractor_add_premature', 'op_distractor_mul_following', 'op_distractor_sub_following'],
        finalWallReason: 'Addition was performed before division and multiplication were completed.'
      }
    ]
  }),

  // Preset 3 (Test B): 8 + 4 × 2 (Multiplication precedence with direct addition)
  buildExpressionModel({
    id: 'test_b_multiplication_precedence',
    display: '8 + 4 × 2',
    targetResult: 16,
    description: 'Multiplication precedence with leading addition term',
    operationsConfig: [
      {
        id: 'op_mul',
        stage: 'MD',
        operator: '×',
        operatorTokenIndex: 3,
        leftOperand: { type: 'literal', tokenIndex: 2 },
        rightOperand: { type: 'literal', tokenIndex: 4 },
        dependencies: []
      },
      {
        id: 'op_add',
        stage: 'AS',
        operator: '+',
        operatorTokenIndex: 1,
        leftOperand: { type: 'literal', tokenIndex: 0 },
        rightOperand: { type: 'ref', opId: 'op_mul' },
        dependencies: ['op_mul']
      },
      {
        id: 'op_distractor_add_premature',
        stage: 'INVALID',
        operator: '+',
        operatorTokenIndex: 1,
        leftOperand: { type: 'literal', tokenIndex: 0 },
        rightOperand: { type: 'literal', tokenIndex: 2 },
        isInvalid: true,
        reason: 'Addition (8 + 4) performed before multiplication (4 × 2)',
        dependencies: []
      },
      {
        id: 'op_distractor_mul_following',
        stage: 'INVALID',
        operator: '×',
        operatorTokenIndex: 3,
        leftOperand: { type: 'ref', opId: 'op_distractor_add_premature' },
        rightOperand: { type: 'literal', tokenIndex: 4 },
        isInvalid: true,
        dependencies: ['op_distractor_add_premature']
      }
    ],
    validRoutes: [
      {
        id: 'tb_valid',
        name: 'Multiplication → Addition',
        sequence: ['op_mul', 'op_add']
      }
    ],
    invalidRoutes: [
      {
        id: 'tb_invalid',
        name: 'Addition first error',
        sequence: ['op_distractor_add_premature', 'op_distractor_mul_following'],
        finalWallReason: 'Addition was performed before multiplication.'
      }
    ]
  }),

  // Preset 4 (Test C): 20 ÷ 5 + 3 × 4 (Two independent operations combined)
  buildExpressionModel({
    id: 'test_c_independent_md',
    display: '20 ÷ 5 + 3 × 4',
    targetResult: 16,
    description: 'Division and multiplication evaluated independently then added',
    operationsConfig: [
      {
        id: 'op_div',
        stage: 'MD',
        operator: '÷',
        operatorTokenIndex: 1,
        leftOperand: { type: 'literal', tokenIndex: 0 },
        rightOperand: { type: 'literal', tokenIndex: 2 },
        dependencies: []
      },
      {
        id: 'op_mul',
        stage: 'MD',
        operator: '×',
        operatorTokenIndex: 5,
        leftOperand: { type: 'literal', tokenIndex: 4 },
        rightOperand: { type: 'literal', tokenIndex: 6 },
        dependencies: []
      },
      {
        id: 'op_add',
        stage: 'AS',
        operator: '+',
        operatorTokenIndex: 3,
        leftOperand: { type: 'ref', opId: 'op_div' },
        rightOperand: { type: 'ref', opId: 'op_mul' },
        dependencies: ['op_div', 'op_mul']
      },
      {
        id: 'op_distractor_add_premature',
        stage: 'INVALID',
        operator: '+',
        operatorTokenIndex: 3,
        leftOperand: { type: 'literal', tokenIndex: 2 },
        rightOperand: { type: 'literal', tokenIndex: 4 },
        isInvalid: true,
        reason: 'Addition (5 + 3) across division and multiplication boundaries',
        dependencies: []
      }
    ],
    validRoutes: [
      {
        id: 'tc_div_mul_add',
        name: 'Division → Multiplication → Addition',
        sequence: ['op_div', 'op_mul', 'op_add']
      },
      {
        id: 'tc_mul_div_add',
        name: 'Multiplication → Division → Addition',
        sequence: ['op_mul', 'op_div', 'op_add']
      }
    ],
    invalidRoutes: [
      {
        id: 'tc_invalid',
        name: 'Premature addition error',
        sequence: ['op_distractor_add_premature'],
        finalWallReason: 'Addition was attempted before division and multiplication.'
      }
    ]
  }),

  // Preset 5 (Test D): (6 + 2) × 3 − 4 (Brackets override standard precedence)
  buildExpressionModel({
    id: 'test_d_brackets_override',
    display: '(6 + 2) × 3 − 4',
    targetResult: 20,
    description: 'Brackets evaluated first, followed by multiplication and subtraction',
    operationsConfig: [
      {
        id: 'op_bracket_add',
        stage: 'BRACKETS',
        operator: '+',
        operatorTokenIndex: 2,
        leftOperand: { type: 'literal', tokenIndex: 1 },
        rightOperand: { type: 'literal', tokenIndex: 3 },
        bracketTokenIds: ['t_0', 't_4'],
        dependencies: []
      },
      {
        id: 'op_mul',
        stage: 'MD',
        operator: '×',
        operatorTokenIndex: 5,
        leftOperand: { type: 'ref', opId: 'op_bracket_add' },
        rightOperand: { type: 'literal', tokenIndex: 6 },
        dependencies: ['op_bracket_add']
      },
      {
        id: 'op_sub',
        stage: 'AS',
        operator: '−',
        operatorTokenIndex: 7,
        leftOperand: { type: 'ref', opId: 'op_mul' },
        rightOperand: { type: 'literal', tokenIndex: 8 },
        dependencies: ['op_mul']
      },
      {
        id: 'op_distractor_mul_premature',
        stage: 'INVALID',
        operator: '×',
        operatorTokenIndex: 5,
        leftOperand: { type: 'literal', tokenIndex: 3 },
        rightOperand: { type: 'literal', tokenIndex: 6 },
        isInvalid: true,
        reason: 'Multiplication was attempted ignoring the brackets (2 × 3)',
        dependencies: []
      }
    ],
    validRoutes: [
      {
        id: 'td_valid',
        name: 'Brackets → Multiplication → Subtraction',
        sequence: ['op_bracket_add', 'op_mul', 'op_sub']
      }
    ],
    invalidRoutes: [
      {
        id: 'td_invalid',
        name: 'Bracket ignored error',
        sequence: ['op_distractor_mul_premature'],
        finalWallReason: 'Brackets must always be calculated first.'
      }
    ]
  }),

  // Preset 6 (Test E): 5 + 5 × 5 − 5 (Repeated numbers with distinct token provenance)
  buildExpressionModel({
    id: 'test_e_repeated_numbers',
    display: '5 + 5 × 5 − 5',
    targetResult: 25,
    description: 'Repeated numbers verifying unique token identity and provenance highlighting',
    operationsConfig: [
      {
        id: 'op_mul',
        stage: 'MD',
        operator: '×',
        operatorTokenIndex: 3,
        leftOperand: { type: 'literal', tokenIndex: 2 },
        rightOperand: { type: 'literal', tokenIndex: 4 },
        dependencies: []
      },
      {
        id: 'op_add',
        stage: 'AS',
        operator: '+',
        operatorTokenIndex: 1,
        leftOperand: { type: 'literal', tokenIndex: 0 },
        rightOperand: { type: 'ref', opId: 'op_mul' },
        dependencies: ['op_mul']
      },
      {
        id: 'op_sub',
        stage: 'AS',
        operator: '−',
        operatorTokenIndex: 5,
        leftOperand: { type: 'ref', opId: 'op_add' },
        rightOperand: { type: 'literal', tokenIndex: 6 },
        dependencies: ['op_add']
      },
      {
        id: 'op_distractor_add_premature',
        stage: 'INVALID',
        operator: '+',
        operatorTokenIndex: 1,
        leftOperand: { type: 'literal', tokenIndex: 0 },
        rightOperand: { type: 'literal', tokenIndex: 2 },
        isInvalid: true,
        reason: 'Addition performed before multiplication (5 + 5 = 10)',
        dependencies: []
      },
      {
        id: 'op_distractor_mul_following',
        stage: 'INVALID',
        operator: '×',
        operatorTokenIndex: 3,
        leftOperand: { type: 'ref', opId: 'op_distractor_add_premature' },
        rightOperand: { type: 'literal', tokenIndex: 4 },
        isInvalid: true,
        dependencies: ['op_distractor_add_premature']
      },
      {
        id: 'op_distractor_sub_terminal',
        stage: 'INVALID',
        operator: '−',
        operatorTokenIndex: 5,
        leftOperand: { type: 'ref', opId: 'op_distractor_mul_following' },
        rightOperand: { type: 'literal', tokenIndex: 6 },
        isInvalid: true,
        dependencies: ['op_distractor_mul_following']
      }
    ],
    validRoutes: [
      {
        id: 'te_valid',
        name: 'Multiplication → Addition → Subtraction',
        sequence: ['op_mul', 'op_add', 'op_sub']
      }
    ],
    invalidRoutes: [
      {
        id: 'te_invalid',
        name: 'Addition first error',
        sequence: [
          'op_distractor_add_premature',
          'op_distractor_mul_following',
          'op_distractor_sub_terminal'
        ],
        finalWallReason: 'Addition was performed before multiplication.'
      }
    ]
  })
];

/**
 * Determines which operand values must be present in the snake's mouth for a station to evaluate.
 * Brackets (   ) represent intermediate results carried by the snake.
 */
export function getStationRequiredOperands(station, expression) {
  if (!station) return [];
  const op = station.operation || (expression?.operations ? expression.operations[station.opId] : null);
  const unsolved = station.unsolvedLabel || op?.unsolvedLabel || '';
  const label = station.label || op?.stationLabel || '';

  const required = [];

  let fallbackLeft = null;
  let fallbackRight = null;
  if (typeof label === 'string' && label.includes(' ')) {
    const parts = label.trim().split(/\s+/);
    if (parts.length >= 3) {
      const parsedL = parseFloat(parts[0]);
      const parsedR = parseFloat(parts[parts.length - 1]);
      if (!Number.isNaN(parsedL)) fallbackLeft = parsedL;
      if (!Number.isNaN(parsedR)) fallbackRight = parsedR;
    }
  }

  // Left operand check
  const leftType = op?.leftOperand?.type;
  const isLeftRef = leftType === 'ref' || leftType === 'calculated' || (typeof unsolved === 'string' && unsolved.startsWith('(   )'));
  if (isLeftRef) {
    const val = op?.leftOperand?.value ?? station.leftOperand ?? fallbackLeft;
    if (val !== null && val !== undefined) {
      required.push({
        side: 'left',
        value: val,
        sourceOpId: op?.leftOperand?.opId
      });
    }
  }

  // Right operand check
  const rightType = op?.rightOperand?.type;
  const isRightRef = rightType === 'ref' || rightType === 'calculated' || (typeof unsolved === 'string' && unsolved.endsWith('(   )'));
  if (isRightRef) {
    const val = op?.rightOperand?.value ?? station.rightOperand ?? fallbackRight;
    if (val !== null && val !== undefined) {
      required.push({
        side: 'right',
        value: val,
        sourceOpId: op?.rightOperand?.opId
      });
    }
  }

  return required;
}

/**
 * Validates whether the snake currently carries all required operand values in its mouth
 * to evaluate a given station.
 */
export function canExecuteStationWithSnake(station, carriedValues = [], expression) {
  const required = getStationRequiredOperands(station, expression);
  if (required.length === 0) {
    return { canExecute: true, missing: [], requiredValues: [] };
  }

  const available = [...(carriedValues || [])];
  const missing = [];
  const requiredValues = required.map(r => r.value);

  for (const req of required) {
    const idx = available.findIndex(val => val === req.value);
    if (idx !== -1) {
      available.splice(idx, 1);
    } else {
      missing.push(req.value);
    }
  }

  return {
    canExecute: missing.length === 0,
    missing,
    requiredValues
  };
}

/**
 * Creates an initial calculation state for an expression
 */
export function createInitialCalculationState(expression) {
  return {
    expressionId: expression.id,
    carriedValue: null,
    carriedValues: [],
    finalResult: null,
    isComplete: false,
    pendingTray: [], // array of { id, value, label }
    completedOperations: [], // array of completed op objects with results and provenance
    executedOpIds: [], // sequence of executed operation IDs
    reductionTrace: [expression.display],
    isSequenceValid: true,
    invalidationReasons: []
  };
}

/**
 * Executes a single operation checkpoint and transitions calculation state dynamically
 */
export function executeOperationStep(state, expression, opIdOrOp, currentCarriedValues = null, requiredValues = null) {
  let op = null;
  if (opIdOrOp && typeof opIdOrOp === 'object' && opIdOrOp.operator) {
    op = opIdOrOp;
  } else {
    const opId = opIdOrOp;
    op = expression.operations ? expression.operations[opId] : null;
    if (!op && expression.operationsConfig) {
      op = expression.operationsConfig.find(o => o.id === opId);
    }
    if (!op && expression.operations) {
      const allOps = Object.values(expression.operations);
      if (opId === 'op_1') op = allOps.find(o => o.operator === '×' && !o.isInvalid) || allOps.find(o => o.id === 'op_mul');
      else if (opId === 'op_2') op = allOps.find(o => o.operator === '+' && !o.isInvalid) || allOps.find(o => o.id.includes('add'));
      else if (opId === 'op_3') op = allOps.find(o => o.operator === '÷' && !o.isInvalid) || allOps.find(o => o.id === 'op_div');
      else if (opId === 'op_4') op = allOps.find(o => o.operator === '−' && !o.isInvalid) || allOps.find(o => o.id.includes('sub'));
      else if (opId === 'trap_premature_add') op = allOps.find(o => o.isInvalid && o.operator === '+') || allOps.find(o => o.id.includes('premature'));
      else if (opId === 'trap_following_mul') op = allOps.find(o => o.isInvalid && o.operator === '×');
      else if (opId === 'op_mul') op = allOps.find(o => o.operator === '×' && !o.isInvalid);
      else if (opId === 'op_div') op = allOps.find(o => o.operator === '÷' && !o.isInvalid);
      else if (typeof opId === 'string') op = allOps.find(o => o.id === opId);
    }
  }

  if (!op) {
    throw new Error(`Operation ${typeof opIdOrOp === 'string' ? opIdOrOp : JSON.stringify(opIdOrOp)} does not exist in expression ${expression.id}`);
  }

  const opId = op.id;

  // Prevent duplicate execution
  if (state.executedOpIds.includes(opId)) {
    return state;
  }

  const leftVal = resolveOperandValue(op.leftOperand, state.completedOperations);
  const rightVal = resolveOperandValue(op.rightOperand, state.completedOperations);
  const computedResult = applyOp(op.operator, leftVal, rightVal);
  const provenance = (op.provenance && op.provenance.length > 0)
    ? op.provenance
    : getOperationProvenance(expression, op);

  const isTrapOp = Boolean(
    op.isInvalid ||
    op.isTrap ||
    op.stage === 'INVALID' ||
    (typeof op.id === 'string' && (op.id.includes('trap') || op.id.includes('distractor') || op.id.includes('premature')))
  );

  const newCompletedOps = [
    ...state.completedOperations,
    {
      id: op.id,
      stage: op.stage,
      operator: op.operator,
      leftVal,
      rightVal,
      result: computedResult,
      stationLabel: op.stationLabel,
      stepNumber: state.completedOperations.length + 1,
      equationText: `${leftVal} ${op.operator} ${rightVal} = ${computedResult}`,
      provenance,
      isInvalid: isTrapOp,
      isTrap: isTrapOp
    }
  ];

  const newExecutedIds = [...state.executedOpIds, opId];

  // Check if operation is invalid or prerequisites violated
  let isSequenceValid = state.isSequenceValid;
  const invalidationReasons = [...state.invalidationReasons];

  if (op.isInvalid) {
    isSequenceValid = false;
    if (op.reason) {
      invalidationReasons.push(op.reason);
    }
  }

  // Multi-value Snake Mouth carried values management:
  const activeCarriedValues = currentCarriedValues !== null
    ? [...currentCarriedValues]
    : (state.carriedValues ? [...state.carriedValues] : (state.carriedValue !== null ? [state.carriedValue] : []));

  const toConsume = requiredValues !== null
    ? [...requiredValues]
    : getStationRequiredOperands({ operation: op, unsolvedLabel: op.unsolvedLabel, label: op.stationLabel }, expression).map(r => r.value);

  const newCarriedValues = [...activeCarriedValues];
  for (const reqVal of toConsume) {
    const idx = newCarriedValues.findIndex(v => v === reqVal);
    if (idx !== -1) {
      newCarriedValues.splice(idx, 1);
    }
  }
  newCarriedValues.push(computedResult);

  // Pending Tray Management (legacy support)
  let newPendingTray = [...state.pendingTray];
  const consumedRefIds = [op.leftOperand, op.rightOperand]
    .filter(o => o.type === 'ref')
    .map(o => o.opId);

  newPendingTray = newPendingTray.filter(item => !consumedRefIds.includes(item.id));

  // Determine if all required steps for this branch are finished
  let totalExpectedSteps = 4;
  if (expression.validRoutes && expression.validRoutes[0]) {
    totalExpectedSteps = expression.validRoutes[0].sequence.length;
  }
  const isComplete = newExecutedIds.length >= totalExpectedSteps;
  const finalResult = isComplete ? computedResult : null;
  const reductionTrace = getDynamicReductionTrace(expression, newExecutedIds, newCompletedOps);

  return {
    ...state,
    carriedValue: newCarriedValues.length > 0 ? newCarriedValues[newCarriedValues.length - 1] : null,
    carriedValues: newCarriedValues,
    finalResult,
    isComplete,
    pendingTray: newPendingTray,
    completedOperations: newCompletedOps,
    executedOpIds: newExecutedIds,
    reductionTrace,
    isSequenceValid,
    invalidationReasons
  };
}

/**
 * Validates whether the completed calculation sequence is mathematically sound
 */
export function validateCompletedSequence(expression, executedOpIds) {
  for (const validRoute of expression.validRoutes) {
    if (
      validRoute.sequence.length === executedOpIds.length &&
      validRoute.sequence.every((opId, idx) => opId === executedOpIds[idx])
    ) {
      return {
        isValid: true,
        routeId: validRoute.id,
        routeName: validRoute.name,
        targetResult: expression.targetResult
      };
    }
  }

  for (const invalidRoute of (expression.invalidRoutes || [])) {
    const matchesSequence = invalidRoute.sequence.every(
      (opId, idx) => executedOpIds[idx] === opId
    );
    if (matchesSequence) {
      return {
        isValid: false,
        reason: invalidRoute.finalWallReason,
        isTerminalWall: true
      };
    }
  }

  return {
    isValid: false,
    reason: `Incomplete or unrecognized sequence of operations. Result deviates from ${expression.targetResult}.`,
    isTerminalWall: false
  };
}
