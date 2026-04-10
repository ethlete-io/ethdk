// @ts-check
'use strict';

/**
 * Prefers injectViewportSize() from @ethlete/core over reading raw viewport
 * dimensions from the global window object.
 *
 * injectViewportSize() returns a reactive signal that:
 * - Updates automatically when the viewport is resized
 * - Works on the server (SSR-safe)
 * - Participates in Angular's change detection
 *
 * BAD:
 *   const w = window.innerWidth;
 *   document.defaultView?.innerHeight
 *
 * GOOD:
 *   const viewport = injectViewportSize(); // from @ethlete/core
 *   const w = viewport().width;
 *   const h = viewport().height;
 */

/** Properties on window that report viewport dimensions. */
const VIEWPORT_PROPERTIES = new Set([
  'innerWidth',
  'innerHeight',
  'outerWidth',
  'outerHeight',
  'screen', // window.screen.width / window.screen.height
]);

/** @type {import('eslint').Rule.RuleModule} */
const preferViewportSize = {
  meta: {
    type: 'suggestion',
    docs: {
      description: "Prefer 'injectViewportSize()' from '@ethlete/core' over direct window dimension properties.",
      recommended: true,
    },
    messages: {
      preferViewportSize:
        "Avoid reading '{{prop}}' directly from window. Use 'injectViewportSize()' from '@ethlete/core' — it returns a reactive signal that stays up to date as the viewport resizes.",
    },
    schema: [],
  },
  create(context) {
    return {
      MemberExpression(node) {
        if (node.property.type !== 'Identifier') return;
        if (!VIEWPORT_PROPERTIES.has(node.property.name)) return;

        // Only flag when the object is clearly a window-like reference.
        const obj = node.object;
        const objText = context.sourceCode.getText(obj).toLowerCase();

        const isWindowRef =
          objText === 'window' ||
          objText.endsWith('.defaultview') ||
          objText.endsWith('?.defaultview') ||
          // document.defaultView without optional chain
          /defaultview$/.test(objText);

        if (!isWindowRef) return;

        context.report({
          node,
          messageId: 'preferViewportSize',
          data: { prop: node.property.name },
        });
      },
    };
  },
};

module.exports = preferViewportSize;
