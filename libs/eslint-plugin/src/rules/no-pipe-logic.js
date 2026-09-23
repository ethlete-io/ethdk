// @ts-check
'use strict';

const { getAngularDecoratorName } = require('./internals/import-resolution');

/**
 * @param {import('eslint').SourceCode} sourceCode
 * @param {any} classNode
 */
const hasPipeDecorator = (sourceCode, classNode) =>
  (classNode.decorators ?? []).some(
    (/** @type {any} */ decorator) => getAngularDecoratorName(sourceCode, decorator) === 'Pipe',
  );

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
        if (!node.value?.body || node.value.body.type === 'TSEmptyBodyFunctionExpression') return;

        const classBody = node.parent;
        if (!classBody || classBody.type !== 'ClassBody') return;

        const classNode = classBody.parent;
        if (!classNode || (classNode.type !== 'ClassDeclaration' && classNode.type !== 'ClassExpression')) return;

        if (!hasPipeDecorator(context.sourceCode, classNode)) return;

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

        if (!hasPipeDecorator(context.sourceCode, classNode)) return;

        const value = /** @type {any} */ (node).value;
        if (value && (value.type === 'ArrowFunctionExpression' || value.type === 'FunctionExpression')) {
          context.report({ node, messageId: 'noLogicInTransform' });
        }
      },
    };
  },
};

module.exports = noPipeLogic;
