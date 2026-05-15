// @ts-check
'use strict';

const SCREAMING_CASE_RE = /^[A-Z][A-Z0-9_]*$/;

const REACTIVE_APIS = new Set([
  'signal',
  'computed',
  'linkedSignal',
  'input',
  'model',
  'output',
  'outputFromObservable',
  'viewChild',
  'viewChildren',
  'contentChild',
  'contentChildren',
  'inject',
  'effect',
  'afterNextRender',
  'afterRender',
  'toSignal',
  'toObservable',
]);

/**
 * @param {any} node
 */
const getMemberName = (node) => {
  if (!node || !node.key) return null;

  if (node.key.type === 'Identifier' || node.key.type === 'PrivateIdentifier') {
    return node.key.name;
  }

  if (node.key.type === 'Literal' && typeof node.key.value === 'string') {
    return node.key.value;
  }

  return null;
};

/**
 * @param {any} node
 */
const getCallRootName = (node) => {
  if (!node || node.type !== 'CallExpression') return null;

  const { callee } = node;

  if (callee.type === 'Identifier') {
    return callee.name;
  }

  if (callee.type === 'MemberExpression' && callee.object.type === 'Identifier') {
    return callee.object.name;
  }

  return null;
};

/**
 * @param {any} node
 */
const isReactiveInitializer = (node) => {
  const apiName = getCallRootName(node);
  return apiName !== null && REACTIVE_APIS.has(apiName);
};

/**
 * @param {any} node
 */
const isThisReference = (node) => node && (node.type === 'ThisExpression' || node.type === 'Super');

/**
 * @param {any} node
 */
const isConstantExpression = (node) => {
  if (!node) return false;

  switch (node.type) {
    case 'Literal':
    case 'Identifier':
      return true;
    case 'TemplateLiteral':
      return node.expressions.every((expression) => isConstantExpression(expression));
    case 'UnaryExpression':
    case 'UpdateExpression':
      return isConstantExpression(node.argument);
    case 'BinaryExpression':
    case 'LogicalExpression':
      return isConstantExpression(node.left) && isConstantExpression(node.right);
    case 'ConditionalExpression':
      return (
        isConstantExpression(node.test) && isConstantExpression(node.consequent) && isConstantExpression(node.alternate)
      );
    case 'ArrayExpression':
      return node.elements.every((element) => {
        if (element === null) return true;

        if (element.type === 'SpreadElement') {
          return isConstantExpression(element.argument);
        }

        return isConstantExpression(element);
      });
    case 'ObjectExpression':
      return node.properties.every((property) => {
        if (property.type === 'SpreadElement') {
          return isConstantExpression(property.argument);
        }

        if (property.type !== 'Property' || property.kind !== 'init') {
          return false;
        }

        if (property.computed && !isConstantExpression(property.key)) {
          return false;
        }

        return isConstantExpression(property.value);
      });
    case 'MemberExpression':
      if (isThisReference(node.object)) {
        return false;
      }

      if (!isConstantExpression(node.object)) {
        return false;
      }

      return node.computed ? isConstantExpression(node.property) : true;
    case 'TSAsExpression':
    case 'TSTypeAssertion':
    case 'TSNonNullExpression':
    case 'ChainExpression':
      return isConstantExpression(node.expression);
    case 'ParenthesizedExpression':
      return isConstantExpression(node.expression);
    case 'SequenceExpression':
      return node.expressions.every((expression) => isConstantExpression(expression));
    default:
      return false;
  }
};

/**
 * @param {any} node
 */
const getWrittenMemberName = (node) => {
  if (!node || node.type !== 'MemberExpression' || !isThisReference(node.object)) {
    return null;
  }

  if (!node.computed && (node.property.type === 'Identifier' || node.property.type === 'PrivateIdentifier')) {
    return node.property.name;
  }

  if (node.computed && node.property.type === 'Literal' && typeof node.property.value === 'string') {
    return node.property.value;
  }

  return null;
};

