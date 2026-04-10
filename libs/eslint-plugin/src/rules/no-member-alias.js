// @ts-check
'use strict';

/**
 * Disallows class members that exist solely as aliases for a nested property or
 * zero-arg method of another class member accessed via `this`.
 *
 * These aliases add an extra layer of indirection without any benefit. Instead,
 * the source member should be widened in accessibility so it can be referenced
 * directly at the call/template site.
 *
 * BAD — property alias:
 *   private stackDirective = inject(NotificationStackDirective);
 *   protected displayRefs = this.stackDirective.displayRefs;   // just an alias
 *
 * BAD — zero-arg method alias:
 *   context = inject(SomeContextToken);
 *   retry() { this.context.retry(); }
 *
 * GOOD:
 *   protected stackDirective = inject(NotificationStackDirective);
 *   // use stackDirective.displayRefs directly in the template
 *
 *   context = inject(SomeContextToken);
 *   // callers use directive.context.retry() directly
 *
 * Property rule fires when the entire initializer is a single `this.a.b`
 * expression — it will not flag deeper chains, computed accesses, or any
 * expression that does more than a plain property read.
 *
 * Method rule fires when a zero-param method body contains exactly one
 * statement that calls `this.a.b()` with zero arguments AND the method name
 * matches the target method name exactly. When the names differ the method is
 * an intentional API rename (e.g. retry → playerResource.reload) and is not
 * flagged.
 */

/**
 * Checks whether a method node is a pure zero-arg forwarding alias of the form:
 *   method() { this.source.method(); }
 *   method() { return this.source.method(); }
 *
 * @param {any} node  MethodDefinition
 * @returns {{ sourceName: string, propName: string } | null}
 */
const getMethodAliasInfo = (node) => {
  if (node.kind === 'constructor' || node.kind === 'get' || node.kind === 'set') return null;

  const fn = node.value;
  if (!fn || fn.params.length !== 0) return null;

  const body = fn.body;
  if (!body || body.type !== 'BlockStatement' || body.body.length !== 1) return null;

  const stmt = body.body[0];
  let callExpr = null;
  if (stmt.type === 'ExpressionStatement') {
    callExpr = stmt.expression;
  } else if (stmt.type === 'ReturnStatement' && stmt.argument) {
    callExpr = stmt.argument;
  }
  if (!callExpr || callExpr.type !== 'CallExpression') return null;

  // Must have zero arguments
  if (callExpr.arguments.length !== 0) return null;

  const callee = callExpr.callee;
  // callee must be: this.something.method
  if (callee.type !== 'MemberExpression') return null;
  if (callee.computed) return null;
  if (callee.property.type !== 'Identifier') return null;

  const obj = callee.object;
  if (obj.type !== 'MemberExpression') return null;
  if (obj.computed) return null;
  if (obj.object.type !== 'ThisExpression') return null;
  if (obj.property.type !== 'Identifier') return null;

  return { sourceName: obj.property.name, propName: callee.property.name };
};

/** @type {import('eslint').Rule.RuleModule} */
const noMemberAlias = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow class members that are pure aliases for a nested property or zero-arg method of another member accessed via `this`.',
      recommended: true,
    },
    messages: {
      noAlias:
        '`{{alias}}` is a pure alias for `this.{{source}}.{{prop}}`. ' +
        'Remove the alias and widen the accessibility of `{{source}}` so it can be used directly.',
    },
    schema: [],
  },
  create(context) {
    return {
      PropertyDefinition(node) {
        const value = node.value;
        if (!value) return;

        // Must be: this.something.property
        if (value.type !== 'MemberExpression') return;
        // Outer property must be a plain identifier (not computed)
        if (value.computed) return;
        if (value.property.type !== 'Identifier') return;

        const obj = value.object;
        // Object must itself be: this.something
        if (obj.type !== 'MemberExpression') return;
        if (obj.computed) return;
        if (obj.object.type !== 'ThisExpression') return;
        if (obj.property.type !== 'Identifier') return;

        const aliasName = node.key.type === 'Identifier' ? node.key.name : null;
        if (!aliasName) return;

        const sourceName = obj.property.name;
        const propName = value.property.name;

        context.report({
          node,
          messageId: 'noAlias',
          data: { alias: aliasName, source: sourceName, prop: propName },
        });
      },

      MethodDefinition(node) {
        const aliasName = node.key.type === 'Identifier' ? node.key.name : null;
        if (!aliasName) return;

        const info = getMethodAliasInfo(node);
        if (!info) return;

        // Only flag when names match — different names indicate an intentional
        // API rename, which is not a pure alias.
        if (aliasName !== info.propName) return;

        context.report({
          node,
          messageId: 'noAlias',
          data: { alias: aliasName, source: info.sourceName, prop: info.propName },
        });
      },
    };
  },
};

module.exports = noMemberAlias;
