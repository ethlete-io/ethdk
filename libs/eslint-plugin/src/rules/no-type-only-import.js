// @ts-check
'use strict';

/** @type {import('eslint').Rule.RuleModule} */
const noTypeOnlyImport = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow `import type { Foo }` and `import { type Foo }` — use a regular value import instead.',
      recommended: true,
    },
    fixable: 'code',
    messages: {
      noTypeImportDeclaration:
        "Do not use `import type`. Use a regular import instead: `import { {{specifiers}} } from '{{source}}';`.",
      noInlineTypeSpecifier:
        "Do not use inline `type` on import specifiers. Use a regular import instead: `import { {{specifiers}} } from '{{source}}';`.",
    },
    schema: [],
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        const decl = /** @type {any} */ (node);
        if (decl.importKind === 'type') {
          const source = /** @type {string} */ (node.source.value);
          const specifiers = node.specifiers.map((s) => s.local.name).join(', ');

          context.report({
            node,
            messageId: 'noTypeImportDeclaration',
            data: { specifiers, source },
            fix(fixer) {
              const specifierText = node.specifiers.map((s) => s.local.name).join(', ');
              return fixer.replaceText(node, `import { ${specifierText} } from '${source}';`);
            },
          });

          return;
        }

        for (const specifier of node.specifiers) {
          const spec = /** @type {any} */ (specifier);
          if (specifier.type === 'ImportSpecifier' && spec.importKind === 'type') {
            const source = /** @type {string} */ (node.source.value);
            const allSpecifiers = node.specifiers
              .map((s) => {
                if (s.type === 'ImportSpecifier') {
                  const imported = s.imported.type === 'Identifier' ? s.imported.name : s.imported.value;
                  return s.local.name === imported ? imported : `${imported} as ${s.local.name}`;
                }
                return s.local.name;
              })
              .join(', ');

            context.report({
              node: specifier,
              messageId: 'noInlineTypeSpecifier',
              data: { specifiers: allSpecifiers, source },
              fix(fixer) {
                const sourceCode = context.sourceCode;
                const tokenBefore = sourceCode.getTokenBefore(specifier.imported ?? specifier.local);
                if (tokenBefore && tokenBefore.value === 'type') {
                  const tokenAfter = sourceCode.getTokenAfter(tokenBefore);
                  if (tokenAfter) {
                    return fixer.removeRange([tokenBefore.range[0], tokenAfter.range[0]]);
                  }
                }
                return null;
              },
            });
          }
        }
      },
    };
  },
};

module.exports = noTypeOnlyImport;
