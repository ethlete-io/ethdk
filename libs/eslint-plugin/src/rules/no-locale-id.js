// @ts-check
'use strict';

/**
 * Disallows injecting Angular's LOCALE_ID token directly.
 *
 * @ethlete/core provides injectLocale() which wraps LOCALE_ID in a signal
 * and exposes helper utilities for locale-aware formatting.
 *
 * BAD:
 *   inject(LOCALE_ID)
 *   import { LOCALE_ID } from '@angular/core';
 *
 * GOOD:
 *   import { injectLocale } from '@ethlete/core';
 *   const locale = injectLocale();
 */

/** @type {import('eslint').Rule.RuleModule} */
const noLocaleId = {
  meta: {
    type: 'suggestion',
    docs: {
      description: "Disallow injecting 'LOCALE_ID' directly. Use 'injectLocale()' from '@ethlete/core' instead.",
      recommended: true,
    },
    messages: {
      noLocaleId:
        "Do not inject 'LOCALE_ID' directly. Use 'injectLocale()' from '@ethlete/core' instead — it wraps LOCALE_ID and provides a clean, signal-compatible API.",
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        const { callee } = node;
        if (callee.type !== 'Identifier' || callee.name !== 'inject') return;
        const arg = node.arguments[0];
        if (arg?.type === 'Identifier' && arg.name === 'LOCALE_ID') {
          context.report({ node, messageId: 'noLocaleId' });
        }
      },

      ImportDeclaration(node) {
        if (node.source.value !== '@angular/core') return;
        for (const specifier of node.specifiers) {
          if (specifier.type === 'ImportSpecifier' && specifier.imported.name === 'LOCALE_ID') {
            context.report({ node, messageId: 'noLocaleId' });
            return;
          }
        }
      },
    };
  },
};

module.exports = noLocaleId;
