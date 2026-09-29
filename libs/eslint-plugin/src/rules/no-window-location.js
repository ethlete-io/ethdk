// @ts-check
'use strict';

const { isGlobalReference } = require('./internals/import-resolution');

/**
 * Disallows reading URL state from window.location properties.
 *
 * window.location reads are:
 * - Not reactive — they return a stale snapshot at call time
 * - Not SSR-safe — window is undefined during server-side rendering
 *
 * @ethlete/core ships reactive signal utilities that replace all URL-reading use cases.
 *
 * BAD:
 *   window.location.pathname       → injectRoute()
 *   window.location.href           → injectUrl()
 *   window.location.search         → injectQueryParams() / injectQueryParam(key)
 *   window.location.hash           → injectFragment()
 *   new URLSearchParams(window.location.search)  → injectQueryParams() / injectQueryParam(key)
 *
 * GOOD:
 *   import {
 *     injectUrl, injectRoute, injectQueryParam, injectQueryParams, injectFragment
 *   } from '@ethlete/core';
 *
 * NOTE: window.location.href = url (assignment/navigation) and
 * window.location.hostname / window.location.origin are not flagged.
 */

/** URL state properties that have reactive signal equivalents. */
const LOCATION_STATE_PROPS = new Map([
  ['href', "injectUrl() from '@ethlete/core'"],
  ['pathname', "injectRoute() from '@ethlete/core'"],
  ['search', "injectQueryParams() / injectQueryParam(key) from '@ethlete/core'"],
  ['hash', "injectFragment() from '@ethlete/core'"],
]);

/** @type {import('eslint').Rule.RuleModule} */
const noWindowLocation = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        "Disallow reading URL state from 'window.location.*'. Use reactive signal utilities from '@ethlete/core' instead.",
      recommended: true,
    },
    messages: {
      noWindowLocation:
        "Avoid reading 'window.location.{{prop}}'. Use {{replacement}} instead — it returns a reactive signal that is SSR-safe and updates on navigation.",
      noURLSearchParams:
        "Avoid 'new URLSearchParams(window.location.search)'. Use 'injectQueryParam(key)' or 'injectQueryParams()' from '@ethlete/core' instead — they return reactive signals and are SSR-safe.",
    },
    schema: [],
  },
  create(context) {
    const isGlobalObject = (node) =>
      node.type === 'Identifier' &&
      (node.name === 'window' || node.name === 'globalThis') &&
      isGlobalReference(context.sourceCode, node);

    const findVariable = (identifier) => {
      for (let scope = context.sourceCode.getScope(identifier); scope; scope = scope.upper) {
        const variable = scope.set.get(identifier.name);
        if (variable) return variable;
      }

      return null;
    };

    const isLocation = (node) => {
      if (node.type === 'Identifier') {
        if (node.name === 'location' && isGlobalReference(context.sourceCode, node)) return true;

        const definitions = findVariable(node)?.defs ?? [];

        return (
          definitions.length === 1 &&
          definitions[0].type === 'Variable' &&
          definitions[0].node.id.type === 'Identifier' &&
          definitions[0].parent.kind === 'const' &&
          !!definitions[0].node.init &&
          isLocation(definitions[0].node.init)
        );
      }

      return (
        node.type === 'MemberExpression' &&
        !node.computed &&
        isGlobalObject(node.object) &&
        node.property.type === 'Identifier' &&
        node.property.name === 'location'
      );
    };

    return {
      MemberExpression(node) {
        if (node.property.type !== 'Identifier' || node.computed) return;
        const prop = node.property.name;

        if (!LOCATION_STATE_PROPS.has(prop)) return;
        if (!isLocation(node.object)) return;

        if (prop === 'href' && node.parent.type === 'AssignmentExpression' && node.parent.left === node) {
          if (node.parent.operator === '=') return;
        }

        context.report({
          node,
          messageId: 'noWindowLocation',
          data: { prop, replacement: LOCATION_STATE_PROPS.get(prop) },
        });
      },

      VariableDeclarator(node) {
        if (node.id.type !== 'ObjectPattern' || !node.init || !isLocation(node.init)) return;

        for (const property of node.id.properties) {
          if (property.type !== 'Property' || property.computed || property.key.type !== 'Identifier') continue;
          if (!LOCATION_STATE_PROPS.has(property.key.name)) continue;

          context.report({
            node: property,
            messageId: 'noWindowLocation',
            data: { prop: property.key.name, replacement: LOCATION_STATE_PROPS.get(property.key.name) },
          });
        }
      },

      NewExpression(node) {
        if (node.callee.type !== 'Identifier' || node.callee.name !== 'URLSearchParams') return;
        const arg = node.arguments[0];
        if (!arg) return;
        if (
          arg.type === 'MemberExpression' &&
          isLocation(arg.object) &&
          arg.property.type === 'Identifier' &&
          arg.property.name === 'search'
        ) {
          context.report({ node, messageId: 'noURLSearchParams' });
        }
      },
    };
  },
};

module.exports = noWindowLocation;
