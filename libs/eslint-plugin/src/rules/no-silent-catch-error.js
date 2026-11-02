// @ts-check
'use strict';

/**
 * Disallow an RxJS catchError whose handler ignores the error and returns of(...), EMPTY or NEVER.
 *
 * BAD:
 *   source$.pipe(catchError(() => of(null)));
 *
 * GOOD:
 *   source$.pipe(catchError((error) => { this.error.set(error); return of(null); }));
 */

const SWALLOWING_CONSTANTS = new Set(['EMPTY', 'NEVER']);

const isSwallowingValue = (node) => {
  if (!node) return false;

  if (node.type === 'Identifier') return SWALLOWING_CONSTANTS.has(node.name);

  return node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'of';
};

const collectReturnedValues = (fn) => {
  if (fn.body.type !== 'BlockStatement') return [fn.body];

  const values = [];

  const visit = (node) => {
    if (!node || typeof node.type !== 'string') return;

    if (
      node.type === 'FunctionDeclaration' ||
      node.type === 'FunctionExpression' ||
      node.type === 'ArrowFunctionExpression'
    ) {
      return;
    }

    if (node.type === 'ReturnStatement') {
      values.push(node.argument);
      return;
    }

    for (const key of Object.keys(node)) {
      if (key === 'parent') continue;

      const child = node[key];

      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child.type === 'string') visit(child);
    }
  };

  fn.body.body.forEach(visit);

  return values;
};

/** @type {import('eslint').Rule.RuleModule} */
const noSilentCatchError = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow a catchError handler that ignores the error and swallows it with of(), EMPTY or NEVER.',
      recommended: false,
    },
    messages: {
      silentCatchError:
        'The error disappears silently. Use it (log it, store it in a signal, rethrow it) or disable this rule with a reason.',
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode;

    const ignoresError = (fn) => {
      const [param] = fn.params;

      if (!param) return true;
      if (param.type !== 'Identifier') return false;

      const variable = sourceCode.getDeclaredVariables(fn).find((v) => v.name === param.name);

      return !variable || variable.references.length === 0;
    };

    return {
      CallExpression(node) {
        if (node.callee.type !== 'Identifier' || node.callee.name !== 'catchError') return;

        const [handler] = node.arguments;

        if (!handler || (handler.type !== 'ArrowFunctionExpression' && handler.type !== 'FunctionExpression')) return;
        if (!ignoresError(handler)) return;

        if (collectReturnedValues(handler).some(isSwallowingValue)) {
          context.report({ node: handler, messageId: 'silentCatchError' });
        }
      },
    };
  },
};

module.exports = noSilentCatchError;
