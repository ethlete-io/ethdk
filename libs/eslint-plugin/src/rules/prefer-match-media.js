// @ts-check
'use strict';

/**
 * Prefers the typed media-query signal utilities from @ethlete/core over
 * calling window.matchMedia() directly.
 *
 * The utilities:
 * - Return reactive signals that update when the media query result changes
 * - Are SSR-safe (no window access during server rendering)
 * - Are automatically cleaned up when the component is destroyed
 *
 * BAD:
 *   window.matchMedia('(prefers-color-scheme: dark)').matches
 *   const mq = window.matchMedia('(max-width: 768px)');
 *   mq.addEventListener('change', handler);
 *
 * GOOD:
 *   // For arbitrary media queries:
 *   const isDark = injectMediaQueryIsMatched('(prefers-color-scheme: dark)');
 *
 *   // For standard breakpoints:
 *   const isMobile = injectBreakpointIsMatched({ max: 'sm' });
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
        "Avoid 'window.matchMedia()' directly. Use 'injectMediaQueryIsMatched(query)' or a pre-built helper (injectCanHover, injectHasTouchInput, injectIsPortrait, injectBreakpointIsMatched, …) from '@ethlete/core' — they return reactive signals and are SSR-safe.",
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        const { callee } = node;
        if (callee.type !== 'MemberExpression') return;
        if (callee.property.type !== 'Identifier') return;
        if (callee.property.name !== 'matchMedia') return;

        // Flag any .matchMedia() call — the object is almost certainly window or
        // document.defaultView, but even a forwarded reference should be replaced.
        context.report({ node, messageId: 'preferMatchMedia' });
      },
    };
  },
};

module.exports = preferMatchMedia;
