// @ts-check
'use strict';

/**
 * Checks that a `loadComponent:` route property:
 *  1. Imports from a path containing "-view"
 *  2. Accesses a class name ending in "ViewComponent" in the .then() callback
 *
 * Valid pattern:
 *   loadComponent: () => import('./items-list-view/items-list-view.component').then((m) => m.ItemsListViewComponent)
 */

/** @type {import('eslint').Rule.RuleModule} */
const enforceRoutingViewNaming = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Routing components must import from a path containing "-view" and use a class name ending in "ViewComponent".',
    },
    messages: {
      pathMustContainView: 'Routing import path must contain "-view". Got: "{{path}}".',
      classMustEndWithViewComponent: 'Routing component class must end with "ViewComponent". Got: "{{name}}".',
    },
    schema: [],
  },
  create(context) {
    return {
      Property(node) {
        const key = /** @type {any} */ (node).key;
        if (key.type !== 'Identifier' || key.name !== 'loadComponent') return;

        // Must be an arrow function: () => import(...).then(m => m.XxxViewComponent)
        const arrow = /** @type {any} */ (node).value;
        if (!arrow || arrow.type !== 'ArrowFunctionExpression') return;

        const body = arrow.body;
        if (!body || body.type !== 'CallExpression') return;

        const callee = body.callee;
        if (!callee || callee.type !== 'MemberExpression') return;
        if (callee.property.type !== 'Identifier' || callee.property.name !== 'then') return;

        // Check the import path contains "-view"
        const importExpr = callee.object;
        if (importExpr && importExpr.type === 'ImportExpression') {
          const source = importExpr.source;
          if (source && source.type === 'Literal' && typeof source.value === 'string') {
            if (!source.value.includes('-view')) {
              context.report({
                node: source,
                messageId: 'pathMustContainView',
                data: { path: source.value },
              });
            }
          }
        }

        // Check the class name in .then(m => m.XxxViewComponent)
        const args = body.arguments;
        if (!args || args.length === 0) return;

        const callback = args[0];
        if (!callback || callback.type !== 'ArrowFunctionExpression') return;

        const cbBody = callback.body;
        if (!cbBody || cbBody.type !== 'MemberExpression') return;

        const prop = cbBody.property;
        if (!prop || prop.type !== 'Identifier') return;

        if (!prop.name.endsWith('ViewComponent')) {
          context.report({
            node: prop,
            messageId: 'classMustEndWithViewComponent',
            data: { name: prop.name },
          });
        }
      },
    };
  },
};

module.exports = enforceRoutingViewNaming;
