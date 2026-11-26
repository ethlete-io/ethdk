// @ts-check
'use strict';

/**
 * Enforces an empty line before a `return` statement that is the last statement
 * in a multi-statement if-block (guard clause pattern).
 *
 * ❌ if (!allFilled) {
 *      this.selectFirstUnfilledGuidedSlot();
 *      return;
 *    }
 *
 * ✅ if (!allFilled) {
 *      this.selectFirstUnfilledGuidedSlot();
 *
 *      return;
 *    }
 *
 * ✅ Single-line guards are exempt: if (!slot) return;
 *
 * @type {import('eslint').Rule.RuleModule}
 */
const rule = {
  meta: {
    type: 'layout',
    docs: {
      description: 'Require an empty line before a return in a multi-statement if-block (guard clause).',
      recommended: true,
    },
    fixable: 'whitespace',
    schema: [],
    messages: {
      missingEmptyLine: 'Add an empty line before the return statement inside a multi-statement if-block.',
    },
  },
  create(context) {
    return {
      ReturnStatement(node) {
        const blockParent = node.parent;

        if (!blockParent || blockParent.type !== 'BlockStatement') return;

        const ifStatement = blockParent.parent;
        if (!ifStatement || ifStatement.type !== 'IfStatement') return;
        if (ifStatement.consequent !== blockParent) return;

        if (blockParent.body.length <= 1) return;

        if (blockParent.body[blockParent.body.length - 1] !== node) return;

        const prevStatement = blockParent.body[blockParent.body.length - 2];

        if (!node.loc || !prevStatement.loc) return;

        const prevEndLine = prevStatement.loc.end.line;
        const sourceCode = context.sourceCode;

        const textBetween = sourceCode.text.slice(prevStatement.range[1], node.range[0]);

        if (/\n[ \t]*\r?\n/.test(textBetween)) return;

        context.report({
          node,
          messageId: 'missingEmptyLine',
          fix(fixer) {
            const trailingComment = sourceCode
              .getCommentsAfter(/** @type {import('eslint').Rule.Node} */ (prevStatement))
              .find((comment) => comment.loc.start.line === prevEndLine && comment.range[1] < node.range[0]);
            const insertionNode = trailingComment ?? prevStatement;

            return fixer.insertTextAfter(insertionNode, '\n');
          },
        });
      },
    };
  },
};

module.exports = rule;
