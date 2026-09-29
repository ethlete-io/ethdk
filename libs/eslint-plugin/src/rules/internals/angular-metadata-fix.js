// @ts-check
'use strict';

const { ANGULAR_CORE, getImportLocalName, resolveIdentifier } = require('./import-resolution');

/** @typedef {{ property: string; importName: string; member: string }} TRequiredEnumProperty */

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
 * @param {string} importName
 */
const findAngularCoreImport = (sourceCode, importName) => {
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
          specifier.imported.name === importName,
      ),
    ) ??
    imports.find((node) => node.importKind !== 'type') ??
    null
  );
};

/**
 * @param {import('eslint').SourceCode} sourceCode
 * @param {any} importNode
 * @param {string} importName
 */
const buildAngularCoreImportFix = (sourceCode, importNode, importName) => {
  const specifiers = importNode.specifiers ?? [];
  const hasImport = specifiers.some(
    (specifier) =>
      specifier.type === 'ImportSpecifier' &&
      specifier.imported.type === 'Identifier' &&
      specifier.imported.name === importName,
  );
  if (hasImport) return null;

  const defaultSpecifier = specifiers.find((specifier) => specifier.type === 'ImportDefaultSpecifier') ?? null;
  const namespaceSpecifier = specifiers.find((specifier) => specifier.type === 'ImportNamespaceSpecifier') ?? null;
  const namedSpecifiers = specifiers.filter((specifier) => specifier.type === 'ImportSpecifier');

  if (namespaceSpecifier) {
    return (fixer) => fixer.insertTextAfter(importNode, `\nimport { ${importName} } from '@angular/core';`);
  }

  const lastNamed = namedSpecifiers.at(-1);

  if (lastNamed) {
    const isMultiline = importNode.loc.start.line !== importNode.loc.end.line;
    const indent = /^\s*/.exec(sourceCode.lines[lastNamed.loc.start.line - 1] ?? '')?.[0] ?? '';
    const startsLine = sourceCode.lines[lastNamed.loc.start.line - 1].trim().startsWith(sourceCode.getText(lastNamed));

    return (fixer) =>
      fixer.insertTextAfter(lastNamed, isMultiline && startsLine ? `,\n${indent}${importName}` : `, ${importName}`);
  }

  const importParts = [];
  if (defaultSpecifier) {
    importParts.push(sourceCode.getText(defaultSpecifier));
  }

  const namedTexts = namedSpecifiers.map((specifier) => sourceCode.getText(specifier));
  importParts.push(`{ ${[...namedTexts, importName].join(', ')} }`);

  return (fixer) => fixer.replaceText(importNode, `import ${importParts.join(', ')} from '@angular/core';`);
};

/**
 * @param {import('eslint').SourceCode} sourceCode
 * @param {string} importName
 */
const buildMissingAngularCoreImportFix = (sourceCode, importName) => {
  const importDeclarations = sourceCode.ast.body.filter((node) => node.type === 'ImportDeclaration');
  const lastImport = importDeclarations[importDeclarations.length - 1] ?? null;

  if (lastImport) {
    return (fixer) => fixer.insertTextAfter(lastImport, `\nimport { ${importName} } from '@angular/core';`);
  }

  const firstNode = sourceCode.ast.body[0];
  const lastComment = firstNode ? sourceCode.getCommentsBefore(firstNode).at(-1) : null;

  return lastComment
    ? (fixer) => fixer.insertTextAfter(lastComment, `\nimport { ${importName} } from '@angular/core';\n`)
    : (fixer) =>
        fixer.replaceTextRange([0, firstNode?.range[0] ?? 0], `import { ${importName} } from '@angular/core';\n\n`);
};

/**
 * @param {any} metadata
 * @param {string} propertyKey
 */
