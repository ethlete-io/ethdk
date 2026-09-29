// @ts-check
'use strict';

const { buildRequiredEnumFix, getPropertyName } = require('./internals/angular-metadata-fix');
const { getAngularDecoratorName, isImportedAs } = require('./internals/import-resolution');

const SPEC = { property: 'encapsulation', importName: 'ViewEncapsulation', member: 'None' };

/** @type {import('eslint').Rule.RuleModule} */
const requireViewEncapsulationNone = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require `encapsulation: ViewEncapsulation.None` in all @Component decorators.',
      recommended: true,
    },
    fixable: 'code',
    messages: {
      missing: 'Add `encapsulation: ViewEncapsulation.None` to @Component. The default (Emulated) is not allowed.',
      notNone: '`encapsulation` must be `ViewEncapsulation.None`. Got `ViewEncapsulation.{{value}}`.',
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      Decorator(node) {
        if (getAngularDecoratorName(sourceCode, node) !== 'Component') return;

        const decorator = /** @type {any} */ (node);
        const expression = decorator.expression;
        if (expression.type !== 'CallExpression' || expression.arguments.length === 0) return;

        const metadata = expression.arguments[0];
        if (!metadata || metadata.type !== 'ObjectExpression') return;

        const encProp = metadata.properties.find(
          (property) => property.type === 'Property' && getPropertyName(property.key) === 'encapsulation',
        );

        if (!encProp) {
          context.report({
            node: metadata,
            messageId: 'missing',
            fix: buildRequiredEnumFix(sourceCode, metadata, null, SPEC),
          });
          return;
        }

        const value = encProp.value;
        if (
          value.type === 'MemberExpression' &&
          isImportedAs(sourceCode, value.object, 'ViewEncapsulation') &&
          value.property.type === 'Identifier' &&
          value.property.name !== 'None'
        ) {
          context.report({
            node: value,
            messageId: 'notNone',
            data: { value: value.property.name },
            fix: buildRequiredEnumFix(sourceCode, metadata, value, SPEC),
          });
        }
      },
    };
  },
};

module.exports = requireViewEncapsulationNone;
