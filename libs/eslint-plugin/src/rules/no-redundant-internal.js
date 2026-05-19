// @ts-check
'use strict';

/**
 * @param {import('eslint').SourceCode} sourceCode
 * @param {import('eslint').Rule.Node} node
 */
const getAttachedInternalComment = (sourceCode, node) => {
  const comments = sourceCode.getCommentsBefore(node);
  const attachedComment = comments[comments.length - 1];

  if (!attachedComment || attachedComment.type !== 'Block') {
    return null;
  }

  const textBetween = sourceCode.text.slice(attachedComment.range[1], node.range[0]);

  if (textBetween.trim() !== '') {
    return null;
  }

  return /@internal\b/u.test(attachedComment.value) ? attachedComment : null;
};

/**
 * @param {any} node
 */
const getMemberName = (node) => {
  if (node.key?.type === 'Identifier') return node.key.name;
  if (node.key?.type === 'Literal' && typeof node.key.value === 'string') return node.key.value;

  return 'member';
};

/**
 * @param {any} node
 */
const getMemberKind = (node) => {
  if (node.type === 'MethodDefinition') return 'method';
  return 'property';
};

/** @type {import('eslint').Rule.RuleModule} */
const noRedundantInternal = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow redundant @internal usage on class members that are already hidden by accessibility.',
      recommended: true,
    },
    fixable: 'code',
    schema: [],
    messages: {
      redundantInternal:
        '`@internal` is redundant on {{kind}} `{{name}}` because {{accessibility}} members are already hidden from consumers.',
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    /**
     * @param {any} node
     */
    const checkMember = (node) => {
      const internalComment = getAttachedInternalComment(sourceCode, node);

      if (!internalComment) {
        return;
      }

      if (node.accessibility !== 'private' && node.accessibility !== 'protected') {
        return;
      }

      context.report({
        node: internalComment,
        messageId: 'redundantInternal',
        data: {
          accessibility: node.accessibility,
          kind: getMemberKind(node),
          name: getMemberName(node),
        },
        fix: (fixer) => fixer.removeRange([internalComment.range[0], node.range[0]]),
      });
    };

    return {
      PropertyDefinition: checkMember,
      MethodDefinition: checkMember,
    };
  },
};

module.exports = noRedundantInternal;
