/**
 * Expression Parser Module
 * 
 * Expression-agnostic tokenizer and structural parser for mathematical expressions.
 * Identifies numbers, operators, brackets, positions, and unique token IDs.
 * Handles repeated numbers/operators by giving every occurrence a distinct identity.
 */

export function normalizeOperators(str) {
  if (!str) return '';
  return str
    .replace(/\*/g, '×')
    .replace(/\//g, '÷')
    .replace(/-/g, '−');
}

export function parseExpressionTokens(displayStr) {
  if (!displayStr) return [];
  const normalized = normalizeOperators(displayStr);
  const regex = /(\d+|[+−×÷\(\)])/g;
  const tokens = [];
  let match;
  let idx = 0;

  while ((match = regex.exec(normalized)) !== null) {
    const text = match[0];
    let type = 'operator';
    let value = null;

    if (/^\d+$/.test(text)) {
      type = 'number';
      value = parseInt(text, 10);
    } else if (text === '(' || text === ')') {
      type = 'bracket';
    }

    tokens.push({
      id: `t_${idx}`,
      index: idx,
      text,
      type,
      value,
      start: match.index,
      end: match.index + text.length,
      isOperator: type === 'operator',
      isNumber: type === 'number',
      isBracket: type === 'bracket'
    });
    idx++;
  }

  return tokens;
}
