// @ts-check
'use strict';

const { getAngularDecoratorName } = require('./import-resolution');

const fs = require('fs');
const path = require('path');

/**
 * @param {string} value
 */
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * @param {import('eslint').SourceCode} sourceCode
 * @param {any} decorator
 */
const getDecoratorCall = (sourceCode, decorator) => {
  const name = getAngularDecoratorName(sourceCode, decorator);
  if (!name) return null;

  const expression = decorator.expression;
  if (expression.type !== 'CallExpression') return null;
  if (expression.arguments.length === 0) return null;

  const metadata = expression.arguments[0];
  if (!metadata || metadata.type !== 'ObjectExpression') return null;

  return {
    name,
    metadata,
  };
};

/**
 * @param {any} property
 */
const getPropertyKeyName = (property) => {
  if (!property || property.computed) return null;

  const key = property.key;
  if (key.type === 'Identifier') return key.name;
  if (key.type === 'Literal' && typeof key.value === 'string') return key.value;

  return null;
};

/**
 * @param {any} metadata
 * @param {string} propertyName
 */
const getMetadataProperty = (metadata, propertyName) => {
  for (const property of metadata.properties) {
    if (!property || property.type !== 'Property' || property.computed) continue;

    const keyName = getPropertyKeyName(property);

    if (keyName === propertyName) {
      return property;
    }
  }

  return null;
};

/**
 * @param {any} node
 */
const getStringValue = (node) => {
  if (!node) return null;
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value;

  if (node.type === 'TemplateLiteral') {
    return node.quasis.map((quasi) => quasi.value.cooked ?? quasi.value.raw).join(' ');
  }

  return null;
};

/**
 * @param {string} filePath
 */
const readFileIfExists = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8');
    }
  } catch {
    return null;
  }

  return null;
};

/** @type {WeakMap<import('eslint').SourceCode, Map<string, string | null>>} */
const TEMPLATE_TEXT_CACHE = new WeakMap();

/**
 * @param {import('eslint').SourceCode} sourceCode
 * @param {string} templatePath
 */
const readTemplateText = (sourceCode, templatePath) => {
  let templates = TEMPLATE_TEXT_CACHE.get(sourceCode);

  if (!templates) {
    templates = new Map();
    TEMPLATE_TEXT_CACHE.set(sourceCode, templates);
  }

  if (!templates.has(templatePath)) {
    templates.set(templatePath, readFileIfExists(templatePath));
  }

  return templates.get(templatePath) ?? null;
};

/**
 * @param {import('eslint').Rule.RuleContext} context
 */
const getContextFilename = (context) => {
  const filename = context.physicalFilename || context.filename;

  if (!filename || filename === '<input>' || filename === '<text>') {
    return null;
  }

  return filename;
};

/**
 * @param {string} memberName
 */
const memberNamePattern = (memberName) =>
  new RegExp(`(?:(?<![\\w$.])|(?<=(?<![\\w$])this\\.)|(?<=\\.\\.\\.))${escapeRegExp(memberName)}(?![\\w$])`, 'u');

