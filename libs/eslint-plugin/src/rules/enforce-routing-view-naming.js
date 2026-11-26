// @ts-check
'use strict';

/**
 * Checks that a `loadComponent:` property of a route object (one with a `path` key):
 *  1. Imports from a path containing "-view"
 *  2. Accesses a class name ending in "ViewComponent" in the .then() callback
 *
 * Valid pattern:
 *   loadComponent: () => import('./items-list-view/items-list-view.component').then((m) => m.ItemsListViewComponent)
 */

const VIEW_PATH = /-view(?![\w-])/;

/** @param {any} objectNode */
const isRoute = (objectNode) =>
  objectNode?.type === 'ObjectExpression' &&
  objectNode.properties.some(
    /** @param {any} prop */ (prop) =>
      prop.type === 'Property' &&
      !prop.computed &&
      ((prop.key.type === 'Identifier' && prop.key.name === 'path') ||
        (prop.key.type === 'Literal' && prop.key.value === 'path')),
  );

/** @type {import('eslint').Rule.RuleModule} */
const enforceRoutingViewNaming = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Routing components must import from a path containing "-view" and use a class name ending in "ViewComponent".',
      recommended: true,
    },
    messages: {
      pathMustContainView: 'Routing import path must contain "-view". Got: "{{path}}".',
      classMustEndWithViewComponent: 'Routing component class must end with "ViewComponent". Got: "{{name}}".',
    },
    schema: [],
  },
  create(context) {
    /** @param {any} importExpr */
    const checkImportPath = (importExpr) => {
      if (!importExpr || importExpr.type !== 'ImportExpression') return;

      const source = importExpr.source;
      if (source && source.type === 'Literal' && typeof source.value === 'string' && !VIEW_PATH.test(source.value)) {
        context.report({
          node: source,
          messageId: 'pathMustContainView',
          data: { path: source.value },
        });
      }
    };

    return {
      Property(node) {
        const key = /** @type {any} */ (node).key;
        if (key.type !== 'Identifier' || key.name !== 'loadComponent') return;
        if (!isRoute(/** @type {any} */ (node).parent)) return;

        const arrow = /** @type {any} */ (node).value;
        if (!arrow || arrow.type !== 'ArrowFunctionExpression') return;

        const body = arrow.body;
        if (!body) return;

        if (body.type === 'ImportExpression') {
          checkImportPath(body);
          return;
        }

        if (body.type !== 'CallExpression') return;

        const callee = body.callee;
        if (!callee || callee.type !== 'MemberExpression') return;
        if (callee.property.type !== 'Identifier' || callee.property.name !== 'then') return;

        checkImportPath(callee.object);

        const callback = body.arguments?.[0];
        if (!callback || callback.type !== 'ArrowFunctionExpression') return;

        const cbBody = callback.body;
        const returned =
          cbBody?.type === 'BlockStatement'
            ? cbBody.body.find(/** @param {any} statement */ (statement) => statement.type === 'ReturnStatement')
                ?.argument
            : cbBody;
        if (!returned || returned.type !== 'MemberExpression') return;

        const prop = returned.property;
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
