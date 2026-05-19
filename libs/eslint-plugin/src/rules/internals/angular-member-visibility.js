// @ts-check
'use strict';

const fs = require('fs');
const path = require('path');

/**
 * @param {string} value
 */
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * @param {any} decorator
 */
const getDecoratorCall = (decorator) => {
  if (!decorator || decorator.type !== 'Decorator') return null;

  const expression = decorator.expression;
  if (expression.type !== 'CallExpression') return null;
  if (expression.callee.type !== 'Identifier') return null;
  if (expression.arguments.length === 0) return null;

  const metadata = expression.arguments[0];
  if (!metadata || metadata.type !== 'ObjectExpression') return null;

  return {
    name: expression.callee.name,
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

  if (node.type === 'TemplateLiteral' && node.expressions.length === 0 && node.quasis.length === 1) {
    return node.quasis[0].value.cooked || '';
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
 * @param {string | null} template
 */
const templateReferencesMember = (memberName, template) => {
  if (!template) return false;

  const escapedName = escapeRegExp(memberName);
  const patterns = [
    new RegExp(`\\{\\{[\\s\\S]*?\\b${escapedName}\\b[\\s\\S]*?\\}\\}`, 'u'),
    new RegExp(`@[a-zA-Z]+\\s*\\([\\s\\S]*?\\b${escapedName}\\b[\\s\\S]*?\\)`, 'u'),
    new RegExp(`@let\\s+[a-zA-Z_$][\\w$]*\\s*=\\s*[\\s\\S]*?\\b${escapedName}\\b`, 'u'),
    new RegExp(`\\*[a-zA-Z0-9_\\-]+\\s*=\\s*"[^"]*\\b${escapedName}\\b[^"]*"`, 'u'),
    new RegExp(`\\*[a-zA-Z0-9_\\-]+\\s*=\\s*'[^']*\\b${escapedName}\\b[^']*'`, 'u'),
    new RegExp(`\\[[^\\]]+\\]\\s*=\\s*"[^"]*\\b${escapedName}\\b[^"]*"`, 'u'),
    new RegExp(`\\[[^\\]]+\\]\\s*=\\s*'[^']*\\b${escapedName}\\b[^']*'`, 'u'),
    new RegExp(`\\([^\\)]+\\)\\s*=\\s*"[^"]*\\b${escapedName}\\b[^"]*"`, 'u'),
    new RegExp(`\\([^\\)]+\\)\\s*=\\s*'[^']*\\b${escapedName}\\b[^']*'`, 'u'),
  ];

  return patterns.some((pattern) => pattern.test(template));
};

/**
 * @param {string | null} keyName
 */
const isDynamicHostBindingKey = (keyName) => {
  if (!keyName) return false;

  return keyName.startsWith('[') || keyName.startsWith('(') || keyName.startsWith('@');
};

/**
 * @param {any} classNode
 */
const getAngularMetadata = (classNode) => {
  for (const decorator of classNode.decorators || []) {
    const call = getDecoratorCall(decorator);
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

  const pattern = new RegExp(`\\b${escapeRegExp(memberName)}\\b`, 'u');
  return pattern.test(text);
};

/**
 * @param {string} memberName
 * @param {any} metadata
 * @param {import('eslint').Rule.RuleContext} context
 */
const isReferencedFromTemplateOrHostMetadata = (memberName, metadata, context) => {
  const templateProperty = getMetadataProperty(metadata, 'template');
  if (templateProperty && templateReferencesMember(memberName, getStringValue(templateProperty.value))) {
    return true;
  }

  const templateUrlProperty = getMetadataProperty(metadata, 'templateUrl');
  if (templateUrlProperty) {
    const templateUrl = getStringValue(templateUrlProperty.value);
    const filename = getContextFilename(context);

    if (templateUrl && filename) {
      const templatePath = path.resolve(path.dirname(filename), templateUrl);
      const templateText = readFileIfExists(templatePath);
      if (templateReferencesMember(memberName, templateText)) {
        return true;
      }
    }
  }

  const hostProperty = getMetadataProperty(metadata, 'host');
  if (hostProperty && hostProperty.value.type === 'ObjectExpression') {
    for (const property of hostProperty.value.properties) {
      if (!property || property.type !== 'Property') continue;
      if (!isDynamicHostBindingKey(getPropertyKeyName(property))) continue;

      if (textReferencesMember(memberName, getStringValue(property.value))) {
        return true;
      }
    }
  }

  return false;
};

/**
 * @param {any} node
 */
const getMemberName = (node) => {
  if (node.key?.type === 'Identifier') return node.key.name;
  if (node.key?.type === 'Literal' && typeof node.key.value === 'string') return node.key.value;

  return null;
};

/**
 * @param {any} classNode
 * @param {string} memberName
 * @param {import('eslint').Rule.RuleContext} context
 */
const isReferencedFromTemplateOrHost = (classNode, memberName, context) => {
  const angularMetadata = getAngularMetadata(classNode);

  if (!angularMetadata) {
    return false;
  }

  return isReferencedFromTemplateOrHostMetadata(memberName, angularMetadata.metadata, context);
};

module.exports = {
  getAngularMetadata,
  getMemberName,
  isReferencedFromTemplateOrHost,
};
