// @ts-check
'use strict';

const { ANGULAR_CORE, getImportedName } = require('./internals/import-resolution');
const { getReactiveIo } = require('./internals/angular-io');

/**
 * Asks for a `computed` as the source of a `linkedSignal` when the source is an inline function over a
 * signal input. A named computed is memoized and shared; the inline function re-creates that logic
 * inside the linked signal.
 *
 * BAD:
 *   value = linkedSignal(() => this.initial());
 *
 * GOOD:
 *   private readonly initialValue = computed(() => this.initial());
 *   value = linkedSignal(this.initialValue);
 */

/**
 * @param {any} node
 * @returns {boolean}
 */
const isInlineFunction = (node) =>
  !!node && (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression');

/**
 * @param {any} root
 * @param {Set<string>} names
 * @returns {boolean}
 */
const readsThisMember = (root, names) => {
  /** @param {any} node */
  const visit = (node) => {
    if (!node || typeof node.type !== 'string') {
      return false;
    }

    if (
      node.type === 'MemberExpression' &&
      node.object.type === 'ThisExpression' &&
      !node.computed &&
      node.property.type === 'Identifier' &&
      names.has(node.property.name)
    ) {
      return true;
    }

    return Object.keys(node).some((key) => {
      if (key === 'parent') {
        return false;
      }

      const value = node[key];

      return Array.isArray(value) ? value.some(visit) : !!value && typeof value.type === 'string' && visit(value);
    });
  };

  return visit(root);
};

/** @type {import('eslint').Rule.RuleModule} */
const preferComputedLinkedSignalSource = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Require a computed() as the source of a linkedSignal() instead of an inline function over an input.',
      recommended: true,
    },
    messages: {
      inlineSource:
        'Move this inline linkedSignal source into a computed() and pass that computed as the source instead.',
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode;

    /** @type {WeakMap<any, Set<string>>} */
    const inputCache = new WeakMap();

    /**
     * @param {any} classBody
     * @returns {Set<string>}
     */
    const inputsOf = (classBody) => {
      let names = inputCache.get(classBody);

      if (!names) {
        names = new Set();

        for (const member of classBody.body) {
          const io = getReactiveIo(sourceCode, member);

          if (io && io.kind !== 'output') {
            names.add(member.key.name);
          }
        }

        inputCache.set(classBody, names);
      }

      return names;
    };

    return {
      CallExpression(node) {
        if (getImportedName(sourceCode, node.callee, ANGULAR_CORE) !== 'linkedSignal') {
          return;
        }

        const first = /** @type {any} */ (node.arguments[0]);
        let source = first;

        if (first?.type === 'ObjectExpression') {
          const property = first.properties.find(
            (/** @type {any} */ p) =>
              p.type === 'Property' && !p.computed && p.key.type === 'Identifier' && p.key.name === 'source',
          );

          source = property?.value;
        }

        if (!isInlineFunction(source)) {
          return;
        }

        /** @type {any} */
        let current = node.parent;

        while (current && current.type !== 'ClassBody') {
          current = current.parent;
        }

        if (!current || !readsThisMember(source, inputsOf(current))) {
          return;
        }

        context.report({ node: source, messageId: 'inlineSource' });
      },
    };
  },
};

module.exports = preferComputedLinkedSignalSource;
