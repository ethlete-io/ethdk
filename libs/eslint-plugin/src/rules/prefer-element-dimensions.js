// @ts-check
'use strict';

const { ANGULAR_CORE, getImportedName } = require('./internals/import-resolution');

/**
 * Prefers signalElementDimensions / signalHostElementDimensions from @ethlete/core
 * over imperatively reading element size properties inside reactive contexts
 * (effect(), computed(), or signal initializers).
 *
 * Why: reading `.getBoundingClientRect()`, `.offsetWidth`, `.clientWidth`, etc.
 * inside a reactive context creates a one-shot snapshot that never updates. The
 * signal utilities set up a ResizeObserver-backed reactive signal that stays in
 * sync automatically and cleans itself up when the component is destroyed.
 *
 * NOTE: This rule is a WARNING (not an error) because imperative one-shot reads
 * (e.g. inside animation callbacks, event handlers) are perfectly valid. The rule
 * only fires when the read is inside a reactive context.
 *
 * BAD (reactive context):
 *   effect(() => {
 *     const w = this.el.nativeElement.offsetWidth;   // stale after resize ❌
 *   });
 *
 *   computed(() => someEl.getBoundingClientRect().width);  // ❌
 *
 * GOOD:
 *   dimensions = signalHostElementDimensions();  // from @ethlete/core
 *   // or
 *   dimensions = signalElementDimensions(inject(ElementRef));
 *   // Then:
 *   effect(() => { const w = this.dimensions().rect.width; }); // ✅ reactive
 */

/** Size-related properties read from DOM elements. */
const ELEMENT_SIZE_PROPS = new Set([
  'offsetWidth',
  'offsetHeight',
  'clientWidth',
  'clientHeight',
  'scrollWidth',
  'scrollHeight',
]);

/** Size-related methods called on DOM elements. */
const ELEMENT_SIZE_METHODS = new Set(['getBoundingClientRect', 'getClientRects']);

const SYNCHRONOUS_ARRAY_METHODS = new Set([
  'map',
  'flatMap',
  'filter',
  'forEach',
  'find',
  'findLast',
  'findIndex',
  'findLastIndex',
  'some',
  'every',
  'reduce',
  'reduceRight',
  'sort',
]);

/**
 * @param {import('eslint').SourceCode} sourceCode
 * @param {import('eslint').Rule.Node} node
 * @returns {string | null}
 */
const getReactiveContext = (sourceCode, node) => {
  /** @type {any} */
  let current = node.parent;

  while (current) {
    if (
      current.type === 'ArrowFunctionExpression' ||
      current.type === 'FunctionExpression' ||
      current.type === 'FunctionDeclaration'
    ) {
      const host = current.parent;
      if (host?.type !== 'CallExpression' || !host.arguments.includes(current)) return null;

      const calleeName = getImportedName(sourceCode, host.callee, ANGULAR_CORE);
      if (calleeName === 'effect' || calleeName === 'computed') return calleeName;

      const isSynchronousArrayCallback =
        host.callee.type === 'MemberExpression' &&
        host.callee.property.type === 'Identifier' &&
        SYNCHRONOUS_ARRAY_METHODS.has(host.callee.property.name);
      if (!isSynchronousArrayCallback) return null;
    }

    current = current.parent;
  }

  return null;
};

const DOM_QUERY_METHODS = new Set(['querySelector', 'getElementById', 'closest', 'elementFromPoint']);
const DOM_LIST_QUERY_METHODS = new Set([
  'querySelectorAll',
  'getElementsByClassName',
  'getElementsByTagName',
  'getElementsByName',
]);
const ELEMENT_NAVIGATION_PROPS = new Set([
  'parentElement',
  'offsetParent',
  'firstElementChild',
  'lastElementChild',
  'nextElementSibling',
  'previousElementSibling',
]);
const ELEMENT_INJECTORS = new Set(['injectHostElement', 'injectAngularRootElement', 'injectBoundaryElement']);
const ELEMENT_TYPE_NAME = /^(Element|HTMLElement|SVGElement|HTML\w*Element|SVG\w*Element)$/u;

