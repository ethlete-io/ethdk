// @ts-check
'use strict';

/**
 * Requires takeUntilDestroyed() to be the last operator in a .pipe().
 *
 * BAD:
 *   obs$.pipe(
 *     takeUntilDestroyed(),
 *     switchMap(() => fromEvent(el, 'scroll')), // ❌ the inner subscription outlives the component
 *   ).subscribe();
 *
 * GOOD:
 *   obs$.pipe(
 *     switchMap(() => fromEvent(el, 'scroll')),
 *     takeUntilDestroyed(), // ✅ tears down everything above it
 *   ).subscribe();
 */

/** @type {import('eslint').Rule.RuleModule} */
const takeUntilDestroyedLast = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require takeUntilDestroyed() to be the last operator in a .pipe().',
      recommended: true,
    },
    messages: {
      takeUntilDestroyedLast:
        'takeUntilDestroyed() must be the last operator in the pipe. An operator after it (switchMap, shareReplay, …) can keep the subscription alive after destroy.',
    },
    schema: [],
  },
  create(context) {
    /** @param {import('estree').Node} node */
    const isTakeUntilDestroyedCall = (node) =>
      node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'takeUntilDestroyed';

    return {
      CallExpression(node) {
        const { callee } = node;
        if (
          callee.type !== 'MemberExpression' ||
          callee.property.type !== 'Identifier' ||
          callee.property.name !== 'pipe'
        ) {
          return;
        }

        const lastIndex = node.arguments.length - 1;
        node.arguments.forEach((arg, index) => {
          if (index < lastIndex && isTakeUntilDestroyedCall(arg)) {
            context.report({ node: arg, messageId: 'takeUntilDestroyedLast' });
          }
        });
      },
    };
  },
};

module.exports = takeUntilDestroyedLast;
