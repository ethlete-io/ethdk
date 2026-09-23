// @ts-check
'use strict';

const { ANGULAR_CORE, getImportedName } = require('./internals/import-resolution');

/**
 * Disallows calling .subscribe() inside Angular's effect() or computed() callbacks.
 *
 * This creates unmanaged subscriptions and causes memory leaks because neither
 * effect() nor computed() provides a lifecycle-tied cleanup mechanism for subscriptions.
 *
 * BAD:
 *   effect(() => {
 *     const page = this.page();
 *     this.api.fetch(page).subscribe(res => this.data.set(res)); // ❌
 *   });
 *
 * GOOD:
 *   toObservable(this.page)
 *     .pipe(
 *       switchMap(page => this.api.fetch(page)),
 *       takeUntilDestroyed(),
 *     )
 *     .subscribe();
 */

/** @type {import('eslint').Rule.RuleModule} */
const noRxjsInEffect = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow .subscribe() inside effect() or computed() callbacks.',
      recommended: true,
    },
    messages: {
      noSubscribeInEffect:
        'Avoid calling .subscribe() inside {{context}}(). Use toObservable() + switchMap() + takeUntilDestroyed() instead.',
    },
    schema: [],
  },
  create(context) {
    /**
     * Returns the name of the wrapping reactive context ('effect' | 'computed') if
     * the given node is inside one, or null otherwise.
     * @param {import('eslint').Rule.Node} node
     * @returns {string | null}
     */
    const getReactiveContext = (node) => {
      let crossedFunctionBoundary = false;
      let current = node.parent;
      while (current) {
        if (current.type === 'ArrowFunctionExpression' || current.type === 'FunctionExpression') {
          crossedFunctionBoundary = true;
        }
        if (crossedFunctionBoundary && current.type === 'CallExpression') {
          const calleeName = getImportedName(context.sourceCode, current.callee, ANGULAR_CORE);
          if (calleeName === 'effect' || calleeName === 'computed') return calleeName;
        }
        current = current.parent;
      }
      return null;
    };

    return {
      CallExpression(node) {
        const { callee } = node;
        if (
          callee.type === 'MemberExpression' &&
          callee.property.type === 'Identifier' &&
          callee.property.name === 'subscribe'
        ) {
          const reactiveContext = getReactiveContext(node);
          if (reactiveContext) {
            context.report({
              node,
              messageId: 'noSubscribeInEffect',
              data: { context: reactiveContext },
            });
          }
        }
      },
    };
  },
};

module.exports = noRxjsInEffect;
