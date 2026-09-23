// @ts-check
'use strict';

/**
 * Disallows injecting Angular's ActivatedRoute (fully replaced),
 * and disallows reading route state directly from an injected Router instance.
 *
 * inject(Router) is allowed — it is still needed for navigation (.navigate(),
 * .navigateByUrl(), .createUrlTree(), etc.).
 * Reading state properties off it is NOT allowed — use the @ethlete/core signal
 * utilities instead.
 *
 * ❌ ActivatedRoute (fully replaced):
 *   inject(ActivatedRoute)
 *   import { ActivatedRoute } from '@angular/router';
 *
 * ❌ Router state property reads:
 *   this.router.url           → injectUrl()
 *   this.router.events        → injectRouterEvent()
 *   this.router.routerState   → injectRouterState()
 *   this.router.snapshot      → injectRouterState()
 *   this.router.lastSuccessfulNavigation  → injectRouterState()
 *   this.router.currentNavigation        → injectRouterState()
 *
 * ✅ inject(Router) is still fine for navigation:
 *   router.navigate(['/path'])
 *   router.navigateByUrl('/path')
 *   router.createUrlTree(['/path'])
 *
 * ✅ Use the @ethlete/core router utilities for state:
 *   injectUrl(), injectRoute(), injectRouterEvent(), injectRouterState(),
 *   injectIsRouterInitialized(), injectQueryParam(key), injectPathParam(key),
 *   injectQueryParams(), injectPathParams(), injectFragment(),
 *   injectRouteData(), injectRouteDataItem(key), injectRouteTitle(),
 *   injectQueryParamChanges(), injectPathParamChanges()
 */

const { MODULE_REFERENCE_SELECTOR, getModuleReference, isImportedAs } = require('./internals/import-resolution');

const ANGULAR_ROUTER = '@angular/router';

/**
 * Router properties that expose route state and must not be read directly.
 * @type {Map<string, string>}
 */
const ROUTER_STATE_PROPS = new Map([
  ['url', "injectUrl() from '@ethlete/core'"],
  ['events', "injectRouterEvent() from '@ethlete/core'"],
  ['routerState', "injectRouterState() from '@ethlete/core'"],
  ['snapshot', "injectRouterState() from '@ethlete/core'"],
  ['lastSuccessfulNavigation', "injectRouterState() from '@ethlete/core'"],
  ['currentNavigation', "injectRouterState() from '@ethlete/core'"],
]);

/** @type {import('eslint').Rule.RuleModule} */
const noAngularRouterApi = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        "Disallow injecting 'ActivatedRoute' (fully replaced) and reading state properties off an injected 'Router'.",
      recommended: true,
    },
    messages: {
      noActivatedRoute:
        "Do not inject 'ActivatedRoute'. Use reactive signal utilities from '@ethlete/core' instead: 'injectQueryParam(key)', 'injectPathParam(key)', 'injectQueryParams()', 'injectPathParams()', 'injectFragment()', 'injectRouteData()', 'injectRouteDataItem(key)', or 'injectRouteTitle()'. All return reactive signals and are SSR-safe.",
      noRouterStateProp:
        "Do not read 'router.{{prop}}' directly. Use {{replacement}} instead — it returns a reactive signal and is SSR-safe. Use inject(Router) only for navigation (.navigate(), .navigateByUrl()).",
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode;

    /**
     * @param {any} call
     * @param {string} token
     */
    const isInjectOf = (call, token) =>
      call?.type === 'CallExpression' &&
      isImportedAs(sourceCode, call.callee, 'inject') &&
      isImportedAs(sourceCode, call.arguments[0], token, ANGULAR_ROUTER);

    /**
     * Names of variables/properties assigned from inject(Router).
     * We track identifiers whose initializer is inject(Router) so we can
     * detect property access on them anywhere in the file.
     * @type {Set<string>}
     */
    const routerBindings = new Set();

    return {
      // ── Track inject(Router) bindings ──────────────────────────────────────
      // const router = inject(Router);
      VariableDeclarator(node) {
        if (isInjectOf(node.init, 'Router') && node.id.type === 'Identifier') {
          routerBindings.add(node.id.name);
        }
      },

      // ── Track class property assignments: router = inject(Router) ──────────
      PropertyDefinition(node) {
        if (isInjectOf(node.value, 'Router') && node.key.type === 'Identifier') {
          routerBindings.add(node.key.name);
        }
      },

      // ── Detect router.{stateProp} access ───────────────────────────────────
      MemberExpression(node) {
        if (node.property.type !== 'Identifier') return;
        const prop = node.property.name;
        if (!ROUTER_STATE_PROPS.has(prop)) return;

        // Check object is a known router binding (direct: router.url)
        // or a this.router.url / self.router.url pattern
        const obj = node.object;
        const isDirectBinding = obj.type === 'Identifier' && routerBindings.has(obj.name);
        const isThisBinding =
          obj.type === 'MemberExpression' &&
          obj.object.type === 'ThisExpression' &&
          obj.property.type === 'Identifier' &&
          routerBindings.has(obj.property.name);

        if (!isDirectBinding && !isThisBinding) return;

        context.report({
          node,
          messageId: 'noRouterStateProp',
          data: { prop, replacement: ROUTER_STATE_PROPS.get(prop) },
        });
      },

      // ── ActivatedRoute import ───────────────────────────────────────────────
      [MODULE_REFERENCE_SELECTOR](node) {
        const reference = getModuleReference(node);
        if (reference?.source !== ANGULAR_ROUTER) return;
        if (reference.named.some((entry) => entry.name === 'ActivatedRoute')) {
          context.report({ node, messageId: 'noActivatedRoute' });
        }
      },

      // ── inject(ActivatedRoute) ──────────────────────────────────────────────
      CallExpression(node) {
        if (isInjectOf(node, 'ActivatedRoute')) {
          context.report({ node, messageId: 'noActivatedRoute' });
        }
      },
    };
  },
};

module.exports = noAngularRouterApi;
