// @ts-check
'use strict';

/**
 * Disallows trivial wrapper methods that do nothing but forward all their
 * arguments to another call.
 *
 * These methods add an extra layer of indirection without adding any value.
 * Call sites should invoke the target directly.
 *
 * BAD:
 *   setValue(val: string) { this.value.set(val); }           // just delegates
 *   getItem(key: string) { return this.store.get(key); }     // just delegates
 *   doThing(a: string, b: number) { this.impl.doThing(a, b); }
 *
 * GOOD:
 *   // Call this.value.set(val) directly at the call sites.
 *   // If the method wraps something non-trivially (transforms args, adds logic), it is fine.
 */

/**
 * Returns true when the param is a plain identifier (no default, no destructuring, no rest).
 * @param {import('@typescript-eslint/types').TSESTree.Parameter} param
 */
const isSimpleParam = (param) => param.type === 'Identifier';

/**
 * Returns the single CallExpression in the method body when the method is a
 * trivial all-args-forwarding wrapper, or null otherwise.
 *
 * Matches both void wrappers:
 *   setValue(val) { this.value.set(val); }
 * and return wrappers:
 *   get(key) { return this.store.get(key); }
 *
 * @param {import('eslint').Rule.Node} methodNode  MethodDefinition node
 * @returns {import('eslint').Rule.Node | null}
 */
const getTrivialCallExpr = (methodNode) => {
  const fnValue = methodNode.value;
  if (!fnValue) return null;

  const params = fnValue.params;
  // Require at least one parameter — zero-param delegate methods are deliberate API surface.
  if (params.length === 0) return null;
  // All params must be simple identifiers (no destructuring, defaults, or rest).
  if (!params.every(isSimpleParam)) return null;

  const body = fnValue.body;
  if (!body || body.type !== 'BlockStatement') return null;
  if (body.body.length !== 1) return null;

  const stmt = body.body[0];

  let callExpr = null;
  if (stmt.type === 'ExpressionStatement') {
    callExpr = stmt.expression;
  } else if (stmt.type === 'ReturnStatement' && stmt.argument) {
    callExpr = stmt.argument;
  }

  if (!callExpr || callExpr.type !== 'CallExpression') return null;
  if (callExpr.arguments.length !== params.length) return null;

  // All arguments must be the method's own param names in the same order.
  const allMatch = params.every((param, i) => {
    const arg = callExpr.arguments[i];
    return arg.type === 'Identifier' && arg.name === param.name;
  });

  return allMatch ? callExpr : null;
};

/** @type {import('eslint').Rule.RuleModule} */
const noTrivialWrapperMethod = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow trivial wrapper methods that only forward all arguments to another call.',
      recommended: true,
    },
    messages: {
      noTrivialWrapperMethod:
        "'{{name}}' is a trivial wrapper — it only forwards all its arguments to '{{target}}'. Remove it and call '{{target}}' directly at each call site.",
    },
    schema: [],
  },
  create(context) {
    return {
      MethodDefinition(node) {
        // Skip constructors, getters, and setters — they commonly delegate for good reasons.
        if (node.kind === 'constructor' || node.kind === 'get' || node.kind === 'set') return;

        const callExpr = getTrivialCallExpr(node);
        if (!callExpr) return;

        const methodName = node.key.type === 'Identifier' ? node.key.name : null;
        if (!methodName) return;

        const callee = callExpr.callee;
        const targetName =
          callee.type === 'MemberExpression'
            ? context.sourceCode.getText(callee)
            : callee.type === 'Identifier'
              ? callee.name
              : null;

        if (!targetName) return;

        context.report({
          node,
          messageId: 'noTrivialWrapperMethod',
          data: { name: methodName, target: targetName },
        });
      },
    };
  },
};

module.exports = noTrivialWrapperMethod;
