// @ts-check
'use strict';

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
 * NOTE: Only flag when .set() is called directly inside an effect() callback.
 * Setting signals outside effects (in methods, event handlers, etc.) is fine.
 */

/**
 * Returns true only when the `.set()` call node is a *pure derivation* inside
 * an effect() callback — meaning:
 *
 * 1. The IMMEDIATE enclosing function (the first function boundary walking up
 *    from the node) IS the first argument passed to `effect()`. This ensures
 *    that `.set()` calls nested inside `untracked(() => ...)` or other inner
 *    functions within the effect are NOT flagged — those are intentional
 *    write-back patterns, not derivations.
 *
 * 2. The `.set()` call is the SOLE expression in that callback:
 *    - Arrow with expression body: `effect(() => sig.set(x))`
 *    - Block body with a single ExpressionStatement: `effect(() => { sig.set(x); })`
 *
 *    Multi-statement blocks (even if they end with a `.set()`) indicate that the
 *    effect is performing side effects alongside the signal write, so they are
 *    not flagged either.
 *
 * @param {import('eslint').Rule.Node} node The `.set()` CallExpression node
 */
const isPureSetInDirectEffectCallback = (node) => {
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
    funcParent.callee.type !== 'Identifier' ||
    funcParent.callee.name !== 'effect' ||
    funcParent.arguments[0] !== immediateFunction
  ) {
    return false;
  }

  // The .set() must be the sole expression — no surrounding statements.
  // Case A: arrow with expression body — the body IS the .set() call.
  if (immediateFunction.type === 'ArrowFunctionExpression' && immediateFunction.body === node) {
    return true;
  }

  // Case B: block body with exactly one ExpressionStatement wrapping the .set() call.
  const body = immediateFunction.body;
  return (
    body.type === 'BlockStatement' &&
    body.body.length === 1 &&
    body.body[0].type === 'ExpressionStatement' &&
    body.body[0].expression === node
  );
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
        const { callee } = node;

        if (
          callee.type === 'MemberExpression' &&
          callee.property.type === 'Identifier' &&
          callee.property.name === 'set' &&
          isPureSetInDirectEffectCallback(node)
        ) {
          context.report({ node, messageId: 'preferLinkedSignal' });
        }
      },
    };
  },
};

module.exports = preferLinkedSignal;
