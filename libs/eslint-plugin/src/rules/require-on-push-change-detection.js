// @ts-check
'use strict';

const COMPONENT_ORDER = ['selector', 'template', 'styleUrl', 'encapsulation', 'changeDetection'];

/**
 * @param {import('estree').Property['key']} key
 */
const getPropertyName = (key) => {
  if (key.type === 'Identifier') return key.name;
  if (key.type === 'Literal' && typeof key.value === 'string') return key.value;
  return null;
};

/**
 * @param {string | null} propertyName
 */
const getOrderKey = (propertyName) => {
  if (propertyName === 'template' || propertyName === 'templateUrl') return 'template';
  if (propertyName === 'styleUrl' || propertyName === 'styleUrls') return 'styleUrl';
  return propertyName;
};

/**
 * @param {import('eslint').SourceCode} sourceCode
 * @param {import('eslint').AST.Token | import('eslint').Rule.Node} node
 */
const getIndent = (sourceCode, node) => {
  if (!node.loc) return '';

  const line = sourceCode.lines[node.loc.start.line - 1] ?? '';
  return line.slice(0, node.loc.start.column);
};

/**
 * @param {import('eslint').SourceCode} sourceCode
 * @param {any} property
 */
const hasTrailingComma = (sourceCode, property) => {
  const tokenAfter = sourceCode.getTokenAfter(property);
  return Boolean(tokenAfter && tokenAfter.type === 'Punctuator' && tokenAfter.value === ',');
};

/**
 * @param {import('eslint').SourceCode} sourceCode
 */
const findAngularCoreImport = (sourceCode) =>
  sourceCode.ast.body.find(
    (node) =>
      node.type === 'ImportDeclaration' && node.source.type === 'Literal' && node.source.value === '@angular/core',
  ) ?? null;

/**
 * @param {import('eslint').SourceCode} sourceCode
 * @param {any} importNode
 */
const buildAngularCoreImportFix = (sourceCode, importNode) => {
  const specifiers = importNode.specifiers ?? [];
  const hasChangeDetectionStrategy = specifiers.some(
    (specifier) =>
      specifier.type === 'ImportSpecifier' &&
      specifier.imported.type === 'Identifier' &&
      specifier.imported.name === 'ChangeDetectionStrategy',
  );
  if (hasChangeDetectionStrategy) return null;

  const defaultSpecifier = specifiers.find((specifier) => specifier.type === 'ImportDefaultSpecifier') ?? null;
  const namespaceSpecifier = specifiers.find((specifier) => specifier.type === 'ImportNamespaceSpecifier') ?? null;
  const namedSpecifiers = specifiers.filter((specifier) => specifier.type === 'ImportSpecifier');

  if (namespaceSpecifier) {
    return (fixer) => fixer.insertTextAfter(importNode, `\nimport { ChangeDetectionStrategy } from '@angular/core';`);
  }

  const importParts = [];
  if (defaultSpecifier) {
    importParts.push(sourceCode.getText(defaultSpecifier));
  }

  const namedTexts = namedSpecifiers.map((specifier) => sourceCode.getText(specifier));
  importParts.push(`{ ${[...namedTexts, 'ChangeDetectionStrategy'].join(', ')} }`);

  return (fixer) => fixer.replaceText(importNode, `import ${importParts.join(', ')} from '@angular/core';`);
};

/**
 * @param {import('eslint').SourceCode} sourceCode
 */
const buildMissingAngularCoreImportFix = (sourceCode) => {
  const importDeclarations = sourceCode.ast.body.filter((node) => node.type === 'ImportDeclaration');
  const lastImport = importDeclarations[importDeclarations.length - 1] ?? null;

  return lastImport
    ? (fixer) => fixer.insertTextAfter(lastImport, `\nimport { ChangeDetectionStrategy } from '@angular/core';`)
    : (fixer) =>
        fixer.replaceTextRange(
          [0, sourceCode.ast.range[0]],
          `import { ChangeDetectionStrategy } from '@angular/core';\n\n`,
        );
};

/**
 * @param {any} metadata
 */
const getChangeDetectionInsertionTarget = (metadata) => {
  const changeDetectionIndex = COMPONENT_ORDER.indexOf('changeDetection');

  return (
    metadata.properties.find((property) => {
      if (property.type !== 'Property') return false;

      const propertyName = getOrderKey(getPropertyName(property.key));
      const propertyIndex = propertyName === null ? COMPONENT_ORDER.length : COMPONENT_ORDER.indexOf(propertyName);
      return propertyIndex > changeDetectionIndex || propertyIndex === -1;
    }) ?? null
  );
};

