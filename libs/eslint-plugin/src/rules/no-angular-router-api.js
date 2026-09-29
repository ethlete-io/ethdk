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

    /** @type {WeakMap<any, Set<string>>} */
    const classRouterMembers = new WeakMap();

    /**
     * @param {any} classBody
     */
    const getClassRouterMembers = (classBody) => {
      let members = classRouterMembers.get(classBody);

      if (!members) {
        members = new Set();

        for (const member of classBody.body) {
          if (member.type === 'PropertyDefinition' && member.key.type === 'Identifier' && !member.computed) {
            if (isInjectOf(member.value, 'Router')) members.add(member.key.name);
          }
        }

        classRouterMembers.set(classBody, members);
      }

      return members;
    };

    /**
     * @param {any} thisExpression
     */
    const getThisClassBody = (thisExpression) => {
      let current = thisExpression.parent;

      while (current) {
        if (current.type === 'ClassBody') return current;

        if (current.type === 'FunctionExpression' || current.type === 'FunctionDeclaration') {
          const parent = current.parent;
          const isMember = parent?.type === 'MethodDefinition' || parent?.type === 'PropertyDefinition';
          if (!isMember) return null;
        }

        current = current.parent;
      }

      return null;
    };

    /**
     * @param {any} identifier
     */
    const isRouterVariable = (identifier) => {
      /** @type {import('eslint').Scope.Scope | null} */
      let scope = sourceCode.getScope(identifier);

      while (scope) {
        const variable = scope.set.get(identifier.name);

        if (variable) {
          const definition = /** @type {any} */ (variable.defs[0]);

          return (
            definition?.type === 'Variable' &&
            definition.node.id.type === 'Identifier' &&
            isInjectOf(definition.node.init, 'Router')
          );
        }

        scope = scope.upper;
      }

      return false;
    };

    /**
     * @param {any} object
     */
    const isRouterReference = (object) => {
      if (object.type === 'Identifier') return isRouterVariable(object);

      if (
        object.type !== 'MemberExpression' ||
        object.computed ||
        object.object.type !== 'ThisExpression' ||
        object.property.type !== 'Identifier'
      ) {
        return false;
      }

      const classBody = getThisClassBody(object.object);

      return !!classBody && getClassRouterMembers(classBody).has(object.property.name);
    };

    return {
      MemberExpression(node) {
        if (node.property.type !== 'Identifier') return;
        const prop = node.property.name;
        if (!ROUTER_STATE_PROPS.has(prop)) return;
        if (!isRouterReference(node.object)) return;

        context.report({
          node,
          messageId: 'noRouterStateProp',
          data: { prop, replacement: ROUTER_STATE_PROPS.get(prop) },
        });
      },

      [MODULE_REFERENCE_SELECTOR](node) {
        const reference = getModuleReference(node);
        if (reference?.source !== ANGULAR_ROUTER) return;
        if (reference.named.some((entry) => entry.name === 'ActivatedRoute')) {
          context.report({ node, messageId: 'noActivatedRoute' });
        }
      },

      CallExpression(node) {
        if (isInjectOf(node, 'ActivatedRoute')) {
          context.report({ node, messageId: 'noActivatedRoute' });
        }
      },
    };
  },
};

module.exports = noAngularRouterApi;
