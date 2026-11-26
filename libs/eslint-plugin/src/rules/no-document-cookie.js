// @ts-check
'use strict';

/**
 * Disallows reading or writing 'document.cookie' directly.
 *
 * Direct access to document.cookie:
 * - Returns / writes a raw semicolon-delimited string that is easy to misparse
 * - Bypasses SSR guards (throws in non-browser environments)
 * - Has no expiry, domain, path, or SameSite handling by default
 *
 * BAD:
 *   document.cookie                              // read
 *   document.cookie = 'name=value; path=/';      // write
 *
 * GOOD:
 *   import { getCookie, setCookie, hasCookie, deleteCookie } from '@ethlete/core';
 *   setCookie('name', 'value');
 *   getCookie('name');
 *   hasCookie('name');
 *   deleteCookie('name');
 */

const { isGlobalReference } = require('./internals/import-resolution');

/** @type {import('eslint').Rule.RuleModule} */
const noDocumentCookie = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        "Disallow reading or writing 'document.cookie' directly. Use the cookie utilities from '@ethlete/core' instead.",
      recommended: true,
    },
    messages: {
      noDocumentCookie:
        "Do not access 'document.cookie' directly. Use 'getCookie()', 'setCookie()', 'hasCookie()', or 'deleteCookie()' from '@ethlete/core' — they handle SSR, expiry, domain, path, and SameSite attributes safely.",
    },
    schema: [],
  },
  create(context) {
    const documentAliases = new Set();
    /** @type {any[]} */
    const candidates = [];

    const propertyName = (node) => {
      if (!node.computed && node.property.type === 'Identifier') return node.property.name;
      if (node.computed && node.property.type === 'Literal') return String(node.property.value);

      return null;
    };

    const isGlobalObject = (node) =>
      node.type === 'Identifier' &&
      (node.name === 'window' || node.name === 'globalThis') &&
      isGlobalReference(context.sourceCode, node);

    const isInjectDocument = (node) =>
      node?.type === 'CallExpression' &&
      node.callee.type === 'Identifier' &&
      node.callee.name === 'inject' &&
      node.arguments[0]?.type === 'Identifier' &&
      node.arguments[0].name === 'DOCUMENT';

    const isDocument = (node) => {
      if (node.type === 'Identifier') {
        return node.name === 'document' && isGlobalReference(context.sourceCode, node);
      }
      if (node.type !== 'MemberExpression') return false;
      if (propertyName(node) === 'document' && isGlobalObject(node.object)) return true;

      return node.object.type === 'ThisExpression' && documentAliases.has(propertyName(node));
    };

    return {
      VariableDeclarator(node) {
        if (node.id.type === 'Identifier' && isInjectDocument(node.init)) documentAliases.add(node.id.name);
      },
      PropertyDefinition(node) {
        if (!node.computed && node.key.type === 'Identifier' && isInjectDocument(node.value)) {
          documentAliases.add(node.key.name);
        }
      },
      MemberExpression(node) {
        if (propertyName(node) === 'cookie') candidates.push(node);
      },
      'Program:exit'() {
        for (const node of candidates) {
          const object = node.object;
          const isLocalAlias = object.type === 'Identifier' && documentAliases.has(object.name);

          if (isLocalAlias || isDocument(object)) {
            context.report({ node, messageId: 'noDocumentCookie' });
          }
        }
      },
    };
  },
};

module.exports = noDocumentCookie;
