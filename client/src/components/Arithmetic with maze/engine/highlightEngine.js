/**
 * Highlight Engine Module
 * 
 * Maps approaching stations to visual glowing brackets on the static original expression,
 * directly imitating the mini-expression bracketed state (e.g. `(3 + 5 × 3 − 10) ÷ (2)`).
 * After a station is collected, its brackets disappear.
 */

import { getOperationProvenance, resolveOperandProvenance } from './provenanceEngine.js';
import { parseExpressionTokens } from './expressionParser.js';
import { createInitialWorkingTerms, reduceWorkingTerms } from './expressionReducer.js';

export function parseExpressionSegments(expression, completedOperations = [], nearbyStation = null, conflictAnimation = null) {
  if (!expression || !expression.display) return [];

  const display = expression.display;
  const tokens = expression.tokens && expression.tokens.length > 0
    ? expression.tokens
    : parseExpressionTokens(display);

  if (!tokens || tokens.length === 0) {
    return [{ text: display, type: 'normal' }];
  }

  // If a provenance conflict animation is active, highlight the consuming source terms in QUESTION:
  if (conflictAnimation && conflictAnimation.consumingOpTokens && conflictAnimation.consumingOpTokens.length > 0) {
    const tokenById = new Map();
    tokens.forEach(t => tokenById.set(t.id, t));
    const conflictToks = conflictAnimation.consumingOpTokens.map(id => tokenById.get(id)).filter(Boolean);
    if (conflictToks.length > 0) {
      const start = Math.min(...conflictToks.map(t => t.start));
      const end = Math.max(...conflictToks.map(t => t.end));
      const segments = [];
      if (start > 0) {
        segments.push({ text: display.slice(0, start), type: 'normal' });
      }
      segments.push({
        text: display.slice(start, end),
        type: 'conflict-source',
        conflictingTokenValue: conflictAnimation.conflictingTokenValue
      });
      if (end < display.length) {
        segments.push({ text: display.slice(end), type: 'normal' });
      }
      return segments;
    }
  }

  // 1. If an upcoming uncompleted station is nearby, compute its glowing bracket spans
  const completedOpIds = new Set(completedOperations.map(op => op.id));
  const isApproaching = nearbyStation && !completedOpIds.has(nearbyStation.opId);

  if (!isApproaching) {
    // When no station is being approached (or station is already collected):
    // All brackets disappear! Return the expression as clean text.
    return [{ text: display, type: 'normal' }];
  }

  // 2. Identify the operation for this approaching station
  const opId = nearbyStation.opId;
  const operations = expression.operations || {};
  const op = nearbyStation.operation || operations[opId] || Object.values(operations).find(o => o.id === opId);

  if (!op) {
    // Fallback: If operation not found, return plain display
    return [{ text: display, type: 'normal' }];
  }

  // 3. Determine bracket intervals based on the station's operand structure
  const intervals = [];
  const tokenById = new Map();
  tokens.forEach(t => tokenById.set(t.id, t));

  const isLeftRef = op.leftOperand && (op.leftOperand.type === 'ref' || Boolean(op.leftOperand.opId));
  const isRightRef = op.rightOperand && (op.rightOperand.type === 'ref' || Boolean(op.rightOperand.opId));
  const hasCompositeBrackets = isLeftRef || isRightRef || 
    (typeof op.unsolvedLabel === 'string' && (op.unsolvedLabel.includes('(') || op.unsolvedLabel.includes(')')));

  // Collect all provenance tokens for this operation
  const provTokenIds = (op.provenance && op.provenance.length > 0)
    ? op.provenance
    : getOperationProvenance(expression, op.id);

  const provToks = provTokenIds.map(id => tokenById.get(id)).filter(Boolean);
  provToks.sort((a, b) => a.start - b.start);

  if (hasCompositeBrackets && provToks.length >= 3) {
    // Locate the operator token that splits left operand from right operand within the provenance
    let opTokIdx = -1;
    if (isLeftRef && !isRightRef) {
      // Main operator is immediately before the right operand (last matching operator)
      for (let i = provToks.length - 1; i >= 0; i--) {
        if (provToks[i].isOperator && provToks[i].text === op.operator) {
          opTokIdx = i;
          break;
        }
      }
    } else if (!isLeftRef && isRightRef) {
      // Main operator is immediately after the left operand (first matching operator)
      for (let i = 0; i < provToks.length; i++) {
        if (provToks[i].isOperator && provToks[i].text === op.operator) {
          opTokIdx = i;
          break;
        }
      }
    } else {
      // Both are refs (or general)
      for (let i = 0; i < provToks.length; i++) {
        if (provToks[i].isOperator && provToks[i].text === op.operator) {
          opTokIdx = i;
        }
      }
    }

    if (opTokIdx > 0 && opTokIdx < provToks.length - 1) {
      const leftToks = provToks.slice(0, opTokIdx);
      const rightToks = provToks.slice(opTokIdx + 1);
      intervals.push({
        start: Math.min(...leftToks.map(t => t.start)),
        end: Math.max(...leftToks.map(t => t.end)),
        type: 'approaching'
      });
      intervals.push({
        start: Math.min(...rightToks.map(t => t.start)),
        end: Math.max(...rightToks.map(t => t.end)),
        type: 'approaching'
      });
    } else {
      intervals.push({
        start: Math.min(...provToks.map(t => t.start)),
        end: Math.max(...provToks.map(t => t.end)),
        type: 'approaching'
      });
    }
  } else if (provToks.length > 0) {
    // Atomic operation with literal operands (e.g. `3 + 5` or `5 × 3`)
    intervals.push({
      start: Math.min(...provToks.map(t => t.start)),
      end: Math.max(...provToks.map(t => t.end)),
      type: 'approaching'
    });
  }

  // Sort intervals by start position
  intervals.sort((a, b) => a.start - b.start);

  if (intervals.length === 0) {
    return [{ text: display, type: 'normal' }];
  }

  // 4. Generate full segments covering original display
  const segments = [];
  let cur = 0;
  for (const inv of intervals) {
    if (inv.start > cur) {
      segments.push({
        text: display.slice(cur, inv.start),
        type: 'normal'
      });
    }
    segments.push({
      text: display.slice(inv.start, inv.end),
      type: 'approaching'
    });
    cur = inv.end;
  }
  if (cur < display.length) {
    segments.push({
      text: display.slice(cur),
      type: 'normal'
    });
  }

  return segments;
}

