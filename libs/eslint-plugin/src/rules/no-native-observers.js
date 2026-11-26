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

const { isGlobalReference } = require('./internals/import-resolution');

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

const GLOBAL_OBJECTS = new Set(['window', 'globalThis', 'self']);

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
    const { sourceCode } = context;

    /**
     * @param {any} node
     * @param {Set<any>} seen
     * @returns {string | null}
     */
    const resolveObserverName = (node, seen = new Set()) => {
      if (!node || seen.has(node)) return null;
      seen.add(node);

      if (node.type === 'TSNonNullExpression' || node.type === 'TSAsExpression') {
        return resolveObserverName(node.expression, seen);
      }

      if (node.type === 'MemberExpression') {
        if (node.computed || node.property.type !== 'Identifier') return null;
        if (!Object.hasOwn(OBSERVER_ALTERNATIVES, node.property.name)) return null;

        return node.object.type === 'Identifier' &&
          GLOBAL_OBJECTS.has(node.object.name) &&
          isGlobalReference(sourceCode, node.object)
          ? node.property.name
          : null;
      }

      if (node.type !== 'Identifier') return null;

      if (isGlobalReference(sourceCode, node)) {
        // hasOwn, not `in`: `new constructor()` / `new toString()` would otherwise match an
        // inherited Object.prototype key and read a function where an entry is expected
        return Object.hasOwn(OBSERVER_ALTERNATIVES, node.name) ? node.name : null;
      }

      /** @type {import('eslint').Scope.Scope | null} */
      let scope = sourceCode.getScope(node);

      while (scope) {
        const variable = scope.set.get(node.name);

        if (variable) {
          const definition = /** @type {any} */ (variable.defs[0]);

          return definition?.type === 'Variable' && definition.parent.kind === 'const'
            ? resolveObserverName(definition.node.init, seen)
            : null;
        }

        scope = scope.upper;
      }

      return null;
    };

    /**
     * @param {any} node
     * @param {any} callee
     */
    const check = (node, callee) => {
      const name = resolveObserverName(callee);

      if (!name) return;

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
    };

    return {
      NewExpression(node) {
        check(node, node.callee);
      },
      'ClassDeclaration, ClassExpression'(node) {
        if (node.superClass) check(node.superClass, node.superClass);
      },
    };
  },
};

module.exports = noNativeObservers;
