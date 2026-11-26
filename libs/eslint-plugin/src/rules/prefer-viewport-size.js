// @ts-check
'use strict';

/**
 * Prefers injectViewportSize() from @ethlete/core over reading raw viewport
 * dimensions from the global window object.
 *
 * injectViewportSize() returns a reactive signal that:
 * - Updates automatically when the viewport is resized
 * - Works on the server (SSR-safe)
 * - Participates in Angular's change detection
 *
 * BAD:
 *   const w = window.innerWidth;
 *   document.defaultView?.innerHeight
 *
 * GOOD:
 *   const viewport = injectViewportSize(); // from @ethlete/core
 *   const w = viewport().width;
 *   const h = viewport().height;
 */

const { isGlobalReference } = require('./internals/import-resolution');

const VIEWPORT_PROPERTIES = new Set(['innerWidth', 'innerHeight']);
const GLOBAL_OBJECTS = new Set(['window', 'globalThis', 'self']);

/**
 * @param {any} node
 * @returns {string | null}
 */
const getPropertyName = (node) => {
  if (!node.computed && node.property.type === 'Identifier') return node.property.name;
  if (node.computed && node.property.type === 'Literal' && typeof node.property.value === 'string') {
    return node.property.value;
  }

  return null;
};

/**
 * @param {any} node
 */
const getThisClassBody = (node) => {
  let current = node.parent;

  while (current) {
    if (current.type === 'ClassBody') return current;
    current = current.parent;
  }

  return null;
};

/** @type {import('eslint').Rule.RuleModule} */
const preferViewportSize = {
  meta: {
    type: 'suggestion',
    docs: {
      description: "Prefer 'injectViewportSize()' from '@ethlete/core' over direct window dimension properties.",
      recommended: true,
    },
    messages: {
      preferViewportSize:
        "Avoid reading '{{prop}}' directly from window. Use 'injectViewportSize()' from '@ethlete/core' — it returns a reactive signal that stays up to date as the viewport resizes.",
    },
    schema: [],
  },
  create(context) {
    const { sourceCode } = context;
    /** @type {WeakMap<any, Set<string>>} */
    const classWindowMembers = new WeakMap();

    /**
     * @param {any} classBody
     * @returns {Set<string>}
     */
    const getClassWindowMembers = (classBody) => {
      const cached = classWindowMembers.get(classBody);
      if (cached) return cached;

      /** @type {Set<string>} */
      const members = new Set();
      classWindowMembers.set(classBody, members);

      /** @param {any} node */
      const visit = (node) => {
        if (!node || typeof node.type !== 'string') return;
        if (node !== classBody && node.type === 'ClassBody') return;

        if (
          node.type === 'PropertyDefinition' &&
          !node.computed &&
          node.key.type === 'Identifier' &&
          isWindowLike(node.value)
        ) {
          members.add(node.key.name);
        }

        if (
          node.type === 'AssignmentExpression' &&
          node.left.type === 'MemberExpression' &&
          node.left.object.type === 'ThisExpression' &&
          !node.left.computed &&
          node.left.property.type === 'Identifier' &&
          isWindowLike(node.right)
        ) {
          members.add(node.left.property.name);
        }

        for (const key of Object.keys(node)) {
          if (key === 'parent') continue;

          const value = node[key];
          if (Array.isArray(value)) value.forEach(visit);
          else if (value && typeof value.type === 'string') visit(value);
        }
      };

      visit(classBody);

      return members;
    };

    /**
     * @param {any} node
     * @param {Set<any>} seen
     * @returns {boolean}
     */
    const isWindowLike = (node, seen = new Set()) => {
      if (!node || seen.has(node)) return false;
      seen.add(node);

      if (node.type === 'ChainExpression' || node.type === 'TSNonNullExpression' || node.type === 'TSAsExpression') {
        return isWindowLike(node.expression, seen);
      }

      if (node.type === 'Identifier') {
        if (isGlobalReference(sourceCode, node)) return GLOBAL_OBJECTS.has(node.name);

        /** @type {import('eslint').Scope.Scope | null} */
        let scope = sourceCode.getScope(node);

        while (scope) {
          const variable = scope.set.get(node.name);

          if (variable) {
            const definition = /** @type {any} */ (variable.defs[0]);

            return definition?.type === 'Variable' && isWindowLike(definition.node.init, seen);
          }

          scope = scope.upper;
        }

        return false;
      }

      if (node.type !== 'MemberExpression') return false;

      const name = getPropertyName(node);
      if (name === 'defaultView') return true;
      if (name && GLOBAL_OBJECTS.has(name) && isWindowLike(node.object, seen)) return true;
      if (node.object.type !== 'ThisExpression' || !name) return false;

      const classBody = getThisClassBody(node);

      return !!classBody && getClassWindowMembers(classBody).has(name);
    };

    return {
      MemberExpression(node) {
        const prop = getPropertyName(node);
        if (!prop || !VIEWPORT_PROPERTIES.has(prop)) return;
        if (!isWindowLike(node.object)) return;

        context.report({
          node,
          messageId: 'preferViewportSize',
          data: { prop },
        });
      },
      'Program:exit'(program) {
        const globalScope = sourceCode.getScope(program);
        const declaredGlobalReferences = [...VIEWPORT_PROPERTIES].flatMap((name) => {
          const variable = globalScope.set.get(name);

          return variable && variable.defs.length === 0 ? variable.references : [];
        });

        for (const reference of [...globalScope.through, ...declaredGlobalReferences]) {
          const { identifier } = reference;
          if (!VIEWPORT_PROPERTIES.has(identifier.name)) continue;

          context.report({
            node: identifier,
            messageId: 'preferViewportSize',
            data: { prop: identifier.name },
          });
        }
      },
    };
  },
};

module.exports = preferViewportSize;
