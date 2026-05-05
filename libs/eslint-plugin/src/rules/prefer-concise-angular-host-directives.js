// @ts-check
'use strict';

/** @typedef {'Component' | 'Directive'} TDecoratorName */
/** @typedef {import('estree').Property & { range: [number, number] }} TPropertyNode */
/** @typedef {import('estree').ArrayExpression & { elements: Array<import('estree').Expression | import('estree').SpreadElement | null> }} TArrayExpressionNode */
/** @typedef {import('estree').ObjectExpression & { properties: Array<TPropertyNode | import('estree').SpreadElement> }} TObjectExpressionNode */
/** @typedef {{ hasComma: boolean; originalIndex: number; orderIndex: number; property: TPropertyNode; segmentText: string }} TPropertyEntry */

const HOST_DIRECTIVE_PROPERTY_ORDER = ['directive', 'inputs', 'outputs'];

/**
 * @param {import('eslint').Rule.Node} node
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
 * @param {import('estree').Property['key']} key
 */
const getPropertyName = (key) => {
  if (key.type === 'Identifier') return key.name;
  if (key.type === 'Literal' && typeof key.value === 'string') return key.value;
  return null;
};

/**
 * @param {TDecoratorName} decoratorName
 * @param {import('estree').Node} node
 */
const getHostDirectivesArray = (decoratorName, node) => {
  const decorator = /** @type {any} */ (node);
  const expression = decorator.expression;
  if (expression.type !== 'CallExpression' || expression.arguments.length === 0) return null;

  const metadata = expression.arguments[0];
  if (!metadata || metadata.type !== 'ObjectExpression') return null;

  for (const property of metadata.properties) {
    if (!property || property.type !== 'Property') continue;
    if (getPropertyName(property.key) !== 'hostDirectives') continue;
    if (property.value.type !== 'ArrayExpression') return null;

    return /** @type {TArrayExpressionNode} */ (property.value);
  }

  return null;
};

/**
 * @param {TObjectExpressionNode} node
 */
const getHostDirectiveConfigProperties = (node) => {
  if (
    node.properties.some(
      /** @param {TPropertyNode | import('estree').SpreadElement} property */ (property) =>
        property.type !== 'Property',
    )
  ) {
    return null;
  }

  const properties = /** @type {TPropertyNode[]} */ (node.properties);
  const names = properties.map((property) => getPropertyName(property.key));

  if (names.some((name) => name === null || !HOST_DIRECTIVE_PROPERTY_ORDER.includes(name))) {
    return null;
  }

  return properties;
};

/**
 * @param {TObjectExpressionNode} node
 * @param {import('eslint').SourceCode} sourceCode
 */
const buildSortedObjectText = (node, sourceCode) => {
  const properties = getHostDirectiveConfigProperties(node);
  if (!properties || properties.length < 2) return null;

  const openingBrace = sourceCode.getFirstToken(node);
  const closingBrace = sourceCode.getLastToken(node);
  if (!openingBrace || !closingBrace || openingBrace.value !== '{' || closingBrace.value !== '}') return null;

  let segmentStart = openingBrace.range[1];
  const orderIndexMap = new Map(HOST_DIRECTIVE_PROPERTY_ORDER.map((value, index) => [value, index]));

  const entries = properties.map(
    /** @param {TPropertyNode} property @param {number} originalIndex @returns {TPropertyEntry} */
    (property, originalIndex) => {
      const tokenAfter = sourceCode.getTokenAfter(property);
      const hasComma = Boolean(tokenAfter && tokenAfter.type === 'Punctuator' && tokenAfter.value === ',');
      const segmentEnd = hasComma && tokenAfter ? tokenAfter.range[0] : property.range[1];
      const segmentText = sourceCode.text.slice(segmentStart, segmentEnd);

      if (hasComma && tokenAfter) {
        segmentStart = tokenAfter.range[1];
      } else {
        segmentStart = property.range[1];
      }

      return {
        hasComma,
        originalIndex,
        orderIndex: orderIndexMap.get(getPropertyName(property.key)) ?? HOST_DIRECTIVE_PROPERTY_ORDER.length,
        property,
        segmentText,
      };
    },
  );

  const trailingComma = entries[entries.length - 1].hasComma;
  const suffix = sourceCode.text.slice(segmentStart, closingBrace.range[0]);
  const sortedEntries = [...entries].sort((left, right) => {
    if (left.orderIndex !== right.orderIndex) return left.orderIndex - right.orderIndex;
    return left.originalIndex - right.originalIndex;
  });

  const isSorted = entries.every((entry, index) => entry.property === sortedEntries[index].property);
  if (isSorted) return null;

  return (
    '{' +
    sortedEntries
      .map((entry, index) => `${entry.segmentText}${index < sortedEntries.length - 1 || trailingComma ? ',' : ''}`)
      .join('') +
    suffix +
    '}'
  );
};

/**
 * @param {TObjectExpressionNode} node
 */
const hasOnlyDirectiveProperty = (node) => {
  const properties = getHostDirectiveConfigProperties(node);
  if (!properties || properties.length !== 1) return false;

  return getPropertyName(properties[0].key) === 'directive';
};

/**
 * @param {TObjectExpressionNode} node
 */
const getDirectiveValueNode = (node) => {
  const properties = getHostDirectiveConfigProperties(node);
  if (!properties || properties.length !== 1) return null;

  const property = properties[0];
  if (getPropertyName(property.key) !== 'directive') return null;

  return property.value;
};

/** @type {import('eslint').Rule.RuleModule} */
const preferConciseAngularHostDirectives = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Prefer shorthand hostDirectives entries when only directive is needed, and keep extended host directive configs ordered as directive, inputs, outputs.',
      recommended: true,
    },
    fixable: 'code',
    schema: [],
    messages: {
      preferShorthand: 'Use the directive directly in hostDirectives when no inputs or outputs are forwarded.',
      hostDirectiveOrder: 'Extended hostDirectives entries should order properties as directive, inputs, outputs.',
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      Decorator(node) {
        const decoratorName = getDecoratorName(node);
        if (decoratorName !== 'Component' && decoratorName !== 'Directive') return;

        const hostDirectives = getHostDirectivesArray(decoratorName, node);
        if (!hostDirectives) return;

        for (const element of hostDirectives.elements) {
          if (!element || element.type !== 'ObjectExpression') continue;

          const config = /** @type {TObjectExpressionNode} */ (element);
          const properties = getHostDirectiveConfigProperties(config);
          if (!properties) continue;

          if (hasOnlyDirectiveProperty(config)) {
            const directiveValue = getDirectiveValueNode(config);
            if (!directiveValue) continue;

            context.report({
              node: config,
              messageId: 'preferShorthand',
              fix: (fixer) => fixer.replaceText(config, sourceCode.getText(directiveValue)),
            });

            continue;
          }

          const sortedObjectText = buildSortedObjectText(config, sourceCode);
          if (!sortedObjectText) continue;

          context.report({
            node: config,
            messageId: 'hostDirectiveOrder',
            fix: (fixer) => fixer.replaceText(config, sortedObjectText),
          });
        }
      },
    };
  },
};

module.exports = preferConciseAngularHostDirectives;
