// @ts-check
'use strict';

/**
 * Requires @Component decorators to explicitly set `encapsulation: ViewEncapsulation.None`.
 *
 * The Ethlete styleguide mandates `ViewEncapsulation.None` for all components
 * because styles are managed globally via design tokens and CSS custom properties.
 * Emulated or ShadowDom encapsulation would interfere with this system.
 *
 * ❌ Missing the property entirely (default is Emulated):
 *   @Component({ selector: 'my-cmp', template: '' })
 *
 * ❌ Explicitly set to Emulated:
 *   @Component({ encapsulation: ViewEncapsulation.Emulated, ... })
 *
 * ❌ ShadowDom:
 *   @Component({ encapsulation: ViewEncapsulation.ShadowDom, ... })
 *
 * ✅ Correct:
 *   @Component({ encapsulation: ViewEncapsulation.None, ... })
 */

/** @type {import('eslint').Rule.RuleModule} */
const requireViewEncapsulationNone = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require `encapsulation: ViewEncapsulation.None` in all @Component decorators.',
    },
    messages: {
      missing: 'Add `encapsulation: ViewEncapsulation.None` to @Component. The default (Emulated) is not allowed.',
      notNone: '`encapsulation` must be `ViewEncapsulation.None`. Got `ViewEncapsulation.{{value}}`.',
    },
    schema: [],
  },
  create(context) {
    /**
     * Returns true if the node is a @Component decorator call.
     * @param {import('eslint').Rule.Node} node
     */
    const isComponentDecorator = (node) => {
      const dec = /** @type {any} */ (node);
      if (dec.type !== 'Decorator') return false;
      const expr = dec.expression;
      if (expr.type === 'CallExpression') return expr.callee.type === 'Identifier' && expr.callee.name === 'Component';
      if (expr.type === 'Identifier') return expr.name === 'Component';
      return false;
    };

    return {
      Decorator(node) {
        if (!isComponentDecorator(node)) return;

        const dec = /** @type {any} */ (node);
        const expr = dec.expression;
        if (expr.type !== 'CallExpression') return;

        const args = expr.arguments;
        if (!args || args.length === 0) return;

        const metadata = args[0];
        if (!metadata || metadata.type !== 'ObjectExpression') return;

        // Look for an `encapsulation` property
        const encProp = metadata.properties.find(
          (/** @type {any} */ p) =>
            p.type === 'Property' && p.key.type === 'Identifier' && p.key.name === 'encapsulation',
        );

        if (!encProp) {
          // Property absent — default is Emulated, which is not allowed
          context.report({ node: metadata, messageId: 'missing' });
          return;
        }

        // Must be ViewEncapsulation.None
        const val = /** @type {any} */ (encProp).value;
        if (
          val.type === 'MemberExpression' &&
          val.object.type === 'Identifier' &&
          val.object.name === 'ViewEncapsulation' &&
          val.property.type === 'Identifier'
        ) {
          if (val.property.name !== 'None') {
            context.report({
              node: val,
              messageId: 'notNone',
              data: { value: val.property.name },
            });
          }
          // .None — valid, do nothing
        }
        // If it's not a MemberExpression at all we don't flag it
        // (dynamic or unusual expression — let TypeScript catch it)
      },
    };
  },
};

module.exports = requireViewEncapsulationNone;
