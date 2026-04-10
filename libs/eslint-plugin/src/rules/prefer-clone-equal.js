// @ts-check
'use strict';

/**
 * Prefers the 'clone()' and 'equal()' utilities from '@ethlete/core' over
 * ad-hoc deep-clone and deep-equality patterns.
 *
 * clone():
 *   - Handles all JS types (Date, RegExp, Map, Set, ArrayBuffer, typed arrays)
 *   - Preserves prototype chains
 *   - Unlike JSON round-trip: does not drop undefined, functions, or Dates become strings
 *   - Unlike structuredClone: no transfer semantics needed
 *
 * equal():
 *   - Full deep equality (Date, RegExp, Map, Set, ArrayBuffer, typed arrays)
 *   - No lodash dependency needed
 *
 * BAD:
 *   JSON.parse(JSON.stringify(obj))          // lossy, slow, no prototype
 *   structuredClone(obj)                     // for components: use clone()
 *   import { cloneDeep } from 'lodash';      // unnecessary dependency
 *   import { isEqual } from 'lodash';        // unnecessary dependency
 *
 * GOOD:
 *   import { clone, equal } from '@ethlete/core';
 */

/** @type {import('eslint').Rule.RuleModule} */
const preferCloneEqual = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        "Prefer 'clone()' / 'equal()' from '@ethlete/core' over JSON round-trip cloning, structuredClone, or lodash cloneDeep / isEqual.",
      recommended: true,
    },
    messages: {
      preferClone:
        "Avoid '{{method}}' for deep cloning. Use 'clone()' from '@ethlete/core' instead — it handles all JS types, preserves prototypes, and does not lose undefined values or Dates.",
      preferEqual:
        "Avoid lodash '{{method}}' for deep equality. Use 'equal()' from '@ethlete/core' instead — no extra dependency needed.",
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        const { callee } = node;

        // ── JSON.parse(JSON.stringify(expr)) ─────────────────────────────────
        if (
          callee.type === 'MemberExpression' &&
          callee.object.type === 'Identifier' &&
          callee.object.name === 'JSON' &&
          callee.property.type === 'Identifier' &&
          callee.property.name === 'parse' &&
          node.arguments[0]?.type === 'CallExpression'
        ) {
          const innerCall = node.arguments[0];
          if (
            innerCall.callee.type === 'MemberExpression' &&
            innerCall.callee.object.type === 'Identifier' &&
            innerCall.callee.object.name === 'JSON' &&
            innerCall.callee.property.type === 'Identifier' &&
            innerCall.callee.property.name === 'stringify'
          ) {
            context.report({ node, messageId: 'preferClone', data: { method: 'JSON.parse(JSON.stringify(...))' } });
            return;
          }
        }

        // ── structuredClone(expr) ─────────────────────────────────────────────
        if (callee.type === 'Identifier' && callee.name === 'structuredClone') {
          context.report({ node, messageId: 'preferClone', data: { method: 'structuredClone()' } });
        }
      },

      ImportDeclaration(node) {
        const src = node.source.value;

        // ── lodash cloneDeep / isEqual ────────────────────────────────────────
        // import { cloneDeep } from 'lodash' / 'lodash-es'
        // import { isEqual } from 'lodash' / 'lodash-es'
        if (src === 'lodash' || src === 'lodash-es') {
          for (const specifier of node.specifiers) {
            if (specifier.type !== 'ImportSpecifier') continue;
            const name = specifier.imported.name;
            if (name === 'cloneDeep') {
              context.report({ node, messageId: 'preferClone', data: { method: 'lodash cloneDeep' } });
            } else if (name === 'isEqual') {
              context.report({ node, messageId: 'preferEqual', data: { method: 'isEqual' } });
            }
          }
          return;
        }

        // import cloneDeep from 'lodash/cloneDeep'
        if (src === 'lodash/cloneDeep' || src === 'lodash-es/cloneDeep') {
          context.report({ node, messageId: 'preferClone', data: { method: 'lodash cloneDeep' } });
          return;
        }

        // import isEqual from 'lodash/isEqual'
        if (src === 'lodash/isEqual' || src === 'lodash-es/isEqual') {
          context.report({ node, messageId: 'preferEqual', data: { method: 'isEqual' } });
        }
      },
    };
  },
};

module.exports = preferCloneEqual;
