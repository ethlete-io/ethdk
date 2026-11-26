// @ts-check
'use strict';

const { isImportedAs } = require('./internals/import-resolution');

/**
 * Prefer linkedSignal over setting a signal inside an effect().
 *
 * When a signal is set inside an effect(), it usually means the new value is
 * derived from other reactive state. That pattern is better expressed with
 * linkedSignal(), which is declarative, avoids the scheduling overhead of
 * effect(), and makes the dependency chain explicit.
 *
 * BAD:
 *   selectedItem = signal<Item | null>(null);
 *
 *   constructor() {
 *     effect(() => {
 *       // Reset selection whenever the list changes
 *       this.selectedItem.set(this.items()[0] ?? null);  // ❌
 *     });
 *   }
 *
 * GOOD:
 *   selectedItem = linkedSignal(() => this.items()[0] ?? null);
 *
 * Also flagged when the write sits behind an `if`, as long as every branch only
 * writes signals: `linkedSignal` keeps the previous value for the untaken branch.
 */

/**
 * @param {any} node
 * @returns {boolean}
 */
const isSetCall = (node) =>
  node.type === 'CallExpression' &&
  node.callee.type === 'MemberExpression' &&
  node.callee.property.type === 'Identifier' &&
  node.callee.property.name === 'set' &&
  node.arguments.length === 1;

/**
 * A statement that does nothing but write signals: a lone `.set()`, a block holding one, or an
 * `if`/`else` whose every branch is one.
 *
 * @param {any} statement
 * @returns {boolean}
 */
const isSetOnlyStatement = (statement) => {
  if (!statement) return false;
  if (statement.type === 'ExpressionStatement') return isSetCall(statement.expression);
  if (statement.type === 'BlockStatement') return statement.body.length === 1 && isSetOnlyStatement(statement.body[0]);
  if (statement.type === 'IfStatement') {
    return (
      isSetOnlyStatement(statement.consequent) && (!statement.alternate || isSetOnlyStatement(statement.alternate))
    );
  }
  return false;
};

/**
 * True when the `.set()` call sits directly in an `effect()` callback (not in a nested function such as
 * `untracked(() => …)`) and that callback does nothing but write signals, optionally behind an `if`.
 *
 * @param {import('eslint').SourceCode} sourceCode
 * @param {import('eslint').Rule.Node} node The `.set()` CallExpression node
 */
const isPureSetInDirectEffectCallback = (sourceCode, node) => {
  // Find the immediate enclosing function (cross exactly one boundary).
  let current = node.parent;
  let immediateFunction = null;

  while (current) {
    if (current.type === 'ArrowFunctionExpression' || current.type === 'FunctionExpression') {
      immediateFunction = current;
      break;
    }
    current = current.parent;
  }

  if (!immediateFunction) return false;

  // The immediate function must be the first argument to an effect() call.
  const funcParent = immediateFunction.parent;
  if (
    !funcParent ||
    funcParent.type !== 'CallExpression' ||
    !isImportedAs(sourceCode, funcParent.callee, 'effect') ||
    funcParent.arguments[0] !== immediateFunction
  ) {
    return false;
  }

  const body = immediateFunction.body;
  if (body.type !== 'BlockStatement') return body === node;

  return node.parent.type === 'ExpressionStatement' && body.body.length === 1 && isSetOnlyStatement(body.body[0]);
};

/** @type {import('eslint').Rule.RuleModule} */
const preferLinkedSignal = {
  meta: {
    type: 'suggestion',
    docs: {
      description: "Prefer 'linkedSignal' over setting a signal inside effect().",
      recommended: true,
    },
    messages: {
      preferLinkedSignal:
        "Setting a signal inside 'effect()' usually means the value is derived from reactive state. Use 'linkedSignal(() => ...)' instead — it is declarative and avoids effect scheduling overhead.",
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        if (isSetCall(node) && isPureSetInDirectEffectCallback(context.sourceCode, node)) {
          context.report({ node, messageId: 'preferLinkedSignal' });
        }
      },
    };
  },
};

module.exports = preferLinkedSignal;
