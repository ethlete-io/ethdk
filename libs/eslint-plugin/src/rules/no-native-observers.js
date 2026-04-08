// @ts-check
'use strict';

/**
 * Disallows raw browser Observer APIs (IntersectionObserver, MutationObserver,
 * ResizeObserver, PerformanceObserver). Use the signal-based utilities from
 * @ethlete/core instead.
 *
 * The signal utilities:
 * - Integrate automatically with Angular's reactivity model
 * - Tear down the observer when the component is destroyed (no memory leaks)
 * - Are composable with other signals and computed()
 * - Require no manual disconnect() calls
 *
 * BAD:
 *   new IntersectionObserver(cb, options)
 *   new MutationObserver(cb)
 *   new ResizeObserver(cb)
 *
 * GOOD:
 *   // IntersectionObserver → from @ethlete/core
 *   signalElementIntersection(elementRef, options)
 *   signalHostElementIntersection(options)   // shortcut inside a directive/component
 *
 *   // MutationObserver → from @ethlete/core
 *   signalElementMutations(elementRef, options)
 *   signalHostElementMutations(options)
 *
 *   // ResizeObserver → from @ethlete/core
 *   signalElementDimensions(elementRef)
 *   signalHostElementDimensions()
 */

/**
 * Maps Observer constructor names to their @ethlete/core signal equivalents.
 * @type {Record<string, { alternatives: string[], from: string } | null>}
 */
const OBSERVER_ALTERNATIVES = {
  IntersectionObserver: {
    alternatives: ['signalElementIntersection', 'signalHostElementIntersection'],
    from: '@ethlete/core',
  },
  MutationObserver: {
    alternatives: ['signalElementMutations', 'signalHostElementMutations'],
    from: '@ethlete/core',
  },
  ResizeObserver: {
    alternatives: ['signalElementDimensions', 'signalHostElementDimensions'],
    from: '@ethlete/core',
  },
  PerformanceObserver: null,
};

/** @type {import('eslint').Rule.RuleModule} */
const noNativeObservers = {
  meta: {
    type: 'suggestion',
    docs: {
      description: "Disallow raw browser Observer APIs. Use signal-based utilities from '@ethlete/core' instead.",
      recommended: true,
    },
    messages: {
      useSignalUtil:
        "Use '{{alternatives}}' from '{{from}}' instead of 'new {{observer}}()'. The signal utility auto-cleans up when the component is destroyed.",
      avoidObserver:
        "Avoid 'new {{observer}}()'. Prefer a reactive signal utility from '@ethlete/core' where possible, or ensure you call disconnect() in inject(DestroyRef).onDestroy().",
    },
    schema: [],
  },
  create(context) {
    return {
      NewExpression(node) {
        if (node.callee.type !== 'Identifier') return;

        const name = node.callee.name;
        if (!(name in OBSERVER_ALTERNATIVES)) return;

        const info = OBSERVER_ALTERNATIVES[name];

        if (info) {
          context.report({
            node,
            messageId: 'useSignalUtil',
            data: {
              observer: name,
              alternatives: info.alternatives.join(' or '),
              from: info.from,
            },
          });
        } else {
          context.report({
            node,
            messageId: 'avoidObserver',
            data: { observer: name },
          });
        }
      },
    };
  },
};

module.exports = noNativeObservers;
