// @ts-check
'use strict';

/**
 * Disallows SCREAMING_CASE variable names inside function bodies.
 *
 * At module level, SCREAMING_CASE is fine for true constants. Inside functions,
 * all local variables must be camelCase — there is no meaningful distinction
 * between a "constant" and a regular local variable inside a function body.
 *
 * BAD:
 *   const myFn = () => {
 *     const RANDOM = Math.random();     // ❌
 *     const MY_LOCAL_FLAG = true;       // ❌
 *   };
 *
 * GOOD:
 *   const MY_GLOBAL = 'value';          // ✅ module level
 *
 *   const myFn = () => {
 *     const random = Math.random();     // ✅
 *     const myLocalFlag = true;         // ✅
 *   };
 */

/** Matches ALL-CAPS identifiers: at least one char, all uppercase letters, digits, underscores */
const SCREAMING_CASE_RE = /^[A-Z][A-Z0-9_]*$/;

/**
 * Returns true if the given node is inside a function body (arrow or regular).
 * @param {import('eslint').Rule.Node} node
 */
const isInsideFunction = (node) => {
  let current = node.parent;
  while (current) {
    if (
      current.type === 'ArrowFunctionExpression' ||
      current.type === 'FunctionExpression' ||
      current.type === 'FunctionDeclaration'
    ) {
      return true;
    }
    current = current.parent;
  }
  return false;
};

/** @type {import('eslint').Rule.RuleModule} */
const noScreamingCaseLocal = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow SCREAMING_CASE variable names inside function bodies. Use camelCase for all local variables.',
      recommended: true,
    },
    messages: {
      noScreamingCaseLocal: "'{{name}}' uses SCREAMING_CASE inside a function. Use camelCase for local variables.",
    },
    schema: [],
  },
  create(context) {
    return {
      VariableDeclarator(node) {
        // Only flag simple identifier bindings (not destructuring)
        if (node.id.type !== 'Identifier') return;

        const { name } = node.id;

        // Must match the SCREAMING_CASE pattern
        if (!SCREAMING_CASE_RE.test(name)) return;

        // Only flag inside function bodies
        if (!isInsideFunction(node)) return;

        context.report({
          node: node.id,
          messageId: 'noScreamingCaseLocal',
          data: { name },
        });
      },
    };
  },
};

module.exports = noScreamingCaseLocal;
