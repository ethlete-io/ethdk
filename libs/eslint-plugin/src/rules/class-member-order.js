// @ts-check
'use strict';

/** @typedef {'inject' | 'input' | 'output' | 'query' | 'property' | 'constructor' | 'method' | 'private-method'} TMemberGroup */
/** @typedef {{ dependencies: Set<string>; group: TMemberGroup; groupIndex: number; name: string; node: any; originalIndex: number }} TMemberEntry */
/** @typedef {TMemberEntry & { segmentText: string }} TSegmentEntry */

const INPUT_APIS = new Set(['input', 'model']);
const OUTPUT_APIS = new Set(['output', 'outputFromObservable']);
const QUERY_APIS = new Set(['viewChild', 'viewChildren', 'contentChild', 'contentChildren']);

/** @type {TMemberGroup[]} */
const MEMBER_GROUP_ORDER = [
  'inject',
  'input',
  'output',
  'query',
  'property',
  'constructor',
  'method',
  'private-method',
];

const MEMBER_GROUP_ORDER_TEXT =
  'inject() members, inputs/model(), outputs, view/content queries, other properties, constructor, public methods, private methods';

const MEMBER_GROUP_INDEX = new Map(
  MEMBER_GROUP_ORDER.map(/** @param {TMemberGroup} group @param {number} index */ (group, index) => [group, index]),
);

/**
 * @param {any} key
 */
const getMemberNameFromKey = (key) => {
  if (!key) return null;
  if (key.type === 'Identifier') return key.name;
  if (key.type === 'Literal' && typeof key.value === 'string') return key.value;
  if (key.type === 'PrivateIdentifier') return key.name;

  return null;
};

/**
 * @param {any} node
 */
const getMemberName = (node) => {
  if (node.type === 'MethodDefinition' && node.kind === 'constructor') {
    return 'constructor';
  }

  return getMemberNameFromKey(node.key);
};

/**
 * @param {any} value
 */
const getCallRootName = (value) => {
  if (!value || value.type !== 'CallExpression') return null;

  const { callee } = value;

  if (callee.type === 'Identifier') {
    return callee.name;
  }

  if (callee.type === 'MemberExpression' && !callee.computed && callee.object.type === 'Identifier') {
    return callee.object.name;
  }

  return null;
};

/**
 * @param {any} node
 * @param {Set<string>} apiNames
 */
const isPropertyInitializedWith = (node, apiNames) => {
  if (node.type !== 'PropertyDefinition') return false;

  const apiName = getCallRootName(node.value);
  return apiName !== null && apiNames.has(apiName);
};

/**
 * @param {any} node
 * @returns {TMemberGroup | null}
 */
const getMemberGroup = (node) => {
  if (node.static) return null;

  if (node.type === 'PropertyDefinition') {
    if (isPropertyInitializedWith(node, new Set(['inject']))) {
      return 'inject';
    }

    if (isPropertyInitializedWith(node, INPUT_APIS)) {
      return 'input';
    }

    if (isPropertyInitializedWith(node, OUTPUT_APIS)) {
      return 'output';
    }

    if (isPropertyInitializedWith(node, QUERY_APIS)) {
      return 'query';
    }

    return 'property';
  }

  if (node.type === 'MethodDefinition') {
    if (node.kind === 'constructor') {
      return 'constructor';
    }

    if (node.accessibility === 'private') {
      return 'private-method';
    }

    return 'method';
  }

  return null;
};

/**
 * @param {any} node
 * @param {Set<string>} references
 */
const collectThisReferences = (node, references) => {
  if (!node || typeof node !== 'object') return;

  if (Array.isArray(node)) {
    for (const entry of node) {
      collectThisReferences(entry, references);
    }

    return;
  }

  if (
    node.type === 'MemberExpression' &&
    !node.computed &&
    node.object?.type === 'ThisExpression' &&
    (node.property?.type === 'Identifier' || node.property?.type === 'PrivateIdentifier')
  ) {
    references.add(node.property.name);
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === 'parent' || key === 'range' || key === 'loc') continue;
    if (!value || typeof value !== 'object') continue;

    collectThisReferences(value, references);
  }
};

