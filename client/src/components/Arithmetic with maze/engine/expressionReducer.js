/**
 * Expression Reducer Module
 * 
 * Performs step-by-step reduction of mathematical expressions dynamically.
 * Generates working expressions without any hardcoded strings or special cases.
 * Handles bracket reduction and operator precedence formatting dynamically.
 */

import { parseExpressionTokens } from './expressionParser.js';
import { getOperationProvenance } from './provenanceEngine.js';

/**
 * Initializes a list of working terms from an expression's parsed tokens.
 */
export function createInitialWorkingTerms(expression) {
  const tokens = expression.tokens && expression.tokens.length > 0
    ? expression.tokens
    : parseExpressionTokens(expression.display);

  return tokens.map(t => ({
    id: t.id,
    text: t.text,
    value: t.value,
    type: t.type,
    provenance: [t.id]
  }));
}

/**
 * Formats an array of working terms into a clean readable math expression string.
 */
export function formatWorkingExpression(terms) {
  if (!terms || terms.length === 0) return '';
  const result = [];

  for (let i = 0; i < terms.length; i++) {
    const term = terms[i];
    const prev = i > 0 ? terms[i - 1] : null;

    if (!prev) {
      result.push(term.text);
      continue;
    }

    // Spacing rules
    if (term.text === ')' || prev.text === '(') {
      result.push(term.text);
    } else {
      result.push(' ' + term.text);
    }
  }

  return result.join('').trim();
}

/**
 * Executes a single reduction step on an array of working terms.
 * Finds the subexpression corresponding to `operation` and replaces it with the result term.
 */
export function reduceWorkingTerms(workingTerms, operation, expression) {
  if (!workingTerms || workingTerms.length === 0 || !operation) {
    return workingTerms;
  }

  const opId = typeof operation === 'string' ? operation : operation.id;
  const opTokens = (operation && operation.provenance && operation.provenance.length > 0)
    ? operation.provenance
    : getOperationProvenance(expression, opId);
  const opTokenSet = new Set(opTokens);

  // Find range of terms in workingTerms whose provenance is a subset of this operation's provenance
  let firstIdx = -1;
  let lastIdx = -1;

  for (let i = 0; i < workingTerms.length; i++) {
    const term = workingTerms[i];
    // Check if this term belongs to the operation
    const belongs = term.provenance.some(tid => opTokenSet.has(tid));
    if (belongs) {
      if (firstIdx === -1) firstIdx = i;
      lastIdx = i;
    }
  }

  // Also check if immediately preceding term is '(' and immediately following term is ')'
  // belonging to this operation
  if (firstIdx > 0 && workingTerms[firstIdx - 1].text === '(') {
    const leftBracketBelongs = workingTerms[firstIdx - 1].provenance.some(tid => opTokenSet.has(tid));
    if (leftBracketBelongs) {
      firstIdx = firstIdx - 1;
    }
  }
  if (lastIdx < workingTerms.length - 1 && workingTerms[lastIdx + 1].text === ')') {
    const rightBracketBelongs = workingTerms[lastIdx + 1].provenance.some(tid => opTokenSet.has(tid));
    if (rightBracketBelongs) {
      lastIdx = lastIdx + 1;
    }
  }

  if (firstIdx === -1 || lastIdx === -1) {
    return workingTerms;
  }

  const prevTerm = firstIdx > 0 ? workingTerms[firstIdx - 1] : null;
  const nextTerm = lastIdx < workingTerms.length - 1 ? workingTerms[lastIdx + 1] : null;

  // Format result text: intermediate results get parentheses when an addition is adjacent to multiplication
  // or subtraction is a right-operand to multiplication/division, but not for resolved bracketed terms or left-side division
  let resultText = String(operation.result);
  const wasBracketed = Boolean(operation.bracketTokenIds && operation.bracketTokenIds.length > 0);

  if (!wasBracketed && (operation.operator === '+' || operation.operator === '−')) {
    const isLeftOperandToMul = nextTerm && nextTerm.text === '×';
    const isRightOperandToMulOrDiv = prevTerm && (prevTerm.text === '×' || prevTerm.text === '÷');
    if (isLeftOperandToMul || isRightOperandToMulOrDiv) {
      resultText = `(${operation.result})`;
    }
  }

  const resultTerm = {
    id: `res_${operation.id}`,
    text: resultText,
    value: operation.result,
    type: 'number',
    provenance: opTokens
  };

  const newTerms = [
    ...workingTerms.slice(0, firstIdx),
    resultTerm,
    ...workingTerms.slice(lastIdx + 1)
  ];

  return newTerms;
}

/**
 * Computes the full step-by-step reduction trace dynamically for any sequence of executed operations.
 */
export function getDynamicReductionTrace(expression, executedOpIds = [], completedOperations = []) {
  const initial = expression.display;
  const trace = [initial];

  if (!executedOpIds || executedOpIds.length === 0) {
    return trace;
  }

  const opMap = { ...(expression.operations || {}) };
  if (Array.isArray(completedOperations)) {
    for (const cop of completedOperations) {
      if (cop && cop.id) {
        opMap[cop.id] = { ...(expression.operations ? expression.operations[cop.id] : {}), ...cop };
      }
    }
  }

  let terms = createInitialWorkingTerms(expression);

  for (const item of executedOpIds) {
    const op = (typeof item === 'object' && item !== null)
      ? item
      : opMap[item];
    if (!op) continue;
    terms = reduceWorkingTerms(terms, op, expression);
    const formatted = formatWorkingExpression(terms);
    trace.push(formatted);
  }

  return trace;
}
