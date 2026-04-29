// @ts-check
'use strict';

/** @typedef {import('estree').Property} TPropertyNode */
/** @typedef {import('estree').Expression | import('estree').SpreadElement | null} TArrayElement */

/**
 * @param {import('eslint').Rule.Node} node
 */
const isComponentDecorator = (node) => {
  const decorator = /** @type {any} */ (node);
  if (decorator.type !== 'Decorator') return false;

  const expression = decorator.expression;
  if (expression.type === 'CallExpression') {
    return expression.callee.type === 'Identifier' && expression.callee.name === 'Component';
  }

  return expression.type === 'Identifier' && expression.name === 'Component';
};

/**
 * @param {import('estree').Property['key']} key
 */
const getPropertyName = (key) => {
  if (key.type === 'Identifier') return key.name;
  if (key.type === 'Literal' && typeof key.value === 'string') return key.value;
  return null;
};

/**
 * @param {TPropertyNode} property
 * @returns {import('estree').Expression | null}
 */
const getSingleArrayElement = (property) => {
  if (property.value.type !== 'ArrayExpression' || property.value.elements.length !== 1) return null;

  const firstElement = /** @type {TArrayElement} */ (property.value.elements[0]);
  if (!firstElement || firstElement.type === 'SpreadElement') return null;

  return firstElement;
};

/** @type {import('eslint').Rule.RuleModule} */
const preferConciseAngularStyleMetadata = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Prefer `styleUrl` over single-item `styleUrls`, and avoid wrapping a single `styles` entry in an array.',
    },
    fixable: 'code',
    messages: {
      preferStyleUrl: 'Use `styleUrl` instead of `styleUrls` when there is only one style path.',
      preferSingleStyle: 'Use `styles: <value>` instead of a single-item `styles` array.',
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      /** @param {import('eslint').Rule.Node} node */
      Decorator(node) {
        if (!isComponentDecorator(node)) return;

        const decorator = /** @type {any} */ (node);
        const expression = decorator.expression;
        if (expression.type !== 'CallExpression' || expression.arguments.length === 0) return;

        const metadata = expression.arguments[0];
        if (!metadata || metadata.type !== 'ObjectExpression') return;

        for (const property of metadata.properties) {
          if (property.type !== 'Property') continue;

          const propertyName = getPropertyName(property.key);
          if (propertyName !== 'styleUrls' && propertyName !== 'styles') continue;

          const singleElement = getSingleArrayElement(property);
          if (!singleElement) continue;

          if (propertyName === 'styleUrls') {
            context.report({
              node: property,
              messageId: 'preferStyleUrl',
              fix(fixer) {
                return fixer.replaceText(property, `styleUrl: ${sourceCode.getText(singleElement)}`);
              },
            });

            continue;
          }

          context.report({
            node: property,
            messageId: 'preferSingleStyle',
            fix(fixer) {
              return fixer.replaceText(property, `styles: ${sourceCode.getText(singleElement)}`);
            },
          });
        }
      },
    };
  },
};

module.exports = preferConciseAngularStyleMetadata;
