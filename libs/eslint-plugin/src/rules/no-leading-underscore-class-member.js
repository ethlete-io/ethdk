// @ts-check
'use strict';

/**
 * @param {string} name
 */
const getFixedName = (name) => name.replace(/^_+/, '');

/**
 * @param {any} node
 */
const getDirectMemberName = (node) => {
  if (node.parent?.type !== 'ClassBody') return null;
  if (node.static || node.computed) return null;
  if (node.type === 'MethodDefinition' && node.kind === 'constructor') return null;
  return node.key?.type === 'Identifier' ? node.key.name : null;
};

/** @type {import('eslint').Rule.RuleModule} */
const noLeadingUnderscoreClassMember = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow leading underscores on class members and rename private members automatically when safe.',
    },
    fixable: 'code',
    schema: [],
    messages: {
      noLeadingUnderscore: "Class members must not use a leading underscore. Rename '{{oldName}}' to '{{newName}}'.",
    },
  },
  create(context) {
    /**
     * @type {Array<{
     *   classBody: import('eslint').Rule.Node,
     *   declaredNames: Set<string>,
     *   membersByName: Map<string, any[]>,
     *   memberReads: any[],
     * }>}
     */
    const classStack = [];

    /**
     * @param {any} node
     */
    const registerMember = (node) => {
      const frame = classStack[classStack.length - 1];
      if (!frame || node.parent !== frame.classBody) return;

      const name = getDirectMemberName(node);
      if (!name) return;

      frame.declaredNames.add(name);

      if (!name.startsWith('_')) return;

      const members = frame.membersByName.get(name) ?? [];
      members.push(node);
      frame.membersByName.set(name, members);
    };

    return {
      ClassBody(node) {
        classStack.push({
          classBody: node,
          declaredNames: new Set(),
          membersByName: new Map(),
          memberReads: [],
        });
      },

      'ClassBody:exit'() {
        const frame = classStack.pop();
        if (!frame) return;

        for (const [oldName, memberNodes] of frame.membersByName) {
          const newName = getFixedName(oldName);
          const canFix =
            newName.length > 0 &&
            !frame.declaredNames.has(newName) &&
            memberNodes.every((memberNode) => memberNode.accessibility === 'private');

          for (const memberNode of memberNodes) {
            context.report({
              node: memberNode.key,
              messageId: 'noLeadingUnderscore',
              data: { oldName, newName },
              fix: canFix
                ? (fixer) => {
                    const fixes = memberNodes.map((node) => fixer.replaceText(node.key, newName));

                    for (const memberExpression of frame.memberReads) {
                      if (memberExpression.property.name !== oldName) continue;
                      fixes.push(fixer.replaceText(memberExpression.property, newName));
                    }

                    return fixes;
                  }
                : null,
            });
          }
        }
      },

      PropertyDefinition: registerMember,
      MethodDefinition: registerMember,

      MemberExpression(node) {
        const frame = classStack[classStack.length - 1];
        if (!frame) return;
        if (node.object?.type !== 'ThisExpression' || node.computed) return;
        if (node.property?.type !== 'Identifier') return;

        frame.memberReads.push(node);
      },
    };
  },
};

module.exports = noLeadingUnderscoreClassMember;
