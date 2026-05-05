// @ts-check
'use strict';

/** @typedef {'Component' | 'Directive'} TDecoratorName */

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

const MESSAGE_IDS = {
  hostDirectives: 'noEmptyHostDirectives',
  imports: 'noEmptyImports',
};

/** @type {import('eslint').Rule.RuleModule} */
const noEmptyAngularMetadataArrays = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow empty Angular metadata arrays such as imports: [] and hostDirectives: [].',
    },
    fixable: 'code',
    schema: [],
    messages: {
      noEmptyImports: 'Remove empty imports: [] from Angular metadata.',
      noEmptyHostDirectives: 'Remove empty hostDirectives: [] from Angular metadata.',
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      /** @param {import('eslint').Rule.Node} node */
      Decorator(node) {
        const decoratorName = getDecoratorName(node);
        if (decoratorName !== 'Component' && decoratorName !== 'Directive') return;

        const decorator = /** @type {any} */ (node);
        const expression = decorator.expression;
        if (expression.type !== 'CallExpression' || expression.arguments.length === 0) return;

        const metadata = expression.arguments[0];
        if (!metadata || metadata.type !== 'ObjectExpression') return;

        for (const property of metadata.properties) {
          if (property.type !== 'Property') continue;

          const propertyName = getPropertyName(property.key);
          if (propertyName !== 'imports' && propertyName !== 'hostDirectives') continue;
          if (property.value.type !== 'ArrayExpression' || property.value.elements.length > 0) continue;

          context.report({
            node: property,
            messageId: MESSAGE_IDS[propertyName],
            fix(fixer) {
              return fixer.replaceTextRange(getRemovalRange(sourceCode, metadata, property), '');
            },
          });
        }
      },
    };
  },
};

module.exports = noEmptyAngularMetadataArrays;
