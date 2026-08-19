// @ts-check
'use strict';

/**
 * Prefers signalElementScrollState / signalHostElementScrollState from @ethlete/core
 * instead of raw scroll event listeners.
 *
 * The signal utilities:
 * - Set up a scroll event listener that keeps a reactive signal in sync
 * - Clean up automatically when the component is destroyed
 * - Provide debouncing and direction tracking built in
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

/** @type {import('eslint').Rule.RuleModule} */
const preferScrollState = {
  meta: {
    type: 'suggestion',
    docs: {
      description: "Prefer the scroll signal utilities from '@ethlete/core' over raw scroll event listeners.",
      recommended: true,
    },
    messages: {
      noScrollListener:
        "Do not add 'scroll' event listeners directly. Use 'signalElementScrollState(elementRef)' / 'signalHostElementScrollState()' for scroll state, 'signalElementLastScrollDirection(elementRef)' / 'signalHostElementLastScrollDirection()' for direction, or 'ScrollableComponent' from '@ethlete/components'.",
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
    };
  },
};

module.exports = preferScrollState;