/**
 * @param {any} typeAnnotation
 */
const isElementType = (typeAnnotation) => {
  const type = typeAnnotation?.type === 'TSTypeAnnotation' ? typeAnnotation.typeAnnotation : typeAnnotation;

  if (type?.type === 'TSUnionType') return type.types.some(isElementType);

  return (
    type?.type === 'TSTypeReference' &&
    type.typeName.type === 'Identifier' &&
    ELEMENT_TYPE_NAME.test(type.typeName.name)
  );
};

/**
 * @param {any} node
 */
const isDocumentReference = (node) =>
  (node.type === 'Identifier' && node.name === 'document') ||
  (node.type === 'MemberExpression' &&
    !node.computed &&
    node.property.type === 'Identifier' &&
    /^(document|doc)$/u.test(node.property.name));

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

const ELEMENT_COLLECTION_NAME = /(Children|Elements)$/u;

/**
 * @param {any} node
 * @returns {string | null}
 */
const getReferenceName = (node) => {
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'MemberExpression' && !node.computed && node.property.type === 'Identifier') {
    return node.property.name;
  }

  return null;
};

/**
 * @param {import('eslint').SourceCode} sourceCode
 * @param {any} node
 * @param {Set<any>} seen
 * @returns {boolean}
 */
const isElementCollection = (sourceCode, node, seen) => {
  if (!node || seen.has(node)) return false;
  seen.add(node);

  if (node.type === 'ChainExpression' || node.type === 'TSNonNullExpression') {
    return isElementCollection(sourceCode, node.expression, seen);
  }

  if (node.type === 'ArrayExpression') {
    return (
      node.elements.length > 0 &&
      node.elements.every(
        (/** @type {any} */ element) =>
          element?.type === 'SpreadElement' && isElementCollection(sourceCode, element.argument, seen),
      )
    );
  }

  if (node.type === 'CallExpression') {
    const name = getReferenceName(node.callee);
    if (name && DOM_LIST_QUERY_METHODS.has(name)) return true;
    if (name === 'from' && node.arguments[0]) return isElementCollection(sourceCode, node.arguments[0], seen);

    return !!name && ELEMENT_COLLECTION_NAME.test(name);
  }

  const name = getReferenceName(node);
  if (name === 'children') return true;
  if (name && ELEMENT_COLLECTION_NAME.test(name)) return true;
  if (node.type !== 'Identifier') return false;

  /** @type {import('eslint').Scope.Scope | null} */
  let scope = sourceCode.getScope(node);

  while (scope) {
    const variable = scope.set.get(node.name);

    if (variable) {
      const definition = /** @type {any} */ (variable.defs[0]);

      return definition?.type === 'Variable' && isElementCollection(sourceCode, definition.node.init, seen);
    }

    scope = scope.upper;
  }

  return false;
};

/**
 * @param {import('eslint').SourceCode} sourceCode
 * @param {any} node
 * @param {Set<any>} seen
 * @returns {boolean}
 */
