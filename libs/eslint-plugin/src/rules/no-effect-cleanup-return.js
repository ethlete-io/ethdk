// @ts-check
'use strict';

/**
 * Disallows returning a cleanup function from an `effect()` callback.
 *
 * Angular's `effect()` ignores whatever the callback returns — the React/Svelte idiom of returning a
 * teardown function silently does nothing, so the "cleanup" never runs. The bug is invisible: the code
 * reads as if it unregisters, and only the leak shows up later.
 *
 * BAD:
 *   effect(() => {
 *     this.group?.registerItem(this);
 *
 *     return () => this.group?.unregisterItem(this); // ❌ never called
 *   });
 *
 * GOOD — teardown tied to each re-run (the registered key is reactive):
 *   effect((onCleanup) => {
 *     const id = this.ref().id;
 *     this.stack?.registerItem(id);
 *
 *     onCleanup(() => this.stack?.unregisterItem(id));
 *   });
 *
 * GOOD — teardown tied to the lifetime, for a registration that never changes:
 *   this.group?.registerItem(this);
 *   inject(DestroyRef).onDestroy(() => this.group?.unregisterItem(this));
 */

/** Calls whose first argument is a body that ignores its return value. */
const EFFECT_CALLEES = new Set(['effect', 'afterRenderEffect']);

/**
 * @param {any} node
 * @returns {boolean}
 */
const isFunctionExpression = (node) =>
  !!node && (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression');

/**
 * @param {any} node
 * @returns {boolean}
 */
const isFunction = (node) => isFunctionExpression(node) || node?.type === 'FunctionDeclaration';

/**
 * Every `return` the given function owns — returns inside nested functions belong to those, so the walk
 * stops at each function boundary.
 * @param {any} fn
 * @returns {any[]}
 */
const ownReturnStatements = (fn) => {
  /** @type {any[]} */
  const returns = [];

  /** @param {any} node */
  const visit = (node) => {
    if (!node || typeof node.type !== 'string') {
      return;
    }

    if (node.type === 'ReturnStatement') {
      returns.push(node);

      return;
    }

    if (isFunction(node)) {
      return;
    }

    for (const key of Object.keys(node)) {
      if (key === 'parent') {
        continue;
      }

      const value = node[key];

      if (Array.isArray(value)) {
        value.forEach(visit);
      } else if (value && typeof value.type === 'string') {
        visit(value);
      }
    }
  };

  fn.body.body.forEach(visit);

  return returns;
};

/** @type {import('eslint').Rule.RuleModule} */
const noEffectCleanupReturn = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow returning a cleanup function from an effect() callback — Angular ignores it.',
      recommended: true,
    },
    messages: {
      returnedCleanup:
        '{{callee}}() ignores the value its callback returns, so this cleanup function never runs. ' +
        'Register it via the onCleanup parameter — {{callee}}((onCleanup) => { …; onCleanup(() => …) }) — or, ' +
        'when the teardown belongs to the lifetime rather than to each re-run, drop the effect and use ' +
        'inject(DestroyRef).onDestroy(() => …).',
    },
    schema: [],
    fixable: 'code',
  },
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      CallExpression(node) {
        const { callee } = node;

        if (callee.type !== 'Identifier' || !EFFECT_CALLEES.has(callee.name)) {
          return;
        }

        const callback = /** @type {any} */ (node.arguments[0]);

        if (!isFunctionExpression(callback)) {
          return;
        }

        // effect(() => () => cleanup()) — the whole body *is* the ignored cleanup
        if (isFunctionExpression(callback.body)) {
          context.report({
            node: callback.body,
            messageId: 'returnedCleanup',
            data: { callee: callee.name },
          });

          return;
        }

        if (callback.body.type !== 'BlockStatement') {
          return;
        }

        const returns = ownReturnStatements(callback);
        const cleanupReturns = returns.filter((statement) => isFunctionExpression(statement.argument));

        if (cleanupReturns.length === 0) {
          return;
        }

        const openParen = sourceCode
          .getTokens(callback)
          .find((token) => token.value === '(' && token.range[1] <= callback.body.range[0]);
        const callbackScope = sourceCode.getScope(callback);
        const hasOnCleanupBinding = callbackScope.variables.some((variable) => variable.name === 'onCleanup');
        const fixable =
          callback.params.length === 0 &&
          returns.length === 1 &&
          cleanupReturns.length === 1 &&
          callback.body.body.at(-1) === cleanupReturns[0] &&
          !hasOnCleanupBinding;

        for (const statement of cleanupReturns) {
          context.report({
            node: statement.argument,
            messageId: 'returnedCleanup',
            data: { callee: callee.name },
            fix:
              fixable && openParen
                ? (fixer) => [
                    fixer.insertTextAfter(openParen, 'onCleanup'),
                    fixer.replaceText(statement, `onCleanup(${sourceCode.getText(statement.argument)});`),
                  ]
                : null,
          });
        }
      },
    };
  },
};

module.exports = noEffectCleanupReturn;
