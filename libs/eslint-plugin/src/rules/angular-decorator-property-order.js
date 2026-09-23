// @ts-check
'use strict';

const { getAngularDecoratorName } = require('./internals/import-resolution');

/** @typedef {'Component' | 'Directive'} TDecoratorName */
/** @typedef {{ order: string[]; orderText: string }} TDecoratorConfig */
/** @typedef {{ range: [number, number] }} TNodeWithRange */
/** @typedef {import('estree').Property & TNodeWithRange} TPropertyNode */
/** @typedef {import('estree').SpreadElement & TNodeWithRange} TSpreadElementNode */
/** @typedef {import('estree').ObjectExpression & TNodeWithRange & { properties: Array<TPropertyNode | TSpreadElementNode> }} TObjectExpressionNode */
/** @typedef {{ hasComma: boolean; originalIndex: number; orderIndex: number; property: TPropertyNode; segmentText: string }} TPropertyEntry */

/** @type {Record<TDecoratorName, TDecoratorConfig>} */
const DECORATOR_CONFIG = {
  Component: {
    order: [
      'selector',
      'standalone',
      'template',
      'styleUrl',
      'encapsulation',
      'changeDetection',
      'imports',
      'deferredImports',
      'providers',
      'viewProviders',
      'animations',
      'hostDirectives',
      'host',
      'styles',
      'inputs',
      'outputs',
      'queries',
      'preserveWhitespaces',
      'interpolation',
      'schemas',
      'jit',
      'exportAs',
    ],
    orderText:
      'selector, standalone, template/templateUrl, styleUrl/styleUrls, encapsulation, changeDetection, imports, deferredImports, providers, viewProviders, animations, hostDirectives, host, styles, inputs, outputs, queries, preserveWhitespaces, interpolation, schemas, jit, exportAs',
  },
  Directive: {
    order: [
      'selector',
      'standalone',
      'exportAs',
      'providers',
      'inputs',
      'outputs',
      'queries',
      'hostDirectives',
      'host',
      'jit',
    ],
    orderText: 'selector, standalone, exportAs, providers, inputs, outputs, queries, hostDirectives, host, jit',
  },
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
 * @param {TDecoratorName} decoratorName
 * @param {string | null} propertyName
 */
const getOrderKey = (decoratorName, propertyName) => {
  if (propertyName === null) return null;

  if (decoratorName === 'Component') {
    if (propertyName === 'template' || propertyName === 'templateUrl') return 'template';
    if (propertyName === 'styleUrl' || propertyName === 'styleUrls') return 'styleUrl';
  }

  return propertyName;
};

/** @type {import('eslint').Rule.RuleModule} */
const angularDecoratorPropertyOrder = {
  meta: {
    type: 'layout',
    docs: {
      description: 'Require a consistent property order in Angular @Component and @Directive metadata objects.',
    },
    fixable: 'code',
    messages: {
      outOfOrder: '{{decorator}} metadata properties should be ordered as: {{order}}.',
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      /** @param {import('eslint').Rule.Node} node */
      Decorator(node) {
        const decoratorName = getAngularDecoratorName(context.sourceCode, node);
        if (decoratorName !== 'Component' && decoratorName !== 'Directive') return;

        const decorator = /** @type {any} */ (node);
        const expression = decorator.expression;
        if (expression.type !== 'CallExpression' || expression.arguments.length === 0) return;

        const metadata = /** @type {TObjectExpressionNode | undefined} */ (expression.arguments[0]);
        if (!metadata || metadata.type !== 'ObjectExpression' || metadata.properties.length < 2) return;

        if (
          metadata.properties.some(
            /** @param {TPropertyNode | TSpreadElementNode} property */ (property) => property.type !== 'Property',
          )
        )
          return;

        const config = DECORATOR_CONFIG[decoratorName];
        const orderIndexMap = new Map(
          config.order.map(/** @param {string} value @param {number} index */ (value, index) => [value, index]),
        );
        const openingBrace = sourceCode.getFirstToken(metadata);
        const closingBrace = sourceCode.getLastToken(metadata);

        if (!openingBrace || !closingBrace || openingBrace.value !== '{' || closingBrace.value !== '}') return;

        let segmentStart = openingBrace.range[1];

        const entries = metadata.properties.map(
          /** @param {TPropertyNode | TSpreadElementNode} property @param {number} originalIndex @returns {TPropertyEntry} */
          (property, originalIndex) => {
            const propertyNode = /** @type {TPropertyNode} */ (property);
            const propertyName = getPropertyName(propertyNode.key);
            const orderKey = getOrderKey(decoratorName, propertyName);
            const orderIndex =
              orderKey === null ? config.order.length : (orderIndexMap.get(orderKey) ?? config.order.length);
            const tokenAfter = sourceCode.getTokenAfter(propertyNode);
            const hasComma = Boolean(tokenAfter && tokenAfter.type === 'Punctuator' && tokenAfter.value === ',');
            const segmentEnd = hasComma && tokenAfter ? tokenAfter.range[0] : propertyNode.range[1];
            const segmentText = sourceCode.text.slice(segmentStart, segmentEnd);

            if (hasComma && tokenAfter) {
              segmentStart = tokenAfter.range[1];
            } else {
              segmentStart = propertyNode.range[1];
            }

            return {
              hasComma,
              originalIndex,
              orderIndex,
              property: propertyNode,
              segmentText,
            };
          },
        );

        const trailingComma = entries[entries.length - 1].hasComma;
        const suffix = sourceCode.text.slice(segmentStart, closingBrace.range[0]);
        const sortedEntries = [...entries].sort(
          /** @param {TPropertyEntry} left @param {TPropertyEntry} right */ (left, right) => {
            if (left.orderIndex !== right.orderIndex) return left.orderIndex - right.orderIndex;
            return left.originalIndex - right.originalIndex;
          },
        );

        const isSorted = entries.every(
          /** @param {TPropertyEntry} entry @param {number} index */ (entry, index) =>
            entry.property === sortedEntries[index].property,
        );
        if (isSorted) return;

        const firstMismatch = entries.find(
          /** @param {TPropertyEntry} entry @param {number} index */ (entry, index) =>
            entry.property !== sortedEntries[index].property,
        );

        context.report({
          node: firstMismatch ? firstMismatch.property : metadata,
          messageId: 'outOfOrder',
          data: {
            decorator: `@${decoratorName}`,
            order: config.orderText,
          },
          fix(fixer) {
            const reorderedBody =
              sortedEntries
                .map(
                  (entry, index) =>
                    `${entry.segmentText}${index < sortedEntries.length - 1 || trailingComma ? ',' : ''}`,
                )
                .join('') + suffix;

            return fixer.replaceTextRange([openingBrace.range[1], closingBrace.range[0]], reorderedBody);
          },
        });
      },
    };
  },
};

module.exports = angularDecoratorPropertyOrder;
