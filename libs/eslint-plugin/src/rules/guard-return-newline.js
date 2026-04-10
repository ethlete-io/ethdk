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

        // Must be directly inside a BlockStatement
        if (!blockParent || blockParent.type !== 'BlockStatement') return;

        // The block's parent must be an IfStatement's consequent
        const ifStatement = blockParent.parent;
        if (!ifStatement || ifStatement.type !== 'IfStatement') return;
        if (ifStatement.consequent !== blockParent) return;

        // Block must have more than one statement (multi-statement guard)
        if (blockParent.body.length <= 1) return;

        // The return must be the last statement in the block
        if (blockParent.body[blockParent.body.length - 1] !== node) return;

        const prevStatement = blockParent.body[blockParent.body.length - 2];

        if (!node.loc || !prevStatement.loc) return;

        const prevEndLine = prevStatement.loc.end.line;
        const returnStartLine = node.loc.start.line;

        // Need at least one empty line (gap of 2+ lines) between prev statement and return
        if (returnStartLine - prevEndLine >= 2) return;

        const sourceCode = context.sourceCode;

        context.report({
          node,
          messageId: 'missingEmptyLine',
          fix(fixer) {
            const prevToken = sourceCode.getLastToken(/** @type {import('eslint').Rule.Node} */ (prevStatement));
            if (!prevToken) return null;

            return fixer.insertTextAfter(prevToken, '\n');
          },
        });
      },
    };
  },
};

module.exports = rule;
