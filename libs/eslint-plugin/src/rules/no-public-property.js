// @ts-check
'use strict';

/**
 * @param {any} node
 */
const isInjectCall = (node) => {
  if (!node || node.type !== 'CallExpression') return false;
  return node.callee.type === 'Identifier' && node.callee.name === 'inject';
};

/** @type {import('eslint').Rule.RuleModule} */
const noPublicProperty = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow explicit public on class properties, except for injected members that intentionally expose an external API.',
      recommended: true,
    },
    schema: [],
    messages: {
      noPublicProperty:
        'No public keyword on class properties. The only exception is an injected member that intentionally exposes an external API.',
    },
  },
  create(context) {
    return {
      PropertyDefinition(node) {
        if (node.accessibility !== 'public') return;
        if (isInjectCall(node.value)) return;

        context.report({ node, messageId: 'noPublicProperty' });
      },
    };
  },
};

module.exports = noPublicProperty;