/**
 * @param {any} node
 */
const getInitializerDependencies = (node) => {
  if (node.type !== 'PropertyDefinition' || !node.value) {
    return new Set();
  }

  const dependencies = new Set();
  collectThisReferences(node.value, dependencies);

  const memberName = getMemberName(node);

  if (memberName !== null) {
    dependencies.delete(memberName);
  }

  return dependencies;
};

/**
 * @param {any} node
 * @param {number} originalIndex
 * @returns {TMemberEntry | null}
 */
const toMemberEntry = (node, originalIndex) => {
  const group = getMemberGroup(node);
  const name = getMemberName(node);

  if (group === null || name === null) {
    return null;
  }

  return {
    dependencies: getInitializerDependencies(node),
    group,
    groupIndex: MEMBER_GROUP_INDEX.get(group),
    name,
    node,
    originalIndex,
  };
};

/**
 * @param {TMemberEntry} currentMember
 * @param {TMemberEntry} earlierMember
 */
const getOrderingConflict = (currentMember, earlierMember) => {
  if (currentMember.dependencies.has(earlierMember.name)) {
    return null;
  }

  if (earlierMember.dependencies.has(currentMember.name)) {
    return {
      type: 'dependency',
      blockingMember: earlierMember,
    };
  }

  if (currentMember.groupIndex < earlierMember.groupIndex) {
    return {
      type: 'group',
      blockingMember: earlierMember,
    };
  }

  return null;
};

/**
 * @param {TMemberEntry[]} members
 */
const sortMembers = (members) => {
  /** @type {TMemberEntry[]} */
  const remainingMembers = [...members];
  /** @type {TMemberEntry[]} */
  const sortedMembers = [];
  const remainingNames = new Set(remainingMembers.map((m) => m.name));

  while (remainingMembers.length > 0) {
    const readyMembers = remainingMembers
      .filter((member) => [...member.dependencies].every((dependencyName) => !remainingNames.has(dependencyName)))
      .sort((left, right) => {
        if (left.groupIndex !== right.groupIndex) {
          return left.groupIndex - right.groupIndex;
        }

        return left.originalIndex - right.originalIndex;
      });

    const nextMember = readyMembers[0];

    if (!nextMember) {
      return null;
    }

    sortedMembers.push(nextMember);

    const nextMemberIndex = remainingMembers.indexOf(nextMember);
    remainingMembers.splice(nextMemberIndex, 1);
    remainingNames.delete(nextMember.name);
  }

  return sortedMembers;
};

/**
 * @param {import('eslint').SourceCode} sourceCode
 * @param {any} classBodyNode
 * @param {TMemberEntry[]} members
 */
const getSegmentEntries = (sourceCode, classBodyNode, members) => {
  const openingBrace = sourceCode.getFirstToken(classBodyNode);
  const closingBrace = sourceCode.getLastToken(classBodyNode);

  if (!openingBrace || !closingBrace || openingBrace.value !== '{' || closingBrace.value !== '}') {
    return null;
  }

  let segmentStart = openingBrace.range[1];

  const segmentEntries = members.map((member) => {
    const segmentText = sourceCode.text.slice(segmentStart, member.node.range[1]);
    segmentStart = member.node.range[1];

    return {
      ...member,
      segmentText,
    };
  });

  const suffix = sourceCode.text.slice(segmentStart, closingBrace.range[0]);

  return {
    closingBrace,
    openingBrace,
    segmentEntries,
    suffix,
  };
};

/**
 * @param {import('eslint').SourceCode} sourceCode
 * @param {any} classBodyNode
 * @param {TMemberEntry[]} members
 */
