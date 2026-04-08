// @ts-check
'use strict';

/**
 * Prefer RxJS timer/interval/fromEvent operators over native browser APIs.
 *
 * RxJS operators integrate with takeUntilDestroyed() for automatic cleanup,
 * whereas native APIs require manual cleanup and are easy to leak.
 *
 * BAD:
 *   setTimeout(() => this.refresh(), 500);     // leaks if component destroyed first
 *   setInterval(() => this.poll(), 2000);      // leaks
 *   element.addEventListener('click', handler); // must be removed manually
 *   element.removeEventListener('click', handler);
 *
 * GOOD:
 *   timer(500).pipe(takeUntilDestroyed()).subscribe(() => this.refresh());
 *   interval(2000).pipe(takeUntilDestroyed()).subscribe(() => this.poll());
 *   fromEvent(element, 'click').pipe(takeUntilDestroyed()).subscribe(handler);
 */

/** @type {import('eslint').Rule.RuleModule} */
const preferRxjsTimer = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Prefer RxJS timer / interval / fromEvent over native browser timer and event APIs.',
      recommended: true,
    },
    messages: {
      preferTimer:
        "Use RxJS 'timer(delay)' from 'rxjs' instead of 'setTimeout()'. Combine with 'takeUntilDestroyed()' for automatic cleanup.",
      preferInterval:
        "Use RxJS 'interval(period)' from 'rxjs' instead of 'setInterval()'. Combine with 'takeUntilDestroyed()' for automatic cleanup.",
      preferUnsubscribe:
        "Remove '{{name}}()' — cancel the timer / interval by calling 'subscription.unsubscribe()' or use 'takeUntilDestroyed()' / 'take(1)'.",
      preferFromEvent:
        "Use RxJS 'fromEvent(target, event)' from 'rxjs' instead of '.addEventListener()'. Combine with 'takeUntilDestroyed()' for automatic cleanup.",
      preferFromEventRemove:
        "Remove '.removeEventListener()' — use 'fromEvent()' with 'takeUntilDestroyed()' to avoid ever needing to remove listeners manually.",
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        const { callee } = node;

        // ── Global timer calls ────────────────────────────────────────────────
        if (callee.type === 'Identifier') {
          const { name } = callee;
          if (name === 'setTimeout') {
            context.report({ node, messageId: 'preferTimer' });
            return;
          }
          if (name === 'setInterval') {
            context.report({ node, messageId: 'preferInterval' });
            return;
          }
          if (name === 'clearTimeout' || name === 'clearInterval') {
            context.report({ node, messageId: 'preferUnsubscribe', data: { name } });
            return;
          }
        }

        // ── Member calls: .addEventListener / .removeEventListener ────────────
        if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier') {
          const methodName = callee.property.name;
          if (methodName === 'addEventListener') {
            context.report({ node, messageId: 'preferFromEvent' });
            return;
          }
          if (methodName === 'removeEventListener') {
            context.report({ node, messageId: 'preferFromEventRemove' });
          }
        }
      },
    };
  },
};

module.exports = preferRxjsTimer;