/**
 * Helper to format terms while recording exact character start and end positions in output string
 */
function formatTermsWithPositions(terms) {
  let str = '';
  const positioned = [];
  for (let i = 0; i < terms.length; i++) {
    const term = terms[i];
    const prev = i > 0 ? terms[i - 1] : null;
    let prefix = '';
    if (prev) {
      if (term.text !== ')' && prev.text !== '(') {
        prefix = ' ';
      }
    }
    str += prefix;
    const start = str.length;
    str += term.text;
    const end = str.length;
    positioned.push({ ...term, start, end });
  }
  return { str, positioned };
}

/**
 * Parses highlight segments with glowing brackets for the CURRENT live working expression.
 */
export function parseCurrentExpressionSegments(expression, calculation = {}, nearbyStation = null, conflictAnimation = null) {
  if (!expression || !expression.display) return [];

  const executedOpIds = calculation?.executedOpIds || [];
  const completedOperations = calculation?.completedOperations || [];
  const opMap = { ...(expression.operations || {}) };
  for (const cop of completedOperations) {
    if (cop && cop.id) {
      opMap[cop.id] = { ...(expression.operations ? expression.operations[cop.id] : {}), ...cop };
    }
  }

  let terms = createInitialWorkingTerms(expression);
  for (const item of executedOpIds) {
    const op = (typeof item === 'object' && item !== null) ? item : opMap[item];
    if (!op) continue;
    terms = reduceWorkingTerms(terms, op, expression);
  }

  const { str: currentText, positioned } = formatTermsWithPositions(terms);

  // If a provenance conflict animation is active, highlight the target reduced term in the live working expression
  if (conflictAnimation && conflictAnimation.consumingOpTokens && conflictAnimation.consumingOpTokens.length > 0) {
    const targetTerms = positioned.filter(t => 
      (t.provenance || []).some(id => conflictAnimation.consumingOpTokens.includes(id))
    );
    if (targetTerms.length > 0) {
      const start = Math.min(...targetTerms.map(t => t.start));
      const end = Math.max(...targetTerms.map(t => t.end));
      const segments = [];
      if (start > 0) {
        segments.push({ text: currentText.slice(0, start), type: 'normal' });
      }
      segments.push({
        text: currentText.slice(start, end),
        type: 'conflict-target',
        resultValue: conflictAnimation.resultValue
      });
      if (end < currentText.length) {
        segments.push({ text: currentText.slice(end), type: 'normal' });
      }
      return segments;
    }
  }

  const completedOpIds = new Set(completedOperations.map(op => op.id));
  const isApproaching = nearbyStation && !completedOpIds.has(nearbyStation.opId);

  if (!isApproaching) {
    return [{ text: currentText, type: 'normal' }];
  }

  const opId = nearbyStation.opId;
  const op = nearbyStation.operation || opMap[opId] || (expression.operations && expression.operations[opId]);
  if (!op) {
    return [{ text: currentText, type: 'normal' }];
  }

  const tokens = expression.tokens && expression.tokens.length > 0
    ? expression.tokens
    : parseExpressionTokens(expression.display);
  const tokenById = new Map();
  tokens.forEach(t => tokenById.set(t.id, t));

  const provTokenIds = (op.provenance && op.provenance.length > 0)
    ? op.provenance
    : getOperationProvenance(expression, op.id);

  const isLeftRef = op.leftOperand && (op.leftOperand.type === 'ref' || Boolean(op.leftOperand.opId));
  const isRightRef = op.rightOperand && (op.rightOperand.type === 'ref' || Boolean(op.rightOperand.opId));
  const hasComposite = isLeftRef || isRightRef || 
    (typeof op.unsolvedLabel === 'string' && (op.unsolvedLabel.includes('(') || op.unsolvedLabel.includes(')')));

  let leftTokenSet = new Set();
  let rightTokenSet = new Set();

  if (hasComposite && provTokenIds.length >= 3) {
    const provToks = provTokenIds.map(id => tokenById.get(id)).filter(Boolean);
    provToks.sort((a, b) => a.start - b.start);
    let opTokIdx = -1;
    if (isLeftRef && !isRightRef) {
      for (let i = provToks.length - 1; i >= 0; i--) {
        if (provToks[i].isOperator && provToks[i].text === op.operator) {
          opTokIdx = i;
          break;
        }
      }
    } else if (!isLeftRef && isRightRef) {
      for (let i = 0; i < provToks.length; i++) {
        if (provToks[i].isOperator && provToks[i].text === op.operator) {
          opTokIdx = i;
          break;
        }
      }
    } else {
      for (let i = 0; i < provToks.length; i++) {
        if (provToks[i].isOperator && provToks[i].text === op.operator) {
          opTokIdx = i;
        }
      }
    }

    if (opTokIdx > 0 && opTokIdx < provToks.length - 1) {
      leftTokenSet = new Set(provToks.slice(0, opTokIdx).map(t => t.id));
      rightTokenSet = new Set(provToks.slice(opTokIdx + 1).map(t => t.id));
    }
  }

  const provSet = new Set(provTokenIds);

  const intervals = [];
  if (leftTokenSet.size > 0 && rightTokenSet.size > 0) {
    const leftTerms = positioned.filter(t => (t.provenance || []).some(id => leftTokenSet.has(id)));
    const rightTerms = positioned.filter(t => (t.provenance || []).some(id => rightTokenSet.has(id)));
    if (leftTerms.length > 0) {
      intervals.push({
        start: Math.min(...leftTerms.map(t => t.start)),
        end: Math.max(...leftTerms.map(t => t.end))
      });
    }
    if (rightTerms.length > 0) {
      intervals.push({
        start: Math.min(...rightTerms.map(t => t.start)),
        end: Math.max(...rightTerms.map(t => t.end))
      });
    }
  } else if (provSet.size > 0) {
    const matchingTerms = positioned.filter(t => (t.provenance || []).some(id => provSet.has(id)));
    if (matchingTerms.length > 0) {
      intervals.push({
        start: Math.min(...matchingTerms.map(t => t.start)),
        end: Math.max(...matchingTerms.map(t => t.end))
      });
    }
  }

  intervals.sort((a, b) => a.start - b.start);

  if (intervals.length === 0) {
    return [{ text: currentText, type: 'normal' }];
  }

  const segments = [];
  let cur = 0;
  for (const inv of intervals) {
    if (inv.start > cur) {
      segments.push({ text: currentText.slice(cur, inv.start), type: 'normal' });
    }
    segments.push({ text: currentText.slice(inv.start, inv.end), type: 'approaching' });
    cur = inv.end;
  }
  if (cur < currentText.length) {
    segments.push({ text: currentText.slice(cur), type: 'normal' });
  }

  return segments;
}
