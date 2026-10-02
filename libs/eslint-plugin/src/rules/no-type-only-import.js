// @ts-check
'use strict';

/** @param {any} node */
const renderValueImport = (node) => {
  const clauses = [];
  const named = [];

  for (const s of node.specifiers) {
    if (s.type === 'ImportDefaultSpecifier') clauses.push(s.local.name);
    else if (s.type === 'ImportNamespaceSpecifier') clauses.push(`* as ${s.local.name}`);
    else {
      const imported = s.imported.type === 'Identifier' ? s.imported.name : `'${s.imported.value}'`;
      named.push(s.local.name === imported ? imported : `${imported} as ${s.local.name}`);
    }
  }

  if (named.length) clauses.push(`{ ${named.join(', ')} }`);

  return `import ${clauses.join(', ')} from '${node.source.value}';`;
};

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
      noTypeImportDeclaration: 'Do not use `import type`. Use a regular import instead: `{{replacement}}`.',
      noInlineTypeSpecifier:
        'Do not use inline `type` on import specifiers. Use a regular import instead: `{{replacement}}`.',
    },
    schema: [],
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        const decl = /** @type {any} */ (node);
        if (decl.importKind === 'type') {
          context.report({
            node,
            messageId: 'noTypeImportDeclaration',
            data: { replacement: renderValueImport(node) },
            fix(fixer) {
              const sourceCode = context.sourceCode;
              const importToken = sourceCode.getFirstToken(node);
              const typeToken = importToken ? sourceCode.getTokenAfter(importToken) : null;
              const nextToken = typeToken ? sourceCode.getTokenAfter(typeToken) : null;

              if (typeToken?.value !== 'type' || !nextToken) return null;
              return fixer.removeRange([typeToken.range[0], nextToken.range[0]]);
            },
          });

          return;
        }

        for (const specifier of node.specifiers) {
          const spec = /** @type {any} */ (specifier);
          if (specifier.type === 'ImportSpecifier' && spec.importKind === 'type') {
            context.report({
              node: specifier,
              messageId: 'noInlineTypeSpecifier',
              data: { replacement: renderValueImport(node) },
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
