// @ts-check
'use strict';

/**
 * Prefers signalElementDimensions / signalHostElementDimensions from @ethlete/core
 * over imperatively reading element size properties inside reactive contexts
 * (effect(), computed(), or signal initializers).
 *
 * Why: reading `.getBoundingClientRect()`, `.offsetWidth`, `.clientWidth`, etc.
 * inside a reactive context creates a one-shot snapshot that never updates. The
 * signal utilities set up a ResizeObserver-backed reactive signal that stays in
 * sync automatically and cleans itself up when the component is destroyed.
 *
 * NOTE: This rule is a WARNING (not an error) because imperative one-shot reads
 * (e.g. inside animation callbacks, event handlers) are perfectly valid. The rule
 * only fires when the read is inside a reactive context.
 *
 * BAD (reactive context):
 *   effect(() => {
 *     const w = this.el.nativeElement.offsetWidth;   // stale after resize ❌
 *   });
 *
 *   computed(() => someEl.getBoundingClientRect().width);  // ❌
 *
 * GOOD:
 *   dimensions = signalHostElementDimensions();  // from @ethlete/core
 *   // or
 *   dimensions = signalElementDimensions(inject(ElementRef));
 *   // Then:
 *   effect(() => { const w = this.dimensions().rect.width; }); // ✅ reactive
 */

/** Size-related properties read from DOM elements. */
const ELEMENT_SIZE_PROPS = new Set([
  'offsetWidth',
  'offsetHeight',
  'clientWidth',
  'clientHeight',
  'scrollWidth',
  'scrollHeight',
]);

/** Size-related methods called on DOM elements. */
const ELEMENT_SIZE_METHODS = new Set(['getBoundingClientRect', 'getClientRects']);

/**
 * Returns the name of the wrapping reactive context ('effect' | 'computed') if
 * the node is inside one, crossing exactly one function boundary.
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
const preferElementDimensions = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        "Prefer 'signalElementDimensions()' or 'signalHostElementDimensions()' from '@ethlete/core' over reading element size properties inside reactive contexts.",
      recommended: true,
    },
    messages: {
      preferElementDimensions:
        "Avoid reading '{{prop}}' inside {{context}}() — it creates a stale snapshot. Use 'signalElementDimensions(elementRef)' or 'signalHostElementDimensions()' from '@ethlete/core' instead — they provide a reactive signal backed by ResizeObserver.",
    },
    schema: [],
  },
  create(context) {
    return {
      // el.offsetWidth, el.clientWidth, etc.
      MemberExpression(node) {
        if (node.property.type !== 'Identifier') return;
        if (!ELEMENT_SIZE_PROPS.has(node.property.name)) return;

        const reactiveCtx = getReactiveContext(node);
        if (!reactiveCtx) return;

        context.report({
          node,
          messageId: 'preferElementDimensions',
          data: { prop: node.property.name, context: reactiveCtx },
        });
      },

      // el.getBoundingClientRect(), el.getClientRects()
      CallExpression(node) {
        const { callee } = node;
        if (callee.type !== 'MemberExpression') return;
        if (callee.property.type !== 'Identifier') return;
        if (!ELEMENT_SIZE_METHODS.has(callee.property.name)) return;

        const reactiveCtx = getReactiveContext(node);
        if (!reactiveCtx) return;

        context.report({
          node,
          messageId: 'preferElementDimensions',
          data: { prop: callee.property.name + '()', context: reactiveCtx },
        });
      },
    };
  },
};

module.exports = preferElementDimensions;
