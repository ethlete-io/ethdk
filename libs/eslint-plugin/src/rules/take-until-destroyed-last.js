// @ts-check
'use strict';

const { isImportedAs } = require('./internals/import-resolution');

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

const ALLOWED_AFTER = new Set([
  'finalize',
  'defaultIfEmpty',
  'endWith',
  'toArray',
  'last',
  'count',
  'reduce',
  'takeLast',
]);

/**
 * @param {any} node
 */
const isPipeCall = (node) =>
  node?.type === 'CallExpression' &&
  node.callee.type === 'MemberExpression' &&
  !node.callee.computed &&
  node.callee.property.type === 'Identifier' &&
  node.callee.property.name === 'pipe';

/**
 * @param {any} node
 */
const isAllowedAfter = (node) =>
  node.type === 'CallExpression' && node.callee.type === 'Identifier' && ALLOWED_AFTER.has(node.callee.name);

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
        'takeUntilDestroyed() must be the last operator in the pipe. An operator after it that subscribes to an inner or shared source (switchMap, mergeMap, share without refCount, …) outlives destroy. Move takeUntilDestroyed() after it.',
    },
    schema: [],
  },
  create(context) {
    /** @param {import('estree').Node} node */
    const isTakeUntilDestroyedCall = (node) =>
      node.type === 'CallExpression' &&
      isImportedAs(context.sourceCode, node.callee, 'takeUntilDestroyed', '@angular/core/rxjs-interop');

    return {
      CallExpression(node) {
        if (!isPipeCall(node)) return;

        const parent = /** @type {any} */ (node).parent;
        if (parent?.type === 'MemberExpression' && parent.object === node && isPipeCall(parent.parent)) return;

        /** @type {any[]} */
        const operators = [];
        for (let call = /** @type {any} */ (node); isPipeCall(call); call = call.callee.object) {
          operators.unshift(...call.arguments);
        }

        operators.forEach((operator, index) => {
          if (!isTakeUntilDestroyedCall(operator)) return;
          if (operators.slice(index + 1).every(isAllowedAfter)) return;

          context.report({ node: operator, messageId: 'takeUntilDestroyedLast' });
        });
      },
    };
  },
};

module.exports = takeUntilDestroyedLast;
