// @ts-check
'use strict';

const PURE_ANNOTATION = /^\s*[#@]__PURE__\s*$/;

/**
 * Angular's own app build already pure-annotates these at module scope
 * (`pure-toplevel-functions`'s `sideEffectFreeConstructors`), so requiring it in source is noise.
 */
const AUTO_ANNOTATED_CONSTRUCTORS = new Set(['InjectionToken']);

/** Nothing inside a function body runs on import, so it needs no annotation. */
const NOT_EVALUATED_ON_IMPORT = new Set(['ArrowFunctionExpression', 'FunctionExpression', 'ClassExpression']);

const isModuleScope = (declarator) => {
  const declaration = declarator.parent;
  const container = declaration?.parent;

  if (container?.type === 'Program') return true;

  return container?.type === 'ExportNamedDeclaration' && container.parent?.type === 'Program';
};

const hasPureAnnotation = (sourceCode, node) =>
  sourceCode.getCommentsBefore(node).some((comment) => comment.type === 'Block' && PURE_ANNOTATION.test(comment.value));

/** `f()`, `ns.f()` and `new X()` are nameable; an IIFE is not, and is left alone. */
const calleeName = (node) => {
  const callee = node.callee;

  if (callee.type === 'Identifier') return callee.name;
  if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier') return callee.property.name;

  return null;
};

const TRANSPARENT_WRAPPERS = new Set([
  'TSAsExpression',
  'TSSatisfiesExpression',
  'TSNonNullExpression',
  'TSTypeAssertion',
]);

const unwrap = (node) => (TRANSPARENT_WRAPPERS.has(node.type) ? unwrap(node.expression) : node);

const isConstantExpression = (node) =>
  node.type === 'Literal' ||
  (node.type === 'UnaryExpression' && isConstantExpression(node.argument)) ||
  (node.type === 'BinaryExpression' && isConstantExpression(node.left) && isConstantExpression(node.right));

/** Everything in an initializer that really is evaluated when the module is imported and that a bundler cannot drop. */
const collectImportTimeNodes = (root) => {
  const calls = [];
  const reads = [];

  const visit = (node) => {
    if (!node || typeof node.type !== 'string' || NOT_EVALUATED_ON_IMPORT.has(node.type)) return;

    if (node.type === 'CallExpression' || node.type === 'NewExpression') calls.push(node);
    else if (node.type === 'SpreadElement') reads.push(node);
    else if (node.type === 'BinaryExpression' && !isConstantExpression(node)) reads.push(node);
    else if (
      node.type === 'MemberExpression' &&
      !(node.parent.type === 'CallExpression' && node.parent.callee === node)
    )
      reads.push(node);

    for (const key of Object.keys(node)) {
      if (key === 'parent') continue;

      const child = node[key];

      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child === 'object') visit(child);
    }
  };

  visit(root);

  return { calls, reads };
};

/** @type {import('eslint').Rule.RuleModule} */
const noImpureTopLevelProvider = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow module-scope destructuring of a factory call, and require a pure annotation on module-scope calls in library source.',
      recommended: true,
    },
    fixable: 'code',
    schema: [
      {
        type: 'object',
        properties: {
          requirePureAnnotation: {
            type: 'boolean',
            description:
              'Also require `@__PURE__` on every call evaluated at module scope. Turn this on in publishable library source; it is pointless in application code, where every statement is retained anyway.',
          },
          forbidImpureReads: {
            type: 'boolean',
            description:
              'Also forbid member reads, spreads and arithmetic on identifiers in module-scope initializers, which bundlers cannot prove side-effect free.',
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      noDestructuring:
        'Do not destructure a factory call at module scope. Destructuring invokes the iterator protocol, so no bundler can drop the statement — everything the factory closes over ships to every consumer. Assign the result to one `const` and name each binding with its own annotated extractor (`toProvideFn` / `toInjectFn` / `toToken`).',
      impureRead:
        'This module-scope member read, spread or arithmetic on an identifier cannot be proven side-effect free, so the whole declaration is retained in every consumer bundle. Write the literal key or number instead, or move the expression inside a function.',
      missingPure:
        'This module-scope call to `{{name}}` needs a `/* @__PURE__ */` annotation, or the whole declaration is retained in every consumer bundle — one unannotated call anywhere in an initializer (including inside an argument or an object literal) is enough. If the call is genuinely not side-effect free at import time, move it inside a function instead of annotating it: library code must not do work on import.',
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;
    const requirePureAnnotation = context.options[0]?.requirePureAnnotation === true;
    const forbidImpureReads = context.options[0]?.forbidImpureReads === true;

    return {
      VariableDeclarator(node) {
        if (!isModuleScope(node) || !node.init) return;

        const initializer = unwrap(node.init);

        if (
          initializer.type === 'CallExpression' &&
          (node.id.type === 'ArrayPattern' || node.id.type === 'ObjectPattern')
        ) {
          context.report({ node, messageId: 'noDestructuring' });

          return;
        }

        if (!requirePureAnnotation || node.id.type !== 'Identifier') return;

        const { calls, reads } = collectImportTimeNodes(initializer);

        if (forbidImpureReads) for (const read of reads) context.report({ node: read, messageId: 'impureRead' });

        for (const call of calls) {
          const name = calleeName(call);

          if (name === null || hasPureAnnotation(sourceCode, call)) continue;
          if (call.type === 'NewExpression' && AUTO_ANNOTATED_CONSTRUCTORS.has(name)) continue;

          context.report({
            node: call,
            messageId: 'missingPure',
            data: { name },
            fix: (fixer) => fixer.insertTextBefore(call, '/* @__PURE__ */ '),
          });
        }
      },
    };
  },
};

module.exports = noImpureTopLevelProvider;
