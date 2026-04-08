// @ts-check
'use strict';

/** @type {import('eslint').Rule.RuleModule} */
const noInjectChain = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow chaining member access directly off inject() calls.',
      recommended: true,
    },
    messages: {
      noChain:
        'Do not chain off inject(). Assign to a const first: `const x = inject({{token}});` then use `x.{{member}}`.',
    },
    schema: [],
  },
  create(context) {
    return {
      MemberExpression(node) {
        const obj = node.object;
        if (obj.type === 'CallExpression' && obj.callee.type === 'Identifier' && obj.callee.name === 'inject') {
          // Allow inject(X).method() — immediately-invoked patterns like
          // inject(DestroyRef).onDestroy(...) are intentional Angular idioms.
          const parent = node.parent;
          if (parent && parent.type === 'CallExpression' && parent.callee === node) {
            return;
          }

          const token = obj.arguments[0]?.type === 'Identifier' ? obj.arguments[0].name : '...';
          const member = node.property.type === 'Identifier' ? node.property.name : '...';

          context.report({
            node,
            messageId: 'noChain',
            data: { token, member },
          });
        }
      },
    };
  },
};

module.exports = noInjectChain;
