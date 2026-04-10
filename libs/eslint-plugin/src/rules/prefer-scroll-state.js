// @ts-check
'use strict';

/**
 * Prefers signalElementScrollState / signalHostElementScrollState from @ethlete/core
 * over imperatively reading scroll position properties inside reactive contexts,
 * and disallows adding raw scroll event listeners in favour of the same signal utilities.
 *
 * The signal utilities:
 * - Set up a scroll event listener that keeps a reactive signal in sync
 * - Clean up automatically when the component is destroyed
 * - Provide debouncing and direction tracking built in
 *
 * NOTE: The property-read check is a WARNING — imperative one-shot reads of
 * scrollTop/scrollLeft are fine in event handlers and animations; only flag
 * inside effect() / computed().
 *
 * BAD (reactive context):
 *   effect(() => {
 *     const top = this.el.nativeElement.scrollTop;  // stale snapshot ❌
 *   });
 *
 * BAD (scroll listeners — always wrong):
 *   el.addEventListener('scroll', fn);              // ❌
 *   fromEvent(el, 'scroll').subscribe(fn);          // ❌
 *   el.onscroll = fn;                               // ❌
 *
 * GOOD:
 *   scrollState = signalHostElementScrollState();        // from @ethlete/core
 *   scrollDir = signalHostElementLastScrollDirection();  // from @ethlete/core
 *   // Or use <et-scrollable> / ScrollableComponent for list scrolling
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
      noScrollListener:
        "Do not add 'scroll' event listeners directly. Use 'signalElementScrollState(elementRef)' / 'signalHostElementScrollState()' for scroll position or state, 'signalElementLastScrollDirection(elementRef)' / 'signalHostElementLastScrollDirection()' for scroll direction, or the 'ScrollableComponent' (et-scrollable) from '@ethlete/cdk' for scrollable lists. All are imported from '@ethlete/core' or '@ethlete/cdk'.",
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        const { callee } = node;
        const args = node.arguments;

        // ── el.addEventListener('scroll', fn) / window.addEventListener('scroll', fn) ──
        if (
          callee.type === 'MemberExpression' &&
          callee.property.type === 'Identifier' &&
          callee.property.name === 'addEventListener' &&
          args[0]?.type === 'Literal' &&
          args[0].value === 'scroll'
        ) {
          context.report({ node, messageId: 'noScrollListener' });
          return;
        }

        // ── fromEvent(el, 'scroll') ──────────────────────────────────────────
        if (
          callee.type === 'Identifier' &&
          callee.name === 'fromEvent' &&
          args[1]?.type === 'Literal' &&
          args[1].value === 'scroll'
        ) {
          context.report({ node, messageId: 'noScrollListener' });
          return;
        }

        // ── renderer.listen(el, 'scroll', fn) ───────────────────────────────
        if (
          callee.type === 'MemberExpression' &&
          callee.property.type === 'Identifier' &&
          callee.property.name === 'listen' &&
          args[1]?.type === 'Literal' &&
          args[1].value === 'scroll'
        ) {
          context.report({ node, messageId: 'noScrollListener' });
        }
      },

      AssignmentExpression(node) {
        // ── el.onscroll = fn ────────────────────────────────────────────────
        const { left } = node;
        if (
          left.type === 'MemberExpression' &&
          left.property.type === 'Identifier' &&
          left.property.name === 'onscroll'
        ) {
          context.report({ node, messageId: 'noScrollListener' });
        }
      },

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