const getInsertionTarget = (metadata, propertyKey) => {
  if (metadata.properties.some((property) => property.type === 'SpreadElement')) return null;

  const anchorIndex = COMPONENT_ORDER.indexOf(propertyKey);

  return (
    metadata.properties.find((property) => {
      if (property.type !== 'Property') return false;

      const propertyName = getOrderKey(getPropertyName(property.key));
      const propertyIndex = propertyName === null ? COMPONENT_ORDER.length : COMPONENT_ORDER.indexOf(propertyName);
      return propertyIndex > anchorIndex || propertyIndex === -1;
    }) ?? null
  );
};

/**
 * @param {import('eslint').SourceCode} sourceCode
 * @param {any} metadata
 * @param {TRequiredEnumProperty} spec
 */
const buildMetadataFix = (sourceCode, metadata, spec) => {
  const propertyText = `${spec.property}: ${getImportLocalName(sourceCode, ANGULAR_CORE, spec.importName) ?? spec.importName}.${spec.member}`;
  const properties = metadata.properties;
  const insertionTarget = getInsertionTarget(metadata, spec.property);
  const isMultiline = Boolean(metadata.loc && metadata.loc.start.line !== metadata.loc.end.line);

  if (properties.length === 0) {
    return (fixer) => fixer.replaceText(metadata, `{ ${propertyText} }`);
  }

  if (insertionTarget) {
    if (isMultiline) {
      const propertyIndent = getIndent(sourceCode, insertionTarget);
      return (fixer) => fixer.insertTextBefore(insertionTarget, `${propertyText},\n${propertyIndent}`);
    }

    return (fixer) => fixer.insertTextBefore(insertionTarget, `${propertyText}, `);
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
        `${separator}\n${propertyIndent}${propertyText}\n${closingIndent}`,
      );
  }

  const separator = hasTrailingComma(sourceCode, lastProperty) ? '' : ',';
  return (fixer) =>
    fixer.replaceTextRange([lastProperty.range[1], closingBrace.range[0]], `${separator} ${propertyText} `);
};

/**
 * @param {import('eslint').SourceCode} sourceCode
 * @param {any} metadata
 * @param {any} valueNode
 * @param {TRequiredEnumProperty} spec
 */
const buildRequiredEnumFix = (sourceCode, metadata, valueNode, spec) => {
  const valueFix =
    valueNode &&
    ((/** @type {import('eslint').Rule.RuleFixer} */ fixer) => fixer.replaceText(valueNode.property, spec.member));
  if (valueNode && valueNode.object.type !== 'Identifier') return valueFix;
  if (valueNode && resolveIdentifier(sourceCode, valueNode.object)?.source) return valueFix;

  const fixes = [];
  const angularCoreImport = findAngularCoreImport(sourceCode, spec.importName);
  const importFix = angularCoreImport
    ? buildAngularCoreImportFix(sourceCode, angularCoreImport, spec.importName)
    : buildMissingAngularCoreImportFix(sourceCode, spec.importName);

  if (importFix) fixes.push(importFix);

  const metadataFix = valueFix ?? buildMetadataFix(sourceCode, metadata, spec);
  if (metadataFix) fixes.push(metadataFix);

  return (/** @type {import('eslint').Rule.RuleFixer} */ fixer) => fixes.map((applyFix) => applyFix(fixer));
};

/**
 * @param {import('eslint').SourceCode} sourceCode
 * @param {any} metadata
 * @param {any} property
 */
const getMetadataEntryRemovalRange = (sourceCode, metadata, property) => {
  const entries = metadata.properties;
  const index = entries.indexOf(property);
  const openingBrace = sourceCode.getFirstToken(metadata);
  const closingBrace = sourceCode.getLastToken(metadata);

  if (!openingBrace || !closingBrace || index === -1) return property.range;
  if (entries.length === 1) return [openingBrace.range[1], closingBrace.range[0]];
  if (index < entries.length - 1) return [property.range[0], entries[index + 1].range[0]];

  return [entries[index - 1].range[1], property.range[1]];
};

module.exports = { buildRequiredEnumFix, getMetadataEntryRemovalRange, getPropertyName };
