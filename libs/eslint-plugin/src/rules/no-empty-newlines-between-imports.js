// @ts-check
'use strict';

/** @type {import('eslint').Rule.RuleModule} */
const noEmptyNewlinesBetweenImports = {
  meta: {
    type: 'layout',
    docs: {
      description: 'Disallow empty blank lines between consecutive import declarations.',
    },
    fixable: 'code',
    schema: [],
    messages: {
      noEmptyLine: 'Remove empty blank lines between import declarations.',
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      Program(node) {
        const importDeclarations = node.body.filter((statement) => statement.type === 'ImportDeclaration');

        for (let index = 1; index < importDeclarations.length; index += 1) {
          const previousImport = importDeclarations[index - 1];
          const currentImport = importDeclarations[index];
          const textBetween = sourceCode.text.slice(previousImport.range[1], currentImport.range[0]);

          if (/\S/.test(textBetween)) continue;
          if (!/\n\s*\n/.test(textBetween)) continue;

          context.report({
            node: currentImport,
            messageId: 'noEmptyLine',
            fix(fixer) {
              return fixer.replaceTextRange([previousImport.range[1], currentImport.range[0]], '\n');
            },
          });
        }
      },
    };
  },
};

module.exports = noEmptyNewlinesBetweenImports;
