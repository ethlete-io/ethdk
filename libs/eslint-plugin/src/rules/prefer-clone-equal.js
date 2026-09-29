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

const {
  MODULE_REFERENCE_SELECTOR,
  getModuleReference,
  isGlobalReference,
  resolveIdentifier,
} = require('./internals/import-resolution');

const LODASH_SOURCES = new Set(['lodash', 'lodash-es']);

/** @type {Record<string, { messageId: 'preferClone' | 'preferEqual'; method: string }>} */
const LODASH_METHODS = {
  cloneDeep: { messageId: 'preferClone', method: 'lodash cloneDeep' },
  isEqual: { messageId: 'preferEqual', method: 'isEqual' },
};

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

        if (
          callee.type === 'MemberExpression' &&
          !callee.computed &&
          callee.object.type === 'Identifier' &&
          callee.property.type === 'Identifier' &&
          Object.hasOwn(LODASH_METHODS, callee.property.name)
        ) {
          const resolved = resolveIdentifier(context.sourceCode, callee.object);
          if (
            resolved?.source &&
            LODASH_SOURCES.has(resolved.source) &&
            (resolved.name === '*' || resolved.name === 'default')
          ) {
            const { messageId, method } = LODASH_METHODS[callee.property.name];
            context.report({ node, messageId, data: { method } });
            return;
          }
        }

        if (
          isGlobalReference(context.sourceCode, callee) &&
          callee.name === 'require' &&
          node.arguments[0]?.type === 'Literal' &&
          LODASH_SOURCES.has(String(node.arguments[0].value))
        ) {
          const { parent } = node;
          const method =
            parent.type === 'MemberExpression' && parent.object === node && parent.property.type === 'Identifier'
              ? parent.property.name
              : null;
          if (method && Object.hasOwn(LODASH_METHODS, method)) {
            const { messageId, method: label } = LODASH_METHODS[method];
            context.report({ node, messageId, data: { method: label } });
          }
          return;
        }

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

        if (isGlobalReference(context.sourceCode, callee) && callee.name === 'structuredClone') {
          context.report({ node, messageId: 'preferClone', data: { method: 'structuredClone()' } });
        }
      },

      [MODULE_REFERENCE_SELECTOR](node) {
        const reference = getModuleReference(node);
        if (!reference) return;
        const src = reference.source;

        if (src === 'lodash' || src === 'lodash-es') {
          for (const { name } of reference.named) {
            if (name === 'cloneDeep') {
              context.report({ node, messageId: 'preferClone', data: { method: 'lodash cloneDeep' } });
            } else if (name === 'isEqual') {
              context.report({ node, messageId: 'preferEqual', data: { method: 'isEqual' } });
            }
          }
          return;
        }

        if (src === 'lodash.clonedeep') {
          context.report({ node, messageId: 'preferClone', data: { method: 'lodash cloneDeep' } });
          return;
        }

        if (src === 'lodash.isequal') {
          context.report({ node, messageId: 'preferEqual', data: { method: 'isEqual' } });
          return;
        }

        if (src === 'lodash/cloneDeep' || src === 'lodash-es/cloneDeep') {
          context.report({ node, messageId: 'preferClone', data: { method: 'lodash cloneDeep' } });
          return;
        }

        if (src === 'lodash/isEqual' || src === 'lodash-es/isEqual') {
          context.report({ node, messageId: 'preferEqual', data: { method: 'isEqual' } });
        }
      },
    };
  },
};

module.exports = preferCloneEqual;
