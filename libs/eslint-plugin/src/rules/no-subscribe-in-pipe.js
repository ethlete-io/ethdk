// @ts-check
'use strict';

/**
 * Disallows calling .subscribe() inside a .pipe() callback.
 *
 * BAD:
 *   obs$.pipe(
 *     tap(() => {
 *       other$.subscribe(); // ❌ creates an unmanaged subscription
 *     }),
 *   ).subscribe();
 *
 * GOOD:
 *   obs$.pipe(
 *     switchMap(() => other$), // ✅ compose instead
 *   ).subscribe();
 *
 *   obs$.pipe(...operators).subscribe(); // ✅ subscribe on the result of pipe
 */

/** @type {import('eslint').Rule.RuleModule} */
const noSubscribeInPipe = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow .subscribe() calls inside .pipe() callbacks.',
      recommended: true,
    },
    messages: {
      noSubscribeInPipe:
        'Avoid calling .subscribe() inside a .pipe() callback. Compose with operators (switchMap, mergeMap, etc.) instead.',
    },
    schema: [],
  },
  create(context) {
    /**
     * Returns true if the given node is nested inside a callback function that
     * is itself (directly or indirectly) an argument to a .pipe() call.
     * @param {import('eslint').Rule.Node} node
     */
    const isInsidePipeCallback = (node) => {
      let crossedFunctionBoundary = false;
      let current = node.parent;
      while (current) {
        // A `new Observable(factory)` is its own subscription boundary — subscribing
        // inside it is intentional (inner subscription management) and should not
        // be flagged even if the Observable itself is passed into a .pipe() operator.
        if (
          current.type === 'NewExpression' &&
          current.callee.type === 'Identifier' &&
          current.callee.name === 'Observable'
        ) {
          return false;
        }
        if (current.type === 'ArrowFunctionExpression' || current.type === 'FunctionExpression') {
          crossedFunctionBoundary = true;
        }
        if (
          crossedFunctionBoundary &&
          current.type === 'CallExpression' &&
          current.callee.type === 'MemberExpression' &&
          current.callee.property.type === 'Identifier' &&
          current.callee.property.name === 'pipe'
        ) {
          return true;
        }
        current = current.parent;
      }
      return false;
    };

    return {
      CallExpression(node) {
        const { callee } = node;
        if (
          callee.type === 'MemberExpression' &&
          callee.property.type === 'Identifier' &&
          callee.property.name === 'subscribe' &&
          isInsidePipeCallback(node)
        ) {
          context.report({ node, messageId: 'noSubscribeInPipe' });
        }
      },
    };
  },
};

module.exports = noSubscribeInPipe;