const isElementExpression = (sourceCode, node, seen = new Set()) => {
  if (!node || seen.has(node)) return false;
  seen.add(node);

  switch (node.type) {
    case 'ChainExpression':
    case 'TSNonNullExpression':
      return isElementExpression(sourceCode, node.expression, seen);
    case 'TSAsExpression':
    case 'TSTypeAssertion':
      return isElementType(node.typeAnnotation) || isElementExpression(sourceCode, node.expression, seen);
    case 'CallExpression': {
      const { callee } = node;

      if (callee.type === 'Identifier') return ELEMENT_INJECTORS.has(callee.name);

      return (
        callee.type === 'MemberExpression' &&
        callee.property.type === 'Identifier' &&
        DOM_QUERY_METHODS.has(callee.property.name)
      );
    }
    case 'MemberExpression': {
      if (node.computed) {
        const list = node.object;

        return (
          list.type === 'CallExpression' &&
          list.callee.type === 'MemberExpression' &&
          list.callee.property.type === 'Identifier' &&
          DOM_LIST_QUERY_METHODS.has(list.callee.property.name)
        );
      }

      if (node.property.type !== 'Identifier') return false;

      const prop = node.property.name;
      if (prop === 'nativeElement' || ELEMENT_NAVIGATION_PROPS.has(prop)) return true;
      if (prop === 'documentElement' || prop === 'body') return isDocumentReference(node.object);
      if (node.object.type !== 'ThisExpression') return false;

      const classBody = getThisClassBody(node);
      const field = classBody?.body.find(
        (/** @type {any} */ member) =>
          member.type === 'PropertyDefinition' &&
          !member.computed &&
          member.key.type === 'Identifier' &&
          member.key.name === prop,
      );

      return !!field && (isElementType(field.typeAnnotation) || isElementExpression(sourceCode, field.value, seen));
    }
    case 'Identifier': {
      /** @type {import('eslint').Scope.Scope | null} */
      let scope = sourceCode.getScope(node);

      while (scope) {
        const variable = scope.set.get(node.name);

        if (variable) {
          const definition = /** @type {any} */ (variable.defs[0]);
          if (!definition) return false;
          if (isElementType(definition.name.typeAnnotation)) return true;

          if (definition.type === 'Parameter') {
            const host = definition.node.parent;
            const isArrayCallback =
              host?.type === 'CallExpression' &&
              host.arguments[0] === definition.node &&
              host.callee.type === 'MemberExpression' &&
              host.callee.property.type === 'Identifier' &&
              SYNCHRONOUS_ARRAY_METHODS.has(host.callee.property.name) &&
              definition.node.params[0] === definition.name;

            return isArrayCallback && isElementCollection(sourceCode, host.callee.object, seen);
          }

          if (definition.type !== 'Variable') return false;

          const loop = definition.parent?.parent;
          if (loop?.type === 'ForOfStatement' && loop.left === definition.parent) {
            return isElementCollection(sourceCode, loop.right, seen);
          }

          return isElementExpression(sourceCode, definition.node.init, seen);
        }

        scope = scope.upper;
      }

      return false;
    }
    default:
      return false;
  }
};

/** @type {import('eslint').Rule.RuleModule} */
const preferElementDimensions = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        "Prefer 'signalElementDimensions()' or 'signalHostElementDimensions()' from '@ethlete/core' over reading element size properties inside reactive contexts.",
      recommended: true,
    },
    messages: {
      preferElementDimensions:
        "Avoid reading '{{prop}}' inside {{context}}() — it creates a stale snapshot. Use 'signalElementDimensions(elementRef)' or 'signalHostElementDimensions()' from '@ethlete/core' instead — they provide a reactive signal backed by ResizeObserver.",
    },
    schema: [],
  },
  create(context) {
    return {
      MemberExpression(node) {
        if (node.property.type !== 'Identifier') return;
        if (!ELEMENT_SIZE_PROPS.has(node.property.name)) return;
        if (!isElementExpression(context.sourceCode, node.object)) return;

        const reactiveCtx = getReactiveContext(context.sourceCode, node);
        if (!reactiveCtx) return;

        context.report({
          node,
          messageId: 'preferElementDimensions',
          data: { prop: node.property.name, context: reactiveCtx },
        });
      },

      CallExpression(node) {
        const { callee } = node;
        if (callee.type !== 'MemberExpression') return;
        if (callee.property.type !== 'Identifier') return;
        if (!ELEMENT_SIZE_METHODS.has(callee.property.name)) return;
        if (!isElementExpression(context.sourceCode, callee.object)) return;

        const reactiveCtx = getReactiveContext(context.sourceCode, node);
        if (!reactiveCtx) return;

        context.report({
          node,
          messageId: 'preferElementDimensions',
          data: { prop: callee.property.name + '()', context: reactiveCtx },
        });
      },
    };
  },
};

module.exports = preferElementDimensions;
