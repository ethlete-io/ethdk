// @ts-check
'use strict';

/**
 * Disallow async/await — asynchronous work is modelled with RxJS.
 *
 * Every async API in the SDK returns a cold Observable, not a Promise, so a consumer can compose,
 * cancel and retry it. Bridge a browser Promise in with from(); never await it.
 *
 * BAD:
 *   async copy(text: string) {
 *     await navigator.clipboard.writeText(text);
 *     this.copied.set(true);
 *   }
 *
 * GOOD:
 *   copy(text: string) {
 *     return from(navigator.clipboard.writeText(text)).pipe(tap(() => this.copied.set(true)));
 *   }
 */

/** Storybook's play function is called by the test runner and has to be a promise. */
const isStorybookPlayFunction = (node) => {
  const { parent } = node;

  return (
    parent?.type === 'Property' &&
    parent.value === node &&
    parent.key.type === 'Identifier' &&
    parent.key.name === 'play'
  );
};

/** @type {import('eslint').Rule.RuleModule} */
const noAsyncAwait = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow async / await — model asynchronous work as RxJS Observables.',
      recommended: true,
    },
    messages: {
      noAsync:
        "Don't declare an 'async' function. Return a cold Observable instead — 'defer()' for laziness, 'from()' to bridge a Promise-based browser API.",
      noAwait:
        "Don't 'await'. Compose the value into the stream with 'switchMap' / 'mergeMap' / 'from()' instead, and read a one-shot result with 'firstValueFrom()' only in tests.",
      noForAwait: "Don't use 'for await…of'. Bridge the async iterable into a stream and compose it with RxJS.",
    },
    schema: [],
  },
  create(context) {
    const isExempt = (node) => {
      for (let current = node; current; current = current.parent) {
        if (isStorybookPlayFunction(current)) return true;
      }

      return false;
    };

    const reportAsync = (node) => {
      if (!node.async || isExempt(node)) return;

      context.report({ node, messageId: 'noAsync' });
    };

    return {
      FunctionDeclaration: reportAsync,
      FunctionExpression: reportAsync,
      ArrowFunctionExpression: reportAsync,
      AwaitExpression(node) {
        if (!isExempt(node)) context.report({ node, messageId: 'noAwait' });
      },
      ForOfStatement(node) {
        if (node.await && !isExempt(node)) context.report({ node, messageId: 'noForAwait' });
      },
    };
  },
};

module.exports = noAsyncAwait;
