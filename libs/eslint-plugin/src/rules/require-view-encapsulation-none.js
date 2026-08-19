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
const findAngularCoreImport = (sourceCode) => {
  const imports = sourceCode.ast.body.filter(
    (node) =>
      node.type === 'ImportDeclaration' && node.source.type === 'Literal' && node.source.value === '@angular/core',
  );

  return (
    imports.find((node) =>
      node.specifiers.some(
        (specifier) =>
          specifier.type === 'ImportSpecifier' &&
          specifier.imported.type === 'Identifier' &&
          specifier.imported.name === 'ViewEncapsulation',
      ),
    ) ??
    imports.find((node) => node.importKind !== 'type') ??
    null
  );
};

/**
 * @param {import('eslint').SourceCode} sourceCode
 * @param {any} importNode
 */
const buildAngularCoreImportFix = (sourceCode, importNode) => {
  const specifiers = importNode.specifiers ?? [];
  const hasViewEncapsulation = specifiers.some(
    (specifier) =>
      specifier.type === 'ImportSpecifier' &&
      specifier.imported.type === 'Identifier' &&
      specifier.imported.name === 'ViewEncapsulation',
  );
  if (hasViewEncapsulation) return null;

  const defaultSpecifier = specifiers.find((specifier) => specifier.type === 'ImportDefaultSpecifier') ?? null;
  const namespaceSpecifier = specifiers.find((specifier) => specifier.type === 'ImportNamespaceSpecifier') ?? null;
  const namedSpecifiers = specifiers.filter((specifier) => specifier.type === 'ImportSpecifier');

  if (namespaceSpecifier) {
    return (fixer) => fixer.insertTextAfter(importNode, `\nimport { ViewEncapsulation } from '@angular/core';`);
  }

  const importParts = [];
  if (defaultSpecifier) {
    importParts.push(sourceCode.getText(defaultSpecifier));
  }

  const namedTexts = namedSpecifiers.map((specifier) => sourceCode.getText(specifier));
  importParts.push(`{ ${[...namedTexts, 'ViewEncapsulation'].join(', ')} }`);

  return (fixer) => fixer.replaceText(importNode, `import ${importParts.join(', ')} from '@angular/core';`);
};

/**
 * @param {import('eslint').SourceCode} sourceCode
 */
const buildMissingAngularCoreImportFix = (sourceCode) => {
  const importDeclarations = sourceCode.ast.body.filter((node) => node.type === 'ImportDeclaration');
  const lastImport = importDeclarations[importDeclarations.length - 1] ?? null;

  if (lastImport) {
    return (fixer) => fixer.insertTextAfter(lastImport, `\nimport { ViewEncapsulation } from '@angular/core';`);
  }

  const firstNode = sourceCode.ast.body[0];
  const lastComment = firstNode ? sourceCode.getCommentsBefore(firstNode).at(-1) : null;

  return lastComment
    ? (fixer) => fixer.insertTextAfter(lastComment, `\nimport { ViewEncapsulation } from '@angular/core';\n`)
    : (fixer) =>
        fixer.replaceTextRange([0, firstNode?.range[0] ?? 0], `import { ViewEncapsulation } from '@angular/core';\n\n`);
};

/**
 * @param {any} metadata
 */
const getEncapsulationInsertionTarget = (metadata) => {
  if (metadata.properties.some((property) => property.type === 'SpreadElement')) return null;

  const encapsulationIndex = COMPONENT_ORDER.indexOf('encapsulation');

  return (
    metadata.properties.find((property) => {
      if (property.type !== 'Property') return false;

      const propertyName = getOrderKey(getPropertyName(property.key));
      const propertyIndex = propertyName === null ? COMPONENT_ORDER.length : COMPONENT_ORDER.indexOf(propertyName);
      return propertyIndex > encapsulationIndex || propertyIndex === -1;
    }) ?? null
  );
};

/**
 * @param {import('eslint').SourceCode} sourceCode
 * @param {any} metadata
 */
const buildMetadataFix = (sourceCode, metadata) => {
  const encText = 'encapsulation: ViewEncapsulation.None';
  const properties = metadata.properties;
  const insertionTarget = getEncapsulationInsertionTarget(metadata);
  const isMultiline = Boolean(metadata.loc && metadata.loc.start.line !== metadata.loc.end.line);

  if (properties.length === 0) {
    return (fixer) => fixer.replaceText(metadata, `{ ${encText} }`);
  }

  if (insertionTarget) {
    if (isMultiline) {
      const propertyIndent = getIndent(sourceCode, insertionTarget);
      return (fixer) => fixer.insertTextBefore(insertionTarget, `${encText},\n${propertyIndent}`);
    }

    return (fixer) => fixer.insertTextBefore(insertionTarget, `${encText}, `);
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
        `${separator}\n${propertyIndent}${encText}\n${closingIndent}`,
      );
  }

  const separator = hasTrailingComma(sourceCode, lastProperty) ? '' : ',';
  return (fixer) => fixer.replaceTextRange([lastProperty.range[1], closingBrace.range[0]], `${separator} ${encText} `);
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
    fixes.push((fixer) => fixer.replaceText(valueNode, 'ViewEncapsulation.None'));
  } else {
    const metadataFix = buildMetadataFix(sourceCode, metadata);
    if (metadataFix) fixes.push(metadataFix);
  }

  return (fixer) => fixes.map((applyFix) => applyFix(fixer));
};

/** @type {import('eslint').Rule.RuleModule} */
const requireViewEncapsulationNone = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require `encapsulation: ViewEncapsulation.None` in all @Component decorators.',
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

        const encProp = metadata.properties.find(
          (property) => property.type === 'Property' && getPropertyName(property.key) === 'encapsulation',
        );

        if (!encProp) {
          context.report({
            node: metadata,
            messageId: 'missing',
            fix: buildFix(sourceCode, metadata, null),
          });
          return;
        }

        const value = encProp.value;
        if (
          value.type === 'MemberExpression' &&
          value.object.type === 'Identifier' &&
          value.object.name === 'ViewEncapsulation' &&
          value.property.type === 'Identifier' &&
          value.property.name !== 'None'
        ) {
          context.report({
            node: value,
            messageId: 'notNone',
            data: { value: value.property.name },
            fix: buildFix(sourceCode, metadata, value),
          });
        }
      },
    };
  },
};

module.exports = requireViewEncapsulationNone;
