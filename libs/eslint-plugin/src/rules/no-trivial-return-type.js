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
 *
 * Self-referencing (recursive) functions are exempt: TypeScript cannot infer a
 * return type that depends on itself (TS7023 under noImplicitAny), so the
 * annotation is required there:
 *   const walk = (node): boolean => node.ok && walk(node.next)
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
     * The names under which a function implementation can call itself: its own name
     * (named function expression, or the variable an arrow is assigned to) and/or
     * `this.<key>` for class/object methods and class-field arrows.
     * @param {any} fn
     */
    const selfReferenceNames = (fn) => {
      /** @type {{ kind: 'name' | 'this', name: string }[]} */
      const names = [];

      if (fn.id && fn.id.type === 'Identifier') {
        names.push({ kind: 'name', name: fn.id.name });
      }

      const parent = fn.parent;

      if (parent) {
        if (
          (parent.type === 'MethodDefinition' || parent.type === 'PropertyDefinition' || parent.type === 'Property') &&
          !parent.computed &&
          parent.key &&
          parent.key.type === 'Identifier'
        ) {
          names.push({ kind: 'this', name: parent.key.name });
        }

        if (parent.type === 'VariableDeclarator' && parent.id && parent.id.type === 'Identifier') {
          names.push({ kind: 'name', name: parent.id.name });
        }
      }

      return names;
    };

    /**
     * Whether the function body references the function itself (recursion) — there the
     * annotation is required, since TypeScript cannot infer a self-dependent return type.
     * @param {any} fn
     */
    const isSelfReferencing = (fn) => {
      const names = selfReferenceNames(fn);

      if (!names.length || !fn.body) {
        return false;
      }

      const stack = [fn.body];

      while (stack.length) {
        const current = stack.pop();

        if (!current || typeof current !== 'object') continue;

        if (Array.isArray(current)) {
          stack.push(...current);
          continue;
        }

        if (typeof current.type !== 'string') continue;

        for (const { kind, name } of names) {
          if (kind === 'name' && current.type === 'Identifier' && current.name === name) {
            return true;
          }

          if (
            kind === 'this' &&
            current.type === 'MemberExpression' &&
            current.object.type === 'ThisExpression' &&
            !current.computed &&
            current.property.type === 'Identifier' &&
            current.property.name === name
          ) {
            return true;
          }
        }

        for (const key of Object.keys(current)) {
          if (key === 'parent') continue;
          const value = current[key];
          if (value && typeof value === 'object') stack.push(value);
        }
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
      if (isSelfReferencing(fn)) return;

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
