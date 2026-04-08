// @ts-check
'use strict';

/**
 * Disallows trivially-inferable explicit return type annotations on function
 * implementations. TypeScript infers `void`, `boolean`, `string`, `number`,
 * `undefined`, and `null` without help; writing them out adds noise.
 *
 * BAD:  const go = (): void => { ... }
 * GOOD: const go = () => { ... }
 *
 * ALSO GOOD (non-trivial, keep it):
 *   const parse = (): Date => new Date(value)
 */

const TRIVIAL_TYPES = new Set([
  'TSVoidKeyword',
  'TSBooleanKeyword',
  'TSStringKeyword',
  'TSNumberKeyword',
  'TSUndefinedKeyword',
  'TSNullKeyword',
]);

const TRIVIAL_LABELS = {
  TSVoidKeyword: 'void',
  TSBooleanKeyword: 'boolean',
  TSStringKeyword: 'string',
  TSNumberKeyword: 'number',
  TSUndefinedKeyword: 'undefined',
  TSNullKeyword: 'null',
};

/** @type {import('eslint').Rule.RuleModule} */
const noTrivialReturnType = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description:
        'Disallow explicit return type annotations that TypeScript can infer (void, boolean, string, number, undefined, null).',
      recommended: true,
    },
    messages: {
      trivialReturnType: "Omit the explicit ': {{type}}' return type — TypeScript infers it.",
    },
    schema: [],
  },
  create(context) {
    /**
     * Walk up the AST to detect type-level contexts (type aliases, interface bodies,
     * abstract method signatures) where return type annotations are required / expected.
     * @param {import('eslint').Rule.Node} node
     */
    const isInsideTypeContext = (node) => {
      let current = node.parent;
      while (current) {
        const t = current.type;
        // Type-level signatures — not implementations
        if (t === 'TSTypeLiteral' || t === 'TSInterfaceBody' || t === 'TSTypeAliasDeclaration') {
          return true;
        }
        // Abstract method declarations (separate AST node via @typescript-eslint/parser)
        if (t === 'TSAbstractMethodDefinition' || t === 'TSMethodSignature') {
          return true;
        }
        current = current.parent;
      }
      return false;
    };

    /**
     * @param {import('eslint').Rule.Node} node
     */
    const checkReturnType = (node) => {
      // @typescript-eslint/parser adds `returnType` to function nodes at runtime
      // even though the base ESTree type doesn't declare it.
      const fn = /** @type {any} */ (node);
      if (!fn.returnType) return;
      if (isInsideTypeContext(node)) return;

      const annotation = fn.returnType.typeAnnotation;
      if (!TRIVIAL_TYPES.has(annotation.type)) return;

      const label = TRIVIAL_LABELS[annotation.type] ?? annotation.type;

      context.report({
        node: fn.returnType,
        messageId: 'trivialReturnType',
        data: { type: label },
        fix(fixer) {
          return fixer.remove(fn.returnType);
        },
      });
    };

    return {
      ArrowFunctionExpression: checkReturnType,
      FunctionExpression: checkReturnType,
    };
  },
};

module.exports = noTrivialReturnType;
