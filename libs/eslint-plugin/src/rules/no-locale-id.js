// @ts-check
'use strict';

/**
 * Disallows injecting Angular's LOCALE_ID token directly.
 *
 * @ethlete/core provides a signal-based locale store for application code.
 *
 * BAD:
 *   inject(LOCALE_ID)
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
        "Do not inject 'LOCALE_ID' directly. Use the signal-based 'injectLocale()' API from '@ethlete/core' for application locale state.",
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
    };
  },
};

module.exports = noLocaleId;
