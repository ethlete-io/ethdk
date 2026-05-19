// @ts-check
'use strict';

const {
  getAngularMetadata,
  getMemberName,
  isReferencedFromTemplateOrHost,
} = require('./internals/angular-member-visibility');
const { getImplementedContractMemberNames } = require('./internals/implemented-contract-members');

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
 */
const buildPublicFix = (node, sourceCode) => {
  const keyToken = sourceCode.getFirstToken(node.key);
  if (!keyToken) return null;

  if (node.accessibility) {
    const firstToken = sourceCode.getFirstToken(node);
    if (!firstToken) return null;

    return (fixer) => fixer.replaceText(firstToken, 'public');
  }

  return (fixer) => fixer.insertTextBefore(keyToken, 'public ');
};

/**
 * @param {any} node
 * @param {import('eslint').SourceCode} sourceCode
 */
const buildRemoveProtectedFix = (node, sourceCode) => {
  const protectedToken = sourceCode.getFirstToken(node, (token) => token.value === 'protected');
  const nextToken = protectedToken ? sourceCode.getTokenAfter(protectedToken) : null;

  if (!protectedToken || !nextToken) {
    return null;
  }

  return (fixer) => fixer.removeRange([protectedToken.range[0], nextToken.range[0]]);
};

/**
 * @param {any} node
 */
const isSupportedMember = (node) => {
  if (node.type === 'PropertyDefinition') {
    return true;
  }

  if (node.type === 'MethodDefinition') {
    return node.kind !== 'constructor';
  }

  return false;
};

/** @type {import('eslint').Rule.RuleModule} */
const templateMemberAccessibility = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require non-injected Angular class members referenced from templates or host bindings to use an explicit accessibility modifier, require explicit public on implicitly public surface members, and disallow unnecessary protected on other members.',
      recommended: true,
    },
    fixable: 'code',
    schema: [],
    messages: {
      shouldBePublic: 'Member `{{name}}` implements a public contract and should use an explicit `public` modifier.',
      shouldBeExplicitPublic:
        'Member `{{name}}` is implicitly public. Use an explicit `public` modifier. Keep or add `@internal` when it is only technically reachable.',
      shouldBeExplicit:
        'Member `{{name}}` is referenced from a template or host binding. Use `public` when it is intentionally exposed outside the component; otherwise use `protected`.',
      shouldNotBeProtected:
        'Member `{{name}}` should not be protected because it is not referenced from a template or host binding.',
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    /**
     * @param {any} node
     */
    const checkMember = (node) => {
      if (!isSupportedMember(node)) return;
      if (node.type === 'PropertyDefinition' && isInjectCall(node)) return;

      const classNode = node.parent && node.parent.type === 'ClassBody' ? node.parent.parent : null;
      if (!classNode || (classNode.type !== 'ClassDeclaration' && classNode.type !== 'ClassExpression')) return;
      if (!getAngularMetadata(classNode)) return;

      const memberName = getMemberName(node);
      if (!memberName) return;

      const implementedContractMembers = getImplementedContractMemberNames({ classNode, context });
      const implementsPublicContract = implementedContractMembers.has(memberName);

      if (implementsPublicContract) {
        if (node.accessibility === 'public') return;

        context.report({
          node,
          messageId: 'shouldBePublic',
          data: { name: memberName },
          fix: buildPublicFix(node, sourceCode),
        });

        return;
      }

      const isTemplateVisible = isReferencedFromTemplateOrHost(classNode, memberName, context);

      if (isTemplateVisible) {
        if (node.accessibility === 'protected' || node.accessibility === 'public') return;

        context.report({
          node,
          messageId: 'shouldBeExplicit',
          data: { name: memberName },
          fix: buildPublicFix(node, sourceCode),
        });

        return;
      }

      if (node.accessibility !== 'protected') return;

      context.report({
        node,
        messageId: 'shouldNotBeProtected',
        data: { name: memberName },
        fix: buildRemoveProtectedFix(node, sourceCode),
      });

      return;
    };

    /**
     * @param {any} node
     */
    const checkImplicitPublicMember = (node) => {
      if (!isSupportedMember(node)) return;
      if (node.type === 'PropertyDefinition' && isInjectCall(node)) return;

      const classNode = node.parent && node.parent.type === 'ClassBody' ? node.parent.parent : null;
      if (!classNode || (classNode.type !== 'ClassDeclaration' && classNode.type !== 'ClassExpression')) return;
      if (!getAngularMetadata(classNode)) return;

      const memberName = getMemberName(node);
      if (!memberName) return;

      const implementedContractMembers = getImplementedContractMemberNames({ classNode, context });
      if (implementedContractMembers.has(memberName)) return;

      if (isReferencedFromTemplateOrHost(classNode, memberName, context)) return;
      if (node.accessibility) return;

      context.report({
        node,
        messageId: 'shouldBeExplicitPublic',
        data: { name: memberName },
        fix: buildPublicFix(node, sourceCode),
      });
    };

    return {
      PropertyDefinition(node) {
        checkMember(node);
        checkImplicitPublicMember(node);
      },
      MethodDefinition(node) {
        checkMember(node);
        checkImplicitPublicMember(node);
      },
    };
  },
};

module.exports = templateMemberAccessibility;
