// @ts-check
'use strict';

/** @typedef {'Component' | 'Directive' | 'Pipe'} TDecoratorName */

/**
 * @param {import('estree').Property['key']} key
 */
const getPropertyName = (key) => {
  if (key.type === 'Identifier') return key.name;
  if (key.type === 'Literal' && typeof key.value === 'string') return key.value;
  return null;
};

/**
 * @param {import('eslint').Rule.Node} node
 * @returns {TDecoratorName | null}
 */
const getDecoratorName = (node) => {
  const decorator = /** @type {any} */ (node);
  if (decorator.type !== 'Decorator') return null;

  const expression = decorator.expression;
  if (expression.type === 'CallExpression') {
    return expression.callee.type === 'Identifier' ? expression.callee.name : null;
  }

  return expression.type === 'Identifier' ? expression.name : null;
};

/**
 * @param {import('eslint').SourceCode} sourceCode
 * @param {any} metadata
 * @param {any} property
 */
const getRemovalRange = (sourceCode, metadata, property) => {
  const properties = metadata.properties.filter((entry) => entry.type === 'Property');
  const propertyIndex = properties.indexOf(property);
  const openingBrace = sourceCode.getFirstToken(metadata);
  const closingBrace = sourceCode.getLastToken(metadata);

  if (!openingBrace || !closingBrace) return property.range;
  if (properties.length === 1) return [openingBrace.range[1], closingBrace.range[0]];
  if (propertyIndex < properties.length - 1) return [property.range[0], properties[propertyIndex + 1].range[0]];

  return [properties[propertyIndex - 1].range[1], property.range[1]];
};

/** @type {import('eslint').Rule.RuleModule} */
const noStandaloneFlag = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow standalone metadata on Angular decorators because standalone is the default and should be omitted.',
    },
    fixable: 'code',
    schema: [],
    messages: {
      noStandalone: 'Remove standalone from Angular metadata. Standalone is implicit and should not be declared.',
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      Decorator(node) {
        const decoratorName = getDecoratorName(node);
        if (decoratorName !== 'Component' && decoratorName !== 'Directive' && decoratorName !== 'Pipe') return;

        const decorator = /** @type {any} */ (node);
        const expression = decorator.expression;
        if (expression.type !== 'CallExpression' || expression.arguments.length === 0) return;

        const metadata = expression.arguments[0];
        if (!metadata || metadata.type !== 'ObjectExpression') return;

        for (const property of metadata.properties) {
          if (property.type !== 'Property') continue;
          if (getPropertyName(property.key) !== 'standalone') continue;

          context.report({
            node: property,
            messageId: 'noStandalone',
            fix(fixer) {
              return fixer.replaceTextRange(getRemovalRange(sourceCode, metadata, property), '');
            },
          });
        }
      },
    };
  },
};

module.exports = noStandaloneFlag;
