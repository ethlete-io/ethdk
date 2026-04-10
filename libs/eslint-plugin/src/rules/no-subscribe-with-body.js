// @ts-check
'use strict';

/**
 * Disallows non-empty function bodies inside `.subscribe()` calls.
 * Side effects must be moved into a `tap()` operator inside the pipe instead.
 *
 * ❌ someObs$.subscribe((res) => console.log(res));
 * ❌ someObs$.subscribe((res) => { doSomething(res); });
 * ❌ someObs$.subscribe({ next: (res) => doSomething(res) });
 *
 * ✅ someObs$.pipe(tap((res) => console.log(res))).subscribe();
 * ✅ someObs$.subscribe();
 * ✅ someObs$.subscribe(() => {});  // empty body is fine
 *
 * @type {import('eslint').Rule.RuleModule}
 */
const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require subscribe() to be called with an empty body. Move side effects into tap() inside the pipe.',
    },
    schema: [],
    messages: {
      noSubscribeBody: 'Keep subscribe() empty. Move side effects into a tap() operator inside the pipe.',
    },
  },
  create(context) {
    /**
     * Returns true if the function node has a non-empty body.
     * @param {import('eslint').Rule.Node} fn
     */
    const hasBody = (fn) => {
      const node = /** @type {any} */ (fn);
      if (node.type === 'ArrowFunctionExpression') {
        // Concise arrow: `(x) => x.foo` — always has a value expression
        if (node.body.type !== 'BlockStatement') return true;
        return node.body.body.length > 0;
      }
      if (node.type === 'FunctionExpression') {
        return node.body.body.length > 0;
      }
      return false;
    };

    return {
      CallExpression(node) {
        const callee = /** @type {any} */ (node.callee);

        if (
          callee.type !== 'MemberExpression' ||
          callee.property.type !== 'Identifier' ||
          callee.property.name !== 'subscribe'
        ) {
          return;
        }

        const args = /** @type {any[]} */ (node.arguments);

        // Skip non-RxJS subscribe patterns where the first argument is a string
        // literal (e.g. Facebook SDK: player.subscribe('eventName', callback)).
        // RxJS .subscribe() never takes a string as its first argument.
        if (args.length > 0 && args[0].type === 'Literal' && typeof args[0].value === 'string') {
          return;
        }

        for (const arg of args) {
          // Direct function argument: .subscribe((res) => ...)
          if (arg.type === 'ArrowFunctionExpression' || arg.type === 'FunctionExpression') {
            if (hasBody(arg)) {
              context.report({ node, messageId: 'noSubscribeBody' });
              return;
            }
            continue;
          }

          // Observer object: .subscribe({ next: (res) => ..., error: ..., complete: ... })
          if (arg.type === 'ObjectExpression') {
            for (const prop of arg.properties) {
              if (prop.type !== 'Property') continue;
              const val = /** @type {any} */ (prop.value);
              if ((val.type === 'ArrowFunctionExpression' || val.type === 'FunctionExpression') && hasBody(val)) {
                context.report({ node, messageId: 'noSubscribeBody' });
                return;
              }
            }
          }
        }
      },
    };
  },
};

module.exports = rule;
