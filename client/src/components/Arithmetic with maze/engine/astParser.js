/**
 * astParser.js
 * 
 * Recursive-descent AST Parser for mathematical expressions.
 * Produces an Abstract Syntax Tree with unique token identities and positions.
 * Supports +, −, ×, ÷, parentheses, multi-digit integers, and decimals.
 */

import { parseExpressionTokens, normalizeOperators } from './expressionParser.js';

export { parseExpressionTokens, normalizeOperators };

/**
 * Parses an expression string into an AST.
 * AST Nodes:
 * - NumberNode: { type: 'Number', id, value, token }
 * - BinaryOpNode: { type: 'BinaryOp', id, operator, left, right, operatorToken, bracketTokens: [] }
 */
export function parseExpressionAST(exprStr) {
  const normalized = normalizeOperators(exprStr);
  const tokens = parseExpressionTokens(normalized);

  let currentTokenIdx = 0;

  function peek() {
    return tokens[currentTokenIdx] || null;
  }

  function consume(expectedType = null, expectedText = null) {
    const token = tokens[currentTokenIdx];
    if (!token) {
      throw new Error(`Unexpected end of expression`);
    }
    if (expectedType && token.type !== expectedType) {
      throw new Error(`Expected token type ${expectedType} but got ${token.type} at token ${token.text}`);
    }
    if (expectedText && token.text !== expectedText) {
      throw new Error(`Expected '${expectedText}' but got '${token.text}'`);
    }
    currentTokenIdx++;
    return token;
  }

  let opCount = 0;

  /**
   * Primary: Number or Parenthesized Expression
   */
  function parsePrimary() {
    const token = peek();
    if (!token) throw new Error('Unexpected end of expression in primary');

    if (token.type === 'bracket' && token.text === '(') {
      const openBracket = consume('bracket', '(');
      const expr = parseAddSub();
      const closeBracket = consume('bracket', ')');

      // Attach bracket tokens to the enclosing expression node
      if (!expr.bracketTokens) {
        expr.bracketTokens = [];
      }
      expr.bracketTokens.push(openBracket, closeBracket);
      return expr;
    }

    if (token.type === 'number') {
      const numToken = consume('number');
      return {
        type: 'Number',
        id: `node_num_${numToken.id}`,
        value: numToken.value,
        token: numToken,
        sourceTokens: [numToken.id]
      };
    }

    throw new Error(`Unexpected token '${token.text}' at position ${token.start}`);
  }

  /**
   * Multiplication and Division (Precedence 2)
   */
  function parseMulDiv() {
    let left = parsePrimary();

    while (peek() && peek().type === 'operator' && (peek().text === '×' || peek().text === '÷')) {
      const opToken = consume('operator');
      const right = parsePrimary();
      opCount++;

      left = {
        type: 'BinaryOp',
        id: `node_op_${opCount}`,
        operator: opToken.text,
        left,
        right,
        operatorToken: opToken,
        bracketTokens: [],
        sourceTokens: [
          ...left.sourceTokens,
          opToken.id,
          ...right.sourceTokens
        ]
      };
    }

    return left;
  }

  /**
   * Addition and Subtraction (Precedence 1)
   */
  function parseAddSub() {
    let left = parseMulDiv();

    while (peek() && peek().type === 'operator' && (peek().text === '+' || peek().text === '−')) {
      const opToken = consume('operator');
      const right = parseMulDiv();
      opCount++;

      left = {
        type: 'BinaryOp',
        id: `node_op_${opCount}`,
        operator: opToken.text,
        left,
        right,
        operatorToken: opToken,
        bracketTokens: [],
        sourceTokens: [
          ...left.sourceTokens,
          opToken.id,
          ...right.sourceTokens
        ]
      };
    }

    return left;
  }

  const ast = parseAddSub();

  if (currentTokenIdx < tokens.length) {
    throw new Error(`Unexpected extra tokens starting at '${tokens[currentTokenIdx].text}'`);
  }

  return {
    raw: exprStr,
    normalized,
    tokens,
    ast
  };
}
