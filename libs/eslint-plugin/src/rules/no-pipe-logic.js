// @ts-check
'use strict';

/**
 * Checks whether a class node has a @Pipe decorator.
 * @param {import('eslint').Rule.Node} classNode
 */
const hasPipeDecorator = (classNode) => {
  const decorators = /** @type {any} */ (classNode).decorators ?? [];
  return decorators.some((/** @type {any} */ dec) => {
    const expr = dec.expression;
    if (expr.type === 'CallExpression') {
      return expr.callee.type === 'Identifier' && expr.callee.name === 'Pipe';
    }
    if (expr.type === 'Identifier') {
      return expr.name === 'Pipe';
    }
    return false;
  });
};

/** @type {import('eslint').Rule.RuleModule} */
const noPipeLogic = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Pipes must not contain logic in the transform method. Extract to a utility function and assign it: `transform = myUtil;`',
    },
    messages: {
      noLogicInTransform:
        'Pipes must not contain logic in transform. Extract to a utility function and assign it: `transform = myUtil;`',
    },
    schema: [],
  },
  create(context) {
    return {
      // Case 1: transform() { ... } — method with a body
      MethodDefinition(node) {
        const key = /** @type {any} */ (node).key;
        if (key.type !== 'Identifier' || key.name !== 'transform') return;

        const classBody = node.parent;
        if (!classBody || classBody.type !== 'ClassBody') return;

        const classNode = classBody.parent;
        if (!classNode || (classNode.type !== 'ClassDeclaration' && classNode.type !== 'ClassExpression')) return;

        if (!hasPipeDecorator(classNode)) return;

        context.report({ node, messageId: 'noLogicInTransform' });
      },

      // Case 2: transform = () => { ... } or transform = function() { ... }
      PropertyDefinition(node) {
        const key = /** @type {any} */ (node).key;
        if (key.type !== 'Identifier' || key.name !== 'transform') return;

        const classBody = node.parent;
        if (!classBody || classBody.type !== 'ClassBody') return;

        const classNode = classBody.parent;
        if (!classNode || (classNode.type !== 'ClassDeclaration' && classNode.type !== 'ClassExpression')) return;

        if (!hasPipeDecorator(classNode)) return;

        const value = /** @type {any} */ (node).value;
        if (value && (value.type === 'ArrowFunctionExpression' || value.type === 'FunctionExpression')) {
          context.report({ node, messageId: 'noLogicInTransform' });
        }
      },
    };
  },
};

module.exports = noPipeLogic;
