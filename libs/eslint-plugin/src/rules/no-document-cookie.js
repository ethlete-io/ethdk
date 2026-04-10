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
    return {
      MemberExpression(node) {
        if (
          node.object.type === 'Identifier' &&
          node.object.name === 'document' &&
          node.property.type === 'Identifier' &&
          node.property.name === 'cookie'
        ) {
          context.report({ node, messageId: 'noDocumentCookie' });
        }
      },
    };
  },
};

module.exports = noDocumentCookie;
