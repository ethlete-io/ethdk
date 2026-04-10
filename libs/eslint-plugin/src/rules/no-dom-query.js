// @ts-check
'use strict';

/**
 * Disallows direct DOM query methods. Use Angular's viewChild() / viewChildren() signals instead.
 *
 * Direct DOM query methods bypass Angular's component model, break SSR, and are not declarative.
 * Angular provides first-class query APIs that are reactive and work within the component lifecycle.
 *
 * BAD:
 *   host.querySelector('[data-id]')          → viewChild('[data-id]')
 *   host.querySelectorAll('.item')           → viewChildren('.item')
 *   document.getElementById('my-id')        → viewChild('#my-id')
 *   el.getElementsByClassName('foo')        → viewChildren('.foo')
 *   el.closest('.parent')                   → inject(ElementRef) + traverse via Angular DI
 *
 * GOOD:
 *   label = viewChild('labelRef');           // template: <span #labelRef>
 *   items = viewChildren(ItemDirective);     // template: <et-item *ngFor="..." />
 *   children = signalElementChildren(elementRef); // from @ethlete/core — reactive signal of child HTMLElements
 *
 * NOTE: In the rare case where a query is genuinely needed (e.g. third-party DOM),
 * suppress with a targeted eslint-disable comment and document why.
 */

/**
 * The banned DOM query method names and their Angular alternatives.
 * @type {Map<string, string>}
 */
const DOM_QUERY_METHODS = new Map([
  ['querySelector', 'viewChild() with a template reference variable, or signalElementChildren() from @ethlete/core'],
  [
    'querySelectorAll',
    'viewChildren() / contentChildren() with a directive token, or signalElementChildren() from @ethlete/core for raw HTMLElement children',
  ],
  ['getElementById', 'viewChild() with a template reference variable (use #id on the element)'],
  ['getElementsByClassName', 'viewChildren() with a directive token, or signalElementChildren() from @ethlete/core'],
  [
    'getElementsByTagName',
    'viewChildren() with a directive / component token, or signalElementChildren() from @ethlete/core',
  ],
  ['getElementsByName', 'viewChildren() with a template reference variable'],
  ['closest', 'inject(ParentDirective, { optional: true }) via Angular DI instead of DOM traversal'],
]);

/** @type {import('eslint').Rule.RuleModule} */
const noDomQuery = {
  meta: {
    type: 'suggestion',
    docs: {
      description: "Disallow direct DOM query methods. Use Angular's viewChild() / viewChildren() signals instead.",
      recommended: true,
    },
    messages: {
      noDomQuery:
        "Avoid '{{method}}()'. Use {{alternative}} instead. Direct DOM queries bypass Angular's component model and break SSR.",
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        const { callee } = node;
        if (callee.type !== 'MemberExpression') return;
        if (callee.property.type !== 'Identifier') return;

        const methodName = callee.property.name;
        const alternative = DOM_QUERY_METHODS.get(methodName);
        if (!alternative) return;

        context.report({
          node,
          messageId: 'noDomQuery',
          data: { method: methodName, alternative },
        });
      },
    };
  },
};

module.exports = noDomQuery;