/**
 * @param {any} target
 * @param {Set<string>} writtenMembers
 */
const collectAssignedMemberNames = (target, writtenMembers) => {
  if (!target) return;

  if (target.type === 'MemberExpression') {
    const memberName = getWrittenMemberName(target);

    if (memberName !== null) {
      writtenMembers.add(memberName);
    }

    return;
  }

  if (target.type === 'ArrayPattern') {
    for (const element of target.elements) {
      collectAssignedMemberNames(element, writtenMembers);
    }

    return;
  }

  if (target.type === 'ObjectPattern') {
    for (const property of target.properties) {
      if (property.type === 'Property') {
        collectAssignedMemberNames(property.value, writtenMembers);
      } else if (property.type === 'RestElement') {
        collectAssignedMemberNames(property.argument, writtenMembers);
      }
    }

    return;
  }

  if (target.type === 'AssignmentPattern') {
    collectAssignedMemberNames(target.left, writtenMembers);

    return;
  }

  if (target.type === 'RestElement') {
    collectAssignedMemberNames(target.argument, writtenMembers);
  }
};

/**
 * @param {any} node
 * @param {Set<string>} writtenMembers
 */
const collectWrittenMembers = (node, writtenMembers) => {
  if (!node || typeof node !== 'object') return;

  if (Array.isArray(node)) {
    for (const entry of node) {
      collectWrittenMembers(entry, writtenMembers);
    }

    return;
  }

  if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
    return;
  }

  if (node.type === 'AssignmentExpression') {
    collectAssignedMemberNames(node.left, writtenMembers);
  }

  if (node.type === 'UpdateExpression') {
    const memberName = getWrittenMemberName(node.argument);

    if (memberName !== null) {
      writtenMembers.add(memberName);
    }
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === 'parent' || key === 'range' || key === 'loc') continue;
    if (!value || typeof value !== 'object') continue;

    collectWrittenMembers(value, writtenMembers);
  }
};

/**
 * @param {any} classBodyNode
 */
const getWrittenMembers = (classBodyNode) => {
  const writtenMembers = new Set();

  for (const member of classBodyNode.body) {
    collectWrittenMembers(member, writtenMembers);
  }

  return writtenMembers;
};

/**
 * @param {any} node
 */
const isConstantProperty = (node) => {
  if (node.type !== 'PropertyDefinition' || node.static || node.computed || !node.value) {
    return false;
  }

  if (isReactiveInitializer(node.value)) {
    return false;
  }

  return isConstantExpression(node.value);
};

/** @type {import('eslint').Rule.RuleModule} */
const classConstantProperty = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description: 'Require true class constants to use readonly and SCREAMING_CASE.',
      recommended: true,
    },
    schema: [],
    messages: {
      shouldBeReadonly: "'{{name}}' is a class constant and should be declared readonly.",
      shouldUseScreamingCase: "Readonly class constant '{{name}}' should use SCREAMING_CASE.",
    },
  },
  create(context) {
    return {
      ClassBody(node) {
        const writtenMembers = getWrittenMembers(node);

        for (const member of node.body) {
          if (!isConstantProperty(member)) {
            continue;
          }

          const memberName = getMemberName(member);

          if (memberName === null || writtenMembers.has(memberName)) {
            continue;
          }

          if (!member.readonly) {
            context.report({
              node: member,
              messageId: 'shouldBeReadonly',
              data: { name: memberName },
              fix(fixer) {
                const keyToken = context.sourceCode.getFirstToken(member.key);

                if (!keyToken) {
                  return null;
                }

                return fixer.insertTextBefore(keyToken, 'readonly ');
              },
            });

            continue;
          }

          if (!SCREAMING_CASE_RE.test(memberName)) {
            context.report({
              node: member.key,
              messageId: 'shouldUseScreamingCase',
              data: { name: memberName },
            });
          }
        }
      },
    };
  },
};

module.exports = classConstantProperty;