/**
 * @param {import('eslint').SourceCode} sourceCode
 * @param {any} metadata
 */
const buildMetadataFix = (sourceCode, metadata) => {
  const changeDetectionText = 'changeDetection: ChangeDetectionStrategy.OnPush';
  const properties = metadata.properties.filter((property) => property.type === 'Property');
  const insertionTarget = getChangeDetectionInsertionTarget(metadata);
  const isMultiline = Boolean(metadata.loc && metadata.loc.start.line !== metadata.loc.end.line);

  if (properties.length === 0) {
    return (fixer) => fixer.replaceText(metadata, `{ ${changeDetectionText} }`);
  }

  if (insertionTarget) {
    if (isMultiline) {
      const propertyIndent = getIndent(sourceCode, insertionTarget);
      return (fixer) => fixer.insertTextBefore(insertionTarget, `${changeDetectionText},\n${propertyIndent}`);
    }

    return (fixer) => fixer.insertTextBefore(insertionTarget, `${changeDetectionText}, `);
  }

  const lastProperty = properties[properties.length - 1];
  const closingBrace = sourceCode.getLastToken(metadata);
  if (!lastProperty || !closingBrace) return null;

  if (isMultiline) {
    const closingIndent = getIndent(sourceCode, closingBrace);
    const propertyIndent = getIndent(sourceCode, lastProperty);
    const separator = hasTrailingComma(sourceCode, lastProperty) ? '' : ',';
    const rangeStart =
      separator === ''
        ? (sourceCode.getTokenAfter(lastProperty)?.range[1] ?? lastProperty.range[1])
        : lastProperty.range[1];

    return (fixer) =>
      fixer.replaceTextRange(
        [rangeStart, closingBrace.range[0]],
        `${separator}\n${propertyIndent}${changeDetectionText}\n${closingIndent}`,
      );
  }

  const separator = hasTrailingComma(sourceCode, lastProperty) ? '' : ',';
  return (fixer) =>
    fixer.replaceTextRange([lastProperty.range[1], closingBrace.range[0]], `${separator} ${changeDetectionText} `);
};

/**
 * @param {import('eslint').SourceCode} sourceCode
 * @param {any} metadata
 * @param {any} valueNode
 */
const buildFix = (sourceCode, metadata, valueNode) => {
  const fixes = [];
  const angularCoreImport = findAngularCoreImport(sourceCode);
  const importFix = angularCoreImport
    ? buildAngularCoreImportFix(sourceCode, angularCoreImport)
    : buildMissingAngularCoreImportFix(sourceCode);

  if (importFix) fixes.push(importFix);

  if (valueNode) {
    fixes.push((fixer) => fixer.replaceText(valueNode, 'ChangeDetectionStrategy.OnPush'));
  } else {
    const metadataFix = buildMetadataFix(sourceCode, metadata);
    if (metadataFix) fixes.push(metadataFix);
  }

  return (fixer) => fixes.map((applyFix) => applyFix(fixer));
};

/** @type {import('eslint').Rule.RuleModule} */
const requireOnPushChangeDetection = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require `changeDetection: ChangeDetectionStrategy.OnPush` in all @Component decorators.',
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
    const sourceCode = context.sourceCode;

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

    return {
      Decorator(node) {
        if (!isComponentDecorator(node)) return;

        const decorator = /** @type {any} */ (node);
        const expression = decorator.expression;
        if (expression.type !== 'CallExpression' || expression.arguments.length === 0) return;

        const metadata = expression.arguments[0];
        if (!metadata || metadata.type !== 'ObjectExpression') return;

        const changeDetectionProp = metadata.properties.find(
          (property) =>
            property.type === 'Property' &&
            property.key.type === 'Identifier' &&
            property.key.name === 'changeDetection',
        );

        if (!changeDetectionProp) {
          context.report({
            node: metadata,
            messageId: 'missing',
            fix: buildFix(sourceCode, metadata, null),
          });
          return;
        }

        const value = changeDetectionProp.value;
        if (
          value.type === 'MemberExpression' &&
          value.object.type === 'Identifier' &&
          value.object.name === 'ChangeDetectionStrategy' &&
          value.property.type === 'Identifier' &&
          value.property.name !== 'OnPush'
        ) {
          context.report({
            node: value,
            messageId: 'notOnPush',
            data: { value: value.property.name },
            fix: buildFix(sourceCode, metadata, value),
          });
        }
      },
    };
  },
};

module.exports = requireOnPushChangeDetection;