const buildClassOrderFix = (sourceCode, classBodyNode, members) => {
  if (classBodyNode.body.length !== members.length) {
    return null;
  }

  const sortedMembers = sortMembers(members);

  if (!sortedMembers) {
    return null;
  }

  const segments = getSegmentEntries(sourceCode, classBodyNode, members);

  if (!segments) {
    return null;
  }

  const { closingBrace, openingBrace, segmentEntries, suffix } = segments;
  const segmentEntriesByOriginalIndex = new Map(
    segmentEntries.map(
      /** @param {TSegmentEntry} segmentEntry */ (segmentEntry) => [segmentEntry.originalIndex, segmentEntry],
    ),
  );
  const sortedSegmentEntries = sortedMembers.map((member) => segmentEntriesByOriginalIndex.get(member.originalIndex));

  if (sortedSegmentEntries.some((entry) => entry === undefined)) {
    return null;
  }

  const isAlreadySorted = sortedSegmentEntries.every((entry, index) => entry === segmentEntries[index]);

  if (isAlreadySorted) {
    return null;
  }

  const reorderedBody = sortedSegmentEntries.map((entry) => entry.segmentText).join('') + suffix;

  return (fixer) => fixer.replaceTextRange([openingBrace.range[1], closingBrace.range[0]], reorderedBody);
};

/** @type {import('eslint').Rule.RuleModule} */
const classMemberOrder = {
  meta: {
    type: 'layout',
    fixable: 'code',
    docs: {
      description:
        'Require class members to follow the styleguide order for inject members, inputs, outputs, queries, properties, constructor, and methods.',
      recommended: true,
    },
    schema: [],
    messages: {
      dependencyOrder:
        "'{{name}}' should be declared before '{{dependentName}}' because '{{dependentName}}' references it in an initializer.",
      groupOrder:
        "'{{name}}' should be declared before '{{blockingName}}'. Class members should be ordered as: {{order}}.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      ClassBody(node) {
        const members = node.body
          .map(
            /** @param {any} member @param {number} originalIndex */ (member, originalIndex) =>
              toMemberEntry(member, originalIndex),
          )
          .filter(Boolean);

        if (members.length < 2) {
          return;
        }

        // Methods live on the prototype and are available regardless of declaration order,
        // so this.method() calls in initializers don't create real ordering dependencies.
        const methodNames = new Set(
          members.filter((m) => m.group === 'method' || m.group === 'private-method').map((m) => m.name),
        );
        if (methodNames.size > 0) {
          for (const member of members) {
            for (const dep of member.dependencies) {
              if (methodNames.has(dep)) {
                member.dependencies.delete(dep);
              }
            }
          }
        }

        const fix = buildClassOrderFix(sourceCode, node, members);
        let hasAttachedFix = false;

        for (let currentIndex = 1; currentIndex < members.length; currentIndex++) {
          const currentMember = members[currentIndex];

          for (let earlierIndex = currentIndex - 1; earlierIndex >= 0; earlierIndex--) {
            const earlierMember = members[earlierIndex];
            const conflict = getOrderingConflict(currentMember, earlierMember);

            if (!conflict) {
              continue;
            }

            if (conflict.type === 'dependency') {
              context.report({
                node: currentMember.node,
                messageId: 'dependencyOrder',
                data: {
                  name: currentMember.name,
                  dependentName: conflict.blockingMember.name,
                },
                fix: !hasAttachedFix ? fix : null,
              });

              hasAttachedFix = hasAttachedFix || Boolean(fix);

              break;
            }

            context.report({
              node: currentMember.node,
              messageId: 'groupOrder',
              data: {
                name: currentMember.name,
                blockingName: conflict.blockingMember.name,
                order: MEMBER_GROUP_ORDER_TEXT,
              },
              fix: !hasAttachedFix ? fix : null,
            });

            hasAttachedFix = hasAttachedFix || Boolean(fix);

            break;
          }
        }
      },
    };
  },
};

module.exports = classMemberOrder;
