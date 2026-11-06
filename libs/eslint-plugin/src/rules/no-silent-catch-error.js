// @ts-check
'use strict';

/**
 * Disallow an RxJS catchError whose handler ignores the error and returns of(...), EMPTY or NEVER,
 * and, with the `tryCatch` option, a try/catch whose catch ignores the error and returns a fallback value.
 *
 * BAD:
 *   source$.pipe(catchError(() => of(null)));
 *   try { return read(); } catch { return []; }
 *
 * GOOD:
 *   source$.pipe(catchError((error) => { this.error.set(error); return of(null); }));
 *   try { return read(); } catch (error) { report(error); return []; }
 */

const SWALLOWING_CONSTANTS = new Set(['EMPTY', 'NEVER']);

const isSwallowingValue = (node) => {
  if (!node) return false;

  if (node.type === 'Identifier') return SWALLOWING_CONSTANTS.has(node.name);

  return node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'of';
};

const collectReturnedValues = (fn) => {
  if (fn.body.type !== 'BlockStatement') return [fn.body];

  return collectReturnsIn(fn.body);
};

const collectReturnsIn = (block) => {
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

  block.body.forEach(visit);

  return values;
};

/** @type {import('eslint').Rule.RuleModule} */
const noSilentCatchError = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow a catchError handler that ignores the error and swallows it with of(), EMPTY or NEVER, and with the `tryCatch` option a catch clause that ignores the error and returns a fallback.',
      recommended: false,
    },
    messages: {
      silentCatchError:
        'The error disappears silently. Use it (log it, store it in a signal, rethrow it) or disable this rule with a reason.',
    },
    schema: [
      {
        type: 'object',
        properties: { tryCatch: { type: 'boolean' } },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const sourceCode = context.sourceCode;
    const checkTryCatch = context.options[0]?.tryCatch === true;

    const ignoresError = (scopeNode, param) => {
      if (!param) return true;
      if (param.type !== 'Identifier') return false;

      const variable = sourceCode.getDeclaredVariables(scopeNode).find((v) => v.name === param.name);

      return !variable || variable.references.length === 0;
    };

    return {
      CatchClause(node) {
        if (!checkTryCatch) return;
        if (!ignoresError(node, node.param)) return;
        if (collectReturnsIn(node.body).length === 0) return;

        context.report({ node, messageId: 'silentCatchError' });
      },
      CallExpression(node) {
        if (node.callee.type !== 'Identifier' || node.callee.name !== 'catchError') return;

        const [handler] = node.arguments;

        if (!handler || (handler.type !== 'ArrowFunctionExpression' && handler.type !== 'FunctionExpression')) return;
        if (!ignoresError(handler, handler.params[0])) return;

        if (collectReturnedValues(handler).some(isSwallowingValue)) {
          context.report({ node: handler, messageId: 'silentCatchError' });
        }
      },
    };
  },
};

module.exports = noSilentCatchError;
