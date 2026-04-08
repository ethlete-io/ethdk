// @ts-check
'use strict';

/**
 * Disallows direct DOM manipulation methods. Use injectRenderer() from @ethlete/core instead.
 *
 * injectRenderer() is a fully-typed wrapper around Angular's Renderer2 that:
 * - Works with server-side rendering (Angular Universal / SSR)
 * - Works inside Web Workers
 * - Is mockable in unit tests
 * - Respects Angular's change detection lifecycle
 *
 * BAD:
 *   this.document.createElement('div')      → renderer.createElement('div')
 *   element.appendChild(child)              → renderer.appendChild(element, child)
 *   element.setAttribute('disabled', '')    → renderer.setAttribute(element, 'disabled', '')
 *   element.classList.add('active')         → renderer.addClass(element, 'active')
 *   element.classList.remove('active')      → renderer.removeClass(element, 'active')
 *   element.style.color = 'red'             → renderer.setStyle(element, 'color', 'red')
 *
 * GOOD:
 *   private renderer = injectRenderer(); // from @ethlete/core
 *
 * NOTE: Calls where the receiver name contains 'renderer' (e.g. this.renderer.createElement)
 * are excluded — that is the correct injectRenderer() usage.
 */

/**
 * DOM creation methods and their Renderer2 equivalents.
 * @type {Map<string, string>}
 */
const DOM_CREATE_METHODS = new Map([
  ['createElement', 'renderer.createElement(tag, namespace?)'],
  ['createTextNode', 'renderer.createText(value)'],
  ['createComment', 'renderer.createComment(value)'],
  ['createDocumentFragment', "renderer.createElement('div') and compose child nodes"],
]);

/**
 * DOM mutation methods and their Renderer2 equivalents.
 * @type {Map<string, string>}
 */
const DOM_MUTATION_METHODS = new Map([
  ['appendChild', 'renderer.appendChild(parent, child)'],
  ['removeChild', 'renderer.removeChild(parent, child)'],
  ['insertBefore', 'renderer.insertBefore(parent, child, refNode)'],
  ['replaceChild', 'renderer.insertBefore(parent, newChild, refNode) + renderer.removeChild(parent, oldChild)'],
  ['setAttribute', 'renderer.setAttribute(el, name, value)'],
  ['removeAttribute', 'renderer.removeAttribute(el, name)'],
  ['toggleAttribute', 'renderer.setAttribute / renderer.removeAttribute with a condition'],
  ['setProperty', 'renderer.setProperty(el, name, value)'],
]);

/**
 * classList methods and their Renderer2 equivalents.
 * @type {Map<string, string>}
 */
const CLASSLIST_METHODS = new Map([
  ['add', 'renderer.addClass(el, className)'],
  ['remove', 'renderer.removeClass(el, className)'],
  ['toggle', 'renderer.addClass / renderer.removeClass with a condition'],
  ['replace', 'renderer.removeClass(el, old) + renderer.addClass(el, new)'],
]);

/**
 * Returns true when the receiver of a MemberExpression looks like a Renderer2 instance,
 * which means the call is already using the correct API.
 * @param {import('eslint').Rule.Node} objectNode
 * @param {import('eslint').Rule.RuleContext} context
 */
const isRendererReceiver = (objectNode, context) => {
  const receiverText = context.sourceCode.getText(objectNode).toLowerCase();
  return receiverText.includes('renderer');
};

/** @type {import('eslint').Rule.RuleModule} */
const noDirectDomManipulation = {
  meta: {
    type: 'suggestion',
    docs: {
      description: "Disallow direct DOM manipulation. Use injectRenderer() from '@ethlete/core' instead.",
      recommended: true,
    },
    messages: {
      domCreate: "Use '{{alternative}}' instead of '.{{method}}()'. Use injectRenderer() from '@ethlete/core'.",
      domMutation: "Use '{{alternative}}' instead of '.{{method}}()'. Use injectRenderer() from '@ethlete/core'.",
      domClassList:
        "Use '{{alternative}}' instead of '.classList.{{method}}()'. Use injectRenderer() from '@ethlete/core'.",
      domStyle:
        "Use 'renderer.setStyle(el, prop, value)' instead of direct style property assignment. Use injectRenderer() from '@ethlete/core'.",
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

        // ── classList.add / .remove / .toggle / .replace ─────────────────────
        if (
          callee.object.type === 'MemberExpression' &&
          callee.object.property.type === 'Identifier' &&
          callee.object.property.name === 'classList'
        ) {
          const alternative = CLASSLIST_METHODS.get(methodName);
          if (alternative) {
            context.report({
              node,
              messageId: 'domClassList',
              data: { method: methodName, alternative },
            });
          }
          return;
        }

        // Skip calls on a Renderer2 instance — those are the correct pattern.
        if (isRendererReceiver(callee.object, context)) return;

        // ── DOM creation ──────────────────────────────────────────────────────
        if (DOM_CREATE_METHODS.has(methodName)) {
          context.report({
            node,
            messageId: 'domCreate',
            data: { method: methodName, alternative: DOM_CREATE_METHODS.get(methodName) },
          });
          return;
        }

        // ── DOM mutation ──────────────────────────────────────────────────────
        if (DOM_MUTATION_METHODS.has(methodName)) {
          context.report({
            node,
            messageId: 'domMutation',
            data: { method: methodName, alternative: DOM_MUTATION_METHODS.get(methodName) },
          });
        }
      },

      // ── el.style.prop = value ─────────────────────────────────────────────
      AssignmentExpression(node) {
        const { left } = node;
        if (
          left.type === 'MemberExpression' &&
          left.object.type === 'MemberExpression' &&
          left.object.property.type === 'Identifier' &&
          left.object.property.name === 'style' &&
          !isRendererReceiver(left.object.object, context)
        ) {
          context.report({ node, messageId: 'domStyle' });
        }
      },
    };
  },
};

module.exports = noDirectDomManipulation;