const BINDING_ATTRIBUTE_PATTERN =
  /(?:^|[\s<])(\[\([^)]*\)\]|\[[^\]]*\]|\([^)]*\)|\*[\w-]+|bind-[\w-]+|on-[\w-]+|bindon-[\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/gu;

const BLOCK_HEADER_PATTERN = /@(?:else\s+if|[a-zA-Z]+)\s*\(/gu;

const LET_DECLARATION_PATTERN = /@let\s+[\w$]+\s*=([^;]*)/gu;

/**
 * @param {string} text
 * @param {number} openIndex
 */
const readBalancedParens = (text, openIndex) => {
  let depth = 0;
  /** @type {string | null} */
  let quote = null;

  for (let index = openIndex; index < text.length; index++) {
    const char = text[index];

    if (quote) {
      if (char === quote && text[index - 1] !== '\\') quote = null;
      continue;
    }

    if (char === '"' || char === "'" || char === '`') quote = char;
    else if (char === '(') depth++;
    else if (char === ')' && --depth === 0) return text.slice(openIndex + 1, index);
  }

  return text.slice(openIndex + 1);
};

/**
 * @param {string} template
 */
const getInterpolations = (template) => {
  /** @type {string[]} */
  const expressions = [];
  let searchFrom = 0;

  while (true) {
    const start = template.indexOf('{{', searchFrom);
    if (start === -1) break;

    let depth = 0;
    let index = start + 2;

    for (; index < template.length; index++) {
      if (template[index] === '{') depth++;
      else if (template[index] === '}') {
        if (depth > 0) depth--;
        else if (template[index + 1] === '}') break;
      }
    }

    expressions.push(template.slice(start + 2, index));
    searchFrom = index + 2;
  }

  return expressions;
};

/**
 * @typedef {{ name: string; expression: string }} TemplateBinding
 */

/**
 * @param {string} template
 * @returns {TemplateBinding[]}
 */
const getBindingAttributes = (template) =>
  [...template.matchAll(BINDING_ATTRIBUTE_PATTERN)].map((match) => ({
    name: match[1] ?? '',
    expression: match[2] ?? match[3] ?? '',
  }));

/**
 * @param {string} template
 */
const getTemplateExpressions = (template) => {
  const expressions = getInterpolations(template);

  for (const binding of getBindingAttributes(template)) {
    expressions.push(binding.expression);
  }

  for (const match of template.matchAll(BLOCK_HEADER_PATTERN)) {
    expressions.push(readBalancedParens(template, (match.index ?? 0) + match[0].length - 1));
  }

  for (const match of template.matchAll(LET_DECLARATION_PATTERN)) {
    expressions.push(match[1] ?? '');
  }

  return expressions;
};

/**
 * @param {string} bindingName
 */
const isWritingBinding = (bindingName) =>
  bindingName.startsWith('(') || bindingName.startsWith('[(') || /^(?:on|bindon)-/u.test(bindingName);

/**
 * @param {string} memberName
 * @param {string | null} template
 */
const templateReferencesMember = (memberName, template) => {
  if (!template) return false;

  const pattern = memberNamePattern(memberName);

  return getTemplateExpressions(template).some((expression) => pattern.test(expression));
};

/**
 * @param {string} memberName
 * @param {string | null} template
 */
const templateWritesMember = (memberName, template) => {
  if (!template) return false;

  const pattern = memberNamePattern(memberName);

  return getBindingAttributes(template).some(
    (binding) => isWritingBinding(binding.name) && pattern.test(binding.expression),
  );
};

/**
 * @param {string | null} keyName
 */
const isDynamicHostBindingKey = (keyName) => {
  if (!keyName) return false;

  return keyName.startsWith('[') || keyName.startsWith('(') || keyName.startsWith('@');
};

/**
 * @param {import('eslint').SourceCode} sourceCode
 * @param {any} classNode
 */
const getAngularMetadata = (sourceCode, classNode) => {
  for (const decorator of classNode.decorators || []) {
    const call = getDecoratorCall(sourceCode, decorator);
    if (!call) continue;

    if (call.name === 'Component' || call.name === 'Directive') {
      return call;
    }
  }

  return null;
};

/**
 * @param {string} memberName
 * @param {string | null} text
 */
const textReferencesMember = (memberName, text) => {
  if (!text) return false;

  return memberNamePattern(memberName).test(text);
};

/**
 * @param {any} metadata
 * @param {import('eslint').Rule.RuleContext} context
 */
const getTemplateTexts = (metadata, context) => {
  /** @type {string[]} */
  const templates = [];

  const inlineTemplate = getStringValue(getMetadataProperty(metadata, 'template')?.value);
  if (inlineTemplate) templates.push(inlineTemplate);

  const templateUrl = getStringValue(getMetadataProperty(metadata, 'templateUrl')?.value);
  const filename = getContextFilename(context);

  if (templateUrl && filename) {
    const templateText = readTemplateText(context.sourceCode, path.resolve(path.dirname(filename), templateUrl));
    if (templateText) templates.push(templateText);
  }

  return templates;
};

/**
 * @param {any} metadata
 */
const getHostBindings = (metadata) => {
  const hostProperty = getMetadataProperty(metadata, 'host');
  if (!hostProperty || hostProperty.value.type !== 'ObjectExpression') return [];

  /** @type {TemplateBinding[]} */
  const bindings = [];

  for (const property of hostProperty.value.properties) {
    if (!property || property.type !== 'Property') continue;

    const keyName = getPropertyKeyName(property);
    if (!isDynamicHostBindingKey(keyName)) continue;

    bindings.push({ name: keyName ?? '', expression: getStringValue(property.value) ?? '' });
  }

  return bindings;
};

/**
 * @param {string} memberName
 * @param {any} metadata
 * @param {import('eslint').Rule.RuleContext} context
 */
const isReferencedFromTemplateOrHostMetadata = (memberName, metadata, context) =>
  getTemplateTexts(metadata, context).some((template) => templateReferencesMember(memberName, template)) ||
  getHostBindings(metadata).some((binding) => textReferencesMember(memberName, binding.expression));

/**
 * @param {string} memberName
 * @param {any} metadata
 * @param {import('eslint').Rule.RuleContext} context
 */
const isWrittenFromTemplateOrHostMetadata = (memberName, metadata, context) =>
  getTemplateTexts(metadata, context).some((template) => templateWritesMember(memberName, template)) ||
  getHostBindings(metadata).some(
    (binding) => isWritingBinding(binding.name) && textReferencesMember(memberName, binding.expression),
  );

/**
 * @param {any} node
 */
const getMemberName = (node) => {
  if (node.key?.type === 'Identifier' && !node.computed) return node.key.name;
  if (node.key?.type === 'Literal' && typeof node.key.value === 'string') return node.key.value;

  return null;
};

/**
 * @param {any} classNode
 * @param {string} memberName
 * @param {import('eslint').Rule.RuleContext} context
 */
const isReferencedFromTemplateOrHost = (classNode, memberName, context) => {
  const angularMetadata = getAngularMetadata(context.sourceCode, classNode);

  if (!angularMetadata) {
    return false;
  }

  return isReferencedFromTemplateOrHostMetadata(memberName, angularMetadata.metadata, context);
};

/**
 * @param {any} classNode
 * @param {string} memberName
 * @param {import('eslint').Rule.RuleContext} context
 */
const isWrittenFromTemplateOrHost = (classNode, memberName, context) => {
  const angularMetadata = getAngularMetadata(context.sourceCode, classNode);

  if (!angularMetadata) {
    return false;
  }

  return isWrittenFromTemplateOrHostMetadata(memberName, angularMetadata.metadata, context);
};

module.exports = {
  getAngularMetadata,
  isWrittenFromTemplateOrHost,
  getMemberName,
  isReferencedFromTemplateOrHost,
};
