// @ts-check
'use strict';

const { getMemberName, isReferencedFromTemplateOrHost } = require('./internals/angular-member-visibility');

/**
 * @param {any} node
 */
const isInjectCall = (node) => {
  if (!node || node.type !== 'PropertyDefinition' || !node.value) return false;
  if (node.value.type !== 'CallExpression') return false;
  return node.value.callee.type === 'Identifier' && node.value.callee.name === 'inject';
};

/**
 * @param {any} node
 * @param {import('eslint').SourceCode} sourceCode
 * @param {'private' | 'protected'} expectedAccessibility
 */
const buildFix = (node, sourceCode, expectedAccessibility) => {
  const keyToken = sourceCode.getFirstToken(node.key);
  if (!keyToken) return null;

  if (node.accessibility) {
    const firstToken = sourceCode.getFirstToken(node);
    if (!firstToken) return null;

    return (fixer) => fixer.replaceText(firstToken, expectedAccessibility);
  }

  return (fixer) => fixer.insertTextBefore(keyToken, `${expectedAccessibility} `);
};

/** @type {import('eslint').Rule.RuleModule} */
const injectMemberAccessibility = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require injected class members to be private by default, protected when referenced from an Angular template or host binding, and allow explicit public when intentionally exposing an external API.',
      recommended: true,
    },
    fixable: 'code',
    schema: [],
    messages: {
      shouldBePrivate:
        'Injected member `{{name}}` should be private. Use protected only when it is referenced from a template or host binding.',
      shouldBeProtected:
        'Injected member `{{name}}` should be protected because it is referenced from a template or host binding. Use public only when it intentionally exposes an external API across class boundaries.',
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      PropertyDefinition(node) {
        if (!isInjectCall(node)) return;

        const classNode = node.parent && node.parent.type === 'ClassBody' ? node.parent.parent : null;
        if (!classNode || (classNode.type !== 'ClassDeclaration' && classNode.type !== 'ClassExpression')) return;

        const memberName = getMemberName(node);
        if (!memberName) return;

        const isTemplateOrHostVisible = isReferencedFromTemplateOrHost(classNode, memberName, context);

        if (isTemplateOrHostVisible) {
          if (node.accessibility === 'protected' || node.accessibility === 'public') return;

          context.report({
            node,
            messageId: 'shouldBeProtected',
            data: { name: memberName },
            fix: buildFix(node, sourceCode, 'protected'),
          });

          return;
        }

        if (node.accessibility === 'private' || node.accessibility === 'public') return;

        context.report({
          node,
          messageId: 'shouldBePrivate',
          data: { name: memberName },
          fix: buildFix(node, sourceCode, 'private'),
        });
      },
    };
  },
};

module.exports = injectMemberAccessibility;
