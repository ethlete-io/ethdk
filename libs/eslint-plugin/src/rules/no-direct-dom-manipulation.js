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
 *   Object.assign(element.style, { … })     → renderer.setStyle(element, prop, value) per property
 *
 * GOOD:
 *   private renderer = injectRenderer(); // from @ethlete/core
 *
 * NOTE: Calls where the receiver name ends in 'renderer' (e.g. this.renderer.createElement)
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
 * @param {any} node
 * @returns {string | null}
 */
const getMemberName = (node) => {
  if (node.type !== 'MemberExpression') return null;
  if (!node.computed && node.property.type === 'Identifier') return node.property.name;
  if (node.computed && node.property.type === 'Literal' && typeof node.property.value === 'string') {
    return node.property.value;
  }

  return null;
};

/**
 * @param {any} node
 * @returns {string | null}
 */
const getTerminalName = (node) => {
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'MemberExpression') return getMemberName(node);
  if (node.type === 'CallExpression') return getTerminalName(node.callee);
  if (node.type === 'ChainExpression' || node.type === 'TSNonNullExpression') return getTerminalName(node.expression);

  return null;
};

/**
 * Returns true when the receiver of a MemberExpression looks like a Renderer2 instance,
 * which means the call is already using the correct API.
 * @param {any} objectNode
 */
const isRendererReceiver = (objectNode) => /renderer2?$/i.test(getTerminalName(objectNode) ?? '');

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

        const [target] = node.arguments;

        if (
          callee.object.type === 'Identifier' &&
          callee.object.name === 'Object' &&
          getMemberName(callee) === 'assign' &&
          target &&
          getMemberName(target) === 'style' &&
          !isRendererReceiver(target.object)
        ) {
          context.report({ node, messageId: 'domStyle' });
          return;
        }

        const methodName = getMemberName(callee);
        if (!methodName) return;

        if (methodName === 'setProperty' && getMemberName(callee.object) === 'style') {
          context.report({
            node,
            messageId: 'domMutation',
            data: {
              method: methodName,
              alternative: 'renderer.setStyle(el, prop, value, RendererStyleFlags2.DashCase)',
            },
          });
          return;
        }

        if (getMemberName(callee.object) === 'classList') {
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

        if (isRendererReceiver(callee.object)) return;

        if (DOM_CREATE_METHODS.has(methodName)) {
          context.report({
            node,
            messageId: 'domCreate',
            data: { method: methodName, alternative: DOM_CREATE_METHODS.get(methodName) },
          });
          return;
        }

        if (DOM_MUTATION_METHODS.has(methodName)) {
          context.report({
            node,
            messageId: 'domMutation',
            data: { method: methodName, alternative: DOM_MUTATION_METHODS.get(methodName) },
          });
        }
      },

      AssignmentExpression(node) {
        const { left } = node;
        if (
          left.type === 'MemberExpression' &&
          getMemberName(left.object) === 'style' &&
          !isRendererReceiver(left.object.object)
        ) {
          context.report({ node, messageId: 'domStyle' });
        }
      },
    };
  },
};

module.exports = noDirectDomManipulation;
