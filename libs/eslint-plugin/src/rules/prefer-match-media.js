// @ts-check
'use strict';

/**
 * Prefers the typed media-query signal utilities from @ethlete/core over
 * calling window.matchMedia() directly or using Angular CDK's BreakpointObserver.
 *
 * The utilities:
 * - Offer both one-shot boolean reads and reactive signals
 * - Are SSR-safe (no window access during server rendering)
 * - Are automatically cleaned up when the component is destroyed
 *
 * BAD:
 *   window.matchMedia('(prefers-color-scheme: dark)').matches
 *   const mq = window.matchMedia('(max-width: 768px)');
 *   mq.addEventListener('change', handler);
 *   inject(BreakpointObserver);
 *   import { BreakpointObserver } from '@angular/cdk/layout';
 *
 * GOOD:
 *   // For arbitrary media queries:
 *   const isDark = injectMediaQueryIsMatched('(prefers-color-scheme: dark)');
 *
 *   // For standard breakpoints:
 *   const isMobile = injectBreakpointIsMatched({ max: 'sm' });
 *
 *   // For reactive BreakpointObserver access:
 *   const bo = injectBreakpointObserver();  // from @ethlete/core
 *
 *   // For common checks that are pre-built:
 *   const canHover       = injectCanHover();
 *   const hasTouchInput  = injectHasTouchInput();
 *   const isPortrait     = injectIsPortrait();
 *   const isLandscape    = injectIsLandscape();
 *   const isXs           = injectIsXs();
 *   const isSm           = injectIsSm();
 *   // … etc. All from @ethlete/core.
 */

const { MODULE_REFERENCE_SELECTOR, getModuleReference, isImportedAs } = require('./internals/import-resolution');

const CDK_LAYOUT = '@angular/cdk/layout';

/** @type {import('eslint').Rule.RuleModule} */
const preferMatchMedia = {
  meta: {
    type: 'suggestion',
    docs: {
      description: "Prefer reactive media-query signal utilities from '@ethlete/core' over 'window.matchMedia()'.",
      recommended: true,
    },
    messages: {
      preferMatchMedia:
        "Avoid 'window.matchMedia()' directly. Use 'injectMediaQueryIsMatched(query)' for a one-shot SSR-safe boolean, or 'injectObserveMediaQuery(query)' when the result must update reactively.",
      noBreakpointObserver:
        "Do not use Angular CDK's 'BreakpointObserver' directly. Use 'injectBreakpointObserver()' from '@ethlete/core' instead, which wraps it with a reactive signal API and proper DI scoping.",
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        const { callee } = node;

        // ── window.matchMedia() ───────────────────────────────────────────────
        if (
          callee.type === 'MemberExpression' &&
          callee.property.type === 'Identifier' &&
          callee.property.name === 'matchMedia'
        ) {
          // Flag any .matchMedia() call — the object is almost certainly window or
          // document.defaultView, but even a forwarded reference should be replaced.
          context.report({ node, messageId: 'preferMatchMedia' });
          return;
        }

        // ── inject(BreakpointObserver) ────────────────────────────────────────
        if (
          isImportedAs(context.sourceCode, callee, 'inject') &&
          isImportedAs(context.sourceCode, node.arguments[0], 'BreakpointObserver', CDK_LAYOUT)
        ) {
          context.report({ node, messageId: 'noBreakpointObserver' });
        }
      },

      [MODULE_REFERENCE_SELECTOR](node) {
        const reference = getModuleReference(node);
        if (reference?.source !== CDK_LAYOUT) return;
        if (reference.named.some((entry) => entry.name === 'BreakpointObserver')) {
          context.report({ node, messageId: 'noBreakpointObserver' });
        }
      },
    };
  },
};

module.exports = preferMatchMedia;
