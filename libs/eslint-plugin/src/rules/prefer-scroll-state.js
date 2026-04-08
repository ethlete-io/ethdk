// @ts-check
'use strict';

/**
 * Prefers signalElementScrollState / signalHostElementScrollState from @ethlete/core
 * over imperatively reading scroll position properties inside reactive contexts.
 *
 * The signal utilities:
 * - Set up a scroll event listener that keeps a reactive signal in sync
 * - Clean up automatically when the component is destroyed
 * - Provide debouncing and direction tracking built in
 *
 * NOTE: This rule is a WARNING (not an error). Imperative one-shot reads of
 * scrollTop/scrollLeft are perfectly valid in event handlers and animations.
 * The rule only fires inside effect() / computed().
 *
 * BAD (reactive context):
 *   effect(() => {
 *     const top = this.el.nativeElement.scrollTop;  // stale snapshot ❌
 *   });
 *
 * GOOD:
 *   scrollState = signalHostElementScrollState();  // from @ethlete/core
 *   effect(() => {
 *     const { scrollTop } = this.scrollState();   // ✅ reactive
 *   });
 *
 * For scroll direction:
 *   scrollDir = signalHostElementLastScrollDirection();  // from @ethlete/core
 */

/** Scroll position properties read from DOM elements. */
const SCROLL_PROPS = new Set(['scrollTop', 'scrollLeft', 'scrollY', 'scrollX']);

/**
 * Returns the name of the wrapping reactive context ('effect' | 'computed') if
 * the node is inside one, crossing at least one function boundary.
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

    if (
      crossedFunctionBoundary &&
      current.type === 'CallExpression' &&
      current.callee.type === 'Identifier' &&
      (current.callee.name === 'effect' || current.callee.name === 'computed')
    ) {
      return current.callee.name;
    }

    current = current.parent;
  }

  return null;
};

/** @type {import('eslint').Rule.RuleModule} */
const preferScrollState = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        "Prefer 'signalElementScrollState()' / 'signalHostElementScrollState()' from '@ethlete/core' over reading scroll position properties inside reactive contexts.",
      recommended: true,
    },
    messages: {
      preferScrollState:
        "Avoid reading '{{prop}}' inside {{context}}() — it creates a stale snapshot. Use 'signalElementScrollState(elementRef)' or 'signalHostElementScrollState()' from '@ethlete/core' instead. For scroll direction, use 'signalElementLastScrollDirection()' / 'signalHostElementLastScrollDirection()'.",
    },
    schema: [],
  },
  create(context) {
    return {
      MemberExpression(node) {
        if (node.property.type !== 'Identifier') return;
        if (!SCROLL_PROPS.has(node.property.name)) return;

        // Only flag reads (not assignments like el.scrollTop = 0).
        const parent = node.parent;
        if (parent && parent.type === 'AssignmentExpression' && parent.left === node) return;

        const reactiveCtx = getReactiveContext(node);
        if (!reactiveCtx) return;

        context.report({
          node,
          messageId: 'preferScrollState',
          data: { prop: node.property.name, context: reactiveCtx },
        });
      },
    };
  },
};

module.exports = preferScrollState;
