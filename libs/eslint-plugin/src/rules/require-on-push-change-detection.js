// @ts-check
'use strict';

const { getAngularMajor } = require('./internals/angular-version');
const { buildRequiredEnumFix, getPropertyName } = require('./internals/angular-metadata-fix');
const { getAngularDecoratorName, isImportedAs } = require('./internals/import-resolution');

const MAX_MAJOR = 21;

const SPEC = { property: 'changeDetection', importName: 'ChangeDetectionStrategy', member: 'OnPush' };

/** @type {import('eslint').Rule.RuleModule} */
const requireOnPushChangeDetection = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require `changeDetection: ChangeDetectionStrategy.OnPush` in all @Component decorators.',
      recommended: true,
    },
    fixable: 'code',
    messages: {
      missing:
        'Add `changeDetection: ChangeDetectionStrategy.OnPush` to @Component. Default change detection is not allowed.',
      notOnPush: '`changeDetection` must be `ChangeDetectionStrategy.OnPush`. Got `ChangeDetectionStrategy.{{value}}`.',
    },
    schema: [],
  },
  create(context) {
    // Only enforce on Angular <= 21, where OnPush is opt-in. On v22+ (or when
    // the version is unknown — this workspace targets modern Angular) stay
    // silent so no-redundant-on-push-change-detection owns the metadata.
    const angularMajor = getAngularMajor(context);
    if (angularMajor === null || angularMajor > MAX_MAJOR) return {};

    const sourceCode = context.sourceCode;

    return {
      Decorator(node) {
        if (getAngularDecoratorName(sourceCode, node) !== 'Component') return;

        const decorator = /** @type {any} */ (node);
        const expression = decorator.expression;
        if (expression.type !== 'CallExpression' || expression.arguments.length === 0) return;

        const metadata = expression.arguments[0];
        if (!metadata || metadata.type !== 'ObjectExpression') return;

        const changeDetectionProp = metadata.properties.find(
          (property) => property.type === 'Property' && getPropertyName(property.key) === 'changeDetection',
        );

        if (!changeDetectionProp) {
          context.report({
            node: metadata,
            messageId: 'missing',
            fix: buildRequiredEnumFix(sourceCode, metadata, null, SPEC),
          });
          return;
        }

        const value = changeDetectionProp.value;
        if (
          value.type === 'MemberExpression' &&
          isImportedAs(sourceCode, value.object, 'ChangeDetectionStrategy') &&
          value.property.type === 'Identifier' &&
          value.property.name !== 'OnPush'
        ) {
          context.report({
            node: value,
            messageId: 'notOnPush',
            data: { value: value.property.name },
            fix: buildRequiredEnumFix(sourceCode, metadata, value, SPEC),
          });
        }
      },
    };
  },
};

module.exports = requireOnPushChangeDetection;
