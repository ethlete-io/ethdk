// @ts-check
'use strict';

/**
 * Disallows injecting Angular's `Title` and `Meta` services from
 * `@angular/platform-browser` and importing them from that module.
 *
 * These services manipulate the document `<title>` and `<meta>` tags
 * imperatively. The Ethlete platform requires going through the reactive SEO
 * utilities in `@ethlete/core` instead, which integrate with the priority-based
 * head-binding system and work correctly with SSR.
 *
 * ❌ Direct injection:
 *   const title = inject(Title);
 *   const meta  = inject(Meta);
 *
 * ❌ Import (without injection — still signals intent to use them):
 *   import { Title, Meta } from '@angular/platform-browser';
 *
 * ✅ Use the @ethlete/core SEO utilities:
 *   import { injectTitleBinding, injectMetaBinding } from '@ethlete/core';
 *   const titleBinding = injectTitleBinding();
 *   const metaBinding  = injectMetaBinding();
 */

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: "Disallow Angular's Title/Meta services. Use @ethlete/core SEO utilities instead.",
    },
    schema: [],
    messages: {
      noInjectTitle: "Do not inject Angular's Title service. Use injectTitleBinding() from '@ethlete/core' instead.",
      noInjectMeta: "Do not inject Angular's Meta service. Use injectMetaBinding() from '@ethlete/core' instead.",
      noImportTitle:
        "Do not import Title from '@angular/platform-browser'. Use injectTitleBinding() from '@ethlete/core' instead.",
      noImportMeta:
        "Do not import Meta from '@angular/platform-browser'. Use injectMetaBinding() from '@ethlete/core' instead.",
    },
  },
  create(context) {
    /**
     * Returns the first argument identifier name of an inject() call, or null.
     * @param {any} node - CallExpression
     * @returns {string | null}
     */
    const injectTokenName = (node) => {
      if (node.type !== 'CallExpression') return null;
      if (node.callee.type !== 'Identifier' || node.callee.name !== 'inject') return null;
      const firstArg = node.arguments[0];
      if (!firstArg) return null;
      if (firstArg.type === 'Identifier') return firstArg.name;
      return null;
    };

    return {
      // Detect: const x = inject(Title) / inject(Meta)
      CallExpression(node) {
        const token = injectTokenName(/** @type {any} */ (node));
        if (token === 'Title') context.report({ node, messageId: 'noInjectTitle' });
        if (token === 'Meta') context.report({ node, messageId: 'noInjectMeta' });
      },

      // Detect: import { Title, Meta } from '@angular/platform-browser'
      ImportDeclaration(node) {
        const decl = /** @type {any} */ (node);
        if (decl.source.value !== '@angular/platform-browser') return;

        for (const specifier of decl.specifiers) {
          if (specifier.type !== 'ImportSpecifier') continue;
          const imported = specifier.imported.name ?? specifier.imported.value;
          if (imported === 'Title') context.report({ node: specifier, messageId: 'noImportTitle' });
          if (imported === 'Meta') context.report({ node: specifier, messageId: 'noImportMeta' });
        }
      },
    };
  },
};

module.exports = rule;
