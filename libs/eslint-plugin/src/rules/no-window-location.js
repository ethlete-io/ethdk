// @ts-check
'use strict';

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
    return {
      // ── window.location.{prop} reads ────────────────────────────────────────
      MemberExpression(node) {
        if (node.property.type !== 'Identifier') return;
        const prop = node.property.name;

        if (!LOCATION_STATE_PROPS.has(prop)) return;

        // Must be window.location.{prop} — check the object is window.location
        const parent = node.object;
        if (
          parent.type !== 'MemberExpression' ||
          parent.object.type !== 'Identifier' ||
          parent.object.name !== 'window' ||
          parent.property.type !== 'Identifier' ||
          parent.property.name !== 'location'
        ) {
          return;
        }

        // Skip assignments TO window.location.href (navigation redirect)
        if (prop === 'href' && node.parent.type === 'AssignmentExpression' && node.parent.left === node) {
          return;
        }

        context.report({
          node,
          messageId: 'noWindowLocation',
          data: { prop, replacement: LOCATION_STATE_PROPS.get(prop) },
        });
      },

      // ── new URLSearchParams(window.location.search) ─────────────────────────
      NewExpression(node) {
        if (node.callee.type !== 'Identifier' || node.callee.name !== 'URLSearchParams') return;
        const arg = node.arguments[0];
        if (!arg) return;
        if (
          arg.type === 'MemberExpression' &&
          arg.object.type === 'MemberExpression' &&
          arg.object.object.type === 'Identifier' &&
          arg.object.object.name === 'window' &&
          arg.object.property.type === 'Identifier' &&
          arg.object.property.name === 'location' &&
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
