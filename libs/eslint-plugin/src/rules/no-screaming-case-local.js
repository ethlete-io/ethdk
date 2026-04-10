// @ts-check
'use strict';

/**
 * Disallows SCREAMING_CASE variable names inside function bodies.
 *
 * At module level, SCREAMING_CASE is fine for true constants. Inside functions,
 * all local variables must be camelCase — there is no meaningful distinction
 * between a "constant" and a regular local variable inside a function body.
 *
 * Also disallows SCREAMING_CASE names for function-valued variables at any scope,
 * since a function is never a static constant.
 *
 * BAD:
 *   const myFn = () => {
 *     const RANDOM = Math.random();     // ❌
 *     const MY_LOCAL_FLAG = true;       // ❌
 *   };
 *
 *   const MY_FUNCTION = () => {};       // ❌ function name must be camelCase
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
      noScreamingCaseFunctionName:
        "'{{name}}' uses SCREAMING_CASE for a function name. Use camelCase for function names.",
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

      // Catch SCREAMING_CASE names for function-valued variables at any scope:
      // const MY_FUNCTION = () => {}  ❌
      // const MY_FUNCTION = function() {}  ❌
      /** @param {import('estree').VariableDeclarator & import('eslint').Rule.NodeParentExtension} node */
      'VariableDeclarator[init.type="ArrowFunctionExpression"], VariableDeclarator[init.type="FunctionExpression"]'(
        node,
      ) {
        if (node.id.type !== 'Identifier') return;

        const { name } = /** @type {import('estree').Identifier} */ (node.id);

        if (!SCREAMING_CASE_RE.test(name)) return;

        context.report({
          node: /** @type {import('eslint').Rule.Node} */ (node.id),
          messageId: 'noScreamingCaseFunctionName',
          data: { name },
        });
      },
    };
  },
};

module.exports = noScreamingCaseLocal;
