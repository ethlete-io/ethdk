// @ts-check
'use strict';

const { getAngularDecoratorName } = require('./internals/import-resolution');

const { getMetadataEntryRemovalRange } = require('./internals/angular-metadata-fix');

/** @typedef {'Component' | 'Directive' | 'Pipe'} TDecoratorName */

/**
 * @param {import('estree').Property['key']} key
 */
const getPropertyName = (key) => {
  if (key.type === 'Identifier') return key.name;
  if (key.type === 'Literal' && typeof key.value === 'string') return key.value;
  return null;
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
        const decoratorName = getAngularDecoratorName(context.sourceCode, node);
        if (decoratorName !== 'Component' && decoratorName !== 'Directive' && decoratorName !== 'Pipe') return;

        const decorator = /** @type {any} */ (node);
        const expression = decorator.expression;
        if (expression.type !== 'CallExpression' || expression.arguments.length === 0) return;

        const metadata = expression.arguments[0];
        if (!metadata || metadata.type !== 'ObjectExpression') return;

        for (const property of metadata.properties) {
          if (property.type !== 'Property') continue;
          if (getPropertyName(property.key) !== 'standalone') continue;
          if (property.value.type !== 'Literal' || property.value.value !== true) continue;

          context.report({
            node: property,
            messageId: 'noStandalone',
            fix(fixer) {
              return fixer.replaceTextRange(getMetadataEntryRemovalRange(sourceCode, metadata, property), '');
            },
          });
        }
      },
    };
  },
};

module.exports = noStandaloneFlag;
