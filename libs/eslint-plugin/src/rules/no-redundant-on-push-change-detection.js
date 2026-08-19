// @ts-check
'use strict';

const { getMetadataEntryRemovalRange } = require('./internals/angular-metadata-fix');

/**
 * Disallow explicit `changeDetection: ChangeDetectionStrategy.OnPush` on
 * `@Component` decorators. Since Angular 22, OnPush is the default change
 * detection strategy, so declaring it is redundant noise.
 *
 * The rule is version-aware: it only activates when the workspace's installed
 * Angular is v22 or newer (or when the version cannot be determined). On older
 * Angular versions — where OnPush is NOT the default — it stays silent so that
 * removing it would not change behaviour.
 *
 * BAD (Angular >= 22):
 *   @Component({ selector: 'et-x', template: '', changeDetection: ChangeDetectionStrategy.OnPush })
 *
 * GOOD (Angular >= 22):
 *   @Component({ selector: 'et-x', template: '' })
 */

const REQUIRED_MAJOR = 22;

/** @type {number | null | undefined} */
let cachedAngularMajor;

/**
 * Detect the workspace's installed Angular major version. Cached across files.
 *
 * @returns {number | null} major version, or null when it cannot be determined
 */
const detectAngularMajor = () => {
  if (cachedAngularMajor !== undefined) return cachedAngularMajor;

  try {
    const pkg = require('@angular/core/package.json');
    const major = Number.parseInt(String(pkg.version).split('.')[0], 10);
    cachedAngularMajor = Number.isNaN(major) ? null : major;
  } catch {
    cachedAngularMajor = null;
  }

  return cachedAngularMajor;
};

/**
 * Resolve the Angular major version to gate on. An explicit
 * `settings.ethlete.angularMajor` wins over auto-detection — handy for
 * pinning behaviour and for tests.
 *
 * @param {import('eslint').Rule.RuleContext} context
 * @returns {number | null}
 */
const getAngularMajor = (context) => {
  const settings = /** @type {any} */ (context.settings);
  const override = settings?.ethlete?.angularMajor;
  if (typeof override === 'number') return override;

  return detectAngularMajor();
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
 * @param {any} value
 */
const isOnPushValue = (value, localName) =>
  value.type === 'MemberExpression' &&
  value.object.type === 'Identifier' &&
  value.object.name === localName &&
  value.property.type === 'Identifier' &&
  value.property.name === 'OnPush';

/**
 * Range that removes a single named import specifier together with its comma.
 *
 * @param {import('eslint').SourceCode} sourceCode
 * @param {any} importNode
 * @param {any} specifier
 */
const getSpecifierRemovalRange = (sourceCode, importNode, specifier) => {
  const named = importNode.specifiers.filter((entry) => entry.type === 'ImportSpecifier');
  const index = named.indexOf(specifier);

  // Sole specifier of the whole import — drop the entire declaration.
  if (importNode.specifiers.length === 1) return importNode.range;
  if (named.length === 1) {
    const openingBrace = sourceCode.getTokenBefore(specifier, (token) => token.value === '{');
    const closingBrace = sourceCode.getTokenAfter(specifier, (token) => token.value === '}');
    const precedingComma = openingBrace ? sourceCode.getTokenBefore(openingBrace) : null;

    if (openingBrace && closingBrace && precedingComma?.value === ',') {
      return [precedingComma.range[0], closingBrace.range[1]];
    }
  }
  if (index < named.length - 1) return [specifier.range[0], named[index + 1].range[0]];

  return [named[index - 1].range[1], specifier.range[1]];
};

/**
 * True when every reference of the `ChangeDetectionStrategy` binding is a
 * `changeDetection: ChangeDetectionStrategy.OnPush` property value — i.e.
 * removing those properties leaves the import unused and safe to drop.
 *
 * @param {import('eslint').Scope.Reference} reference
 * @param {Set<any>} removableIdentifiers
 */
const isOnPushChangeDetectionReference = (reference, removableIdentifiers) =>
  removableIdentifiers.has(reference.identifier);

/** @type {import('eslint').Rule.RuleModule} */
const noRedundantOnPushChangeDetection = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow redundant `changeDetection: ChangeDetectionStrategy.OnPush`. OnPush is the default since Angular 22.',
    },
    fixable: 'code',
    schema: [],
    messages: {
      redundant:
        '`changeDetection: ChangeDetectionStrategy.OnPush` is redundant. OnPush is the default change detection strategy since Angular 22.',
      redundantImport:
        'Remove the now-unused `ChangeDetectionStrategy` import. OnPush is the default change detection strategy since Angular 22.',
    },
  },
  create(context) {
    // Only enforce on Angular >= 22, where OnPush is the default. Stay silent on
    // older versions (removing it there would change behaviour) — but enforce
    // when the version is unknown, since this workspace targets modern Angular.
    const angularMajor = getAngularMajor(context);
    if (angularMajor !== null && angularMajor < REQUIRED_MAJOR) return {};

    const sourceCode = context.sourceCode;
    /** @type {any} */
    let changeDetectionSpecifier = null;
    let changeDetectionLocalName = 'ChangeDetectionStrategy';
    const removableIdentifiers = new Set();

    return {
      Decorator(node) {
        if (!isComponentDecorator(node)) return;

        const expression = /** @type {any} */ (node).expression;
        if (expression.type !== 'CallExpression' || expression.arguments.length === 0) return;

        const metadata = expression.arguments[0];
        if (!metadata || metadata.type !== 'ObjectExpression') return;

        const property = metadata.properties.find(
          (entry) => entry.type === 'Property' && getPropertyName(entry.key) === 'changeDetection',
        );
        if (!property || !isOnPushValue(property.value, changeDetectionLocalName)) return;
        removableIdentifiers.add(property.value.object);

        context.report({
          node: property,
          messageId: 'redundant',
          fix: (fixer) => fixer.replaceTextRange(getMetadataEntryRemovalRange(sourceCode, metadata, property), ''),
        });
      },

      ImportDeclaration(node) {
        if (node.source.value !== '@angular/core') return;

        for (const specifier of node.specifiers) {
          if (
            specifier.type === 'ImportSpecifier' &&
            specifier.imported.type === 'Identifier' &&
            specifier.imported.name === 'ChangeDetectionStrategy'
          ) {
            changeDetectionSpecifier = specifier;
            changeDetectionLocalName = specifier.local.name;
            return;
          }
        }
      },

      'Program:exit'() {
        if (!changeDetectionSpecifier) return;

        const [variable] = sourceCode.getDeclaredVariables(changeDetectionSpecifier);
        if (!variable) return;
        if (
          !variable.references.every((reference) => isOnPushChangeDetectionReference(reference, removableIdentifiers))
        ) {
          return;
        }

        const importNode = changeDetectionSpecifier.parent;
        context.report({
          node: changeDetectionSpecifier,
          messageId: 'redundantImport',
          fix: (fixer) =>
            fixer.replaceTextRange(getSpecifierRemovalRange(sourceCode, importNode, changeDetectionSpecifier), ''),
        });
      },
    };
  },
};

module.exports = noRedundantOnPushChangeDetection;
