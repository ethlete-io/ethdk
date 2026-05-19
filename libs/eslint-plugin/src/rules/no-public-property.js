// @ts-check
'use strict';

const { getMemberName, isReferencedFromTemplateOrHost } = require('./internals/angular-member-visibility');

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
    fixable: 'code',
    schema: [],
    messages: {
      noPublicProperty:
        'No public keyword on class properties. The only exception is an injected member that intentionally exposes an external API.',
      shouldBeProtected:
        'Member `{{name}}` should be protected instead of public because it is referenced from a template or host binding.',
    },
  },
  create(context) {
    /**
     * @param {any} node
     */
    const removePublicFix = (node) => {
      const publicToken = context.sourceCode.getFirstToken(node, (token) => token.value === 'public');
      const nextToken = publicToken ? context.sourceCode.getTokenAfter(publicToken) : null;
      if (!publicToken || !nextToken) return null;

      return (fixer) => fixer.removeRange([publicToken.range[0], nextToken.range[0]]);
    };

    /**
     * @param {any} node
     */
    const replacePublicWithProtectedFix = (node) => {
      const publicToken = context.sourceCode.getFirstToken(node, (token) => token.value === 'public');
      if (!publicToken) return null;

      return (fixer) => fixer.replaceText(publicToken, 'protected');
    };

    return {
      PropertyDefinition(node) {
        if (node.accessibility !== 'public') return;
        if (isInjectCall(node.value)) return;

        const classNode = node.parent && node.parent.type === 'ClassBody' ? node.parent.parent : null;
        const memberName = getMemberName(node);
        const isTemplateVisible =
          classNode && memberName ? isReferencedFromTemplateOrHost(classNode, memberName, context) : false;

        if (isTemplateVisible) {
          context.report({
            node,
            messageId: 'shouldBeProtected',
            data: { name: memberName },
            fix: replacePublicWithProtectedFix(node),
          });

          return;
        }

        context.report({
          node,
          messageId: 'noPublicProperty',
          fix: removePublicFix(node),
        });
      },
    };
  },
};

module.exports = noPublicProperty;
