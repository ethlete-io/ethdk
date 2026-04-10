// @ts-check
'use strict';

/**
 * Requires observable variables and class properties to be suffixed with `$`.
 *
 * Detection is heuristic — a binding is assumed to be an Observable if its
 * initializer matches one of:
 *   - a `.pipe(...)` call  (most reliable signal)
 *   - `new Subject / BehaviorSubject / ReplaySubject / AsyncSubject / Observable()`
 *   - a call to a known RxJS creator: from, of, interval, timer, fromEvent,
 *     fromEventPattern, combineLatest, merge, concat, forkJoin, race, zip,
 *     defer, iif, throwError, using, partition
 *
 * ❌ const myData = someObs.pipe(map(...));
 * ❌ const clicks = fromEvent(el, 'click');
 * ❌ class Foo { stream = this.src.pipe(filter(...)); }
 *
 * ✅ const myData$ = someObs.pipe(map(...));
 * ✅ const clicks$ = fromEvent(el, 'click');
 * ✅ class Foo { stream$ = this.src.pipe(filter(...)); }
 */

const RXJS_CREATORS = new Set([
  'from',
  'of',
  'interval',
  'timer',
  'fromEvent',
  'fromEventPattern',
  'combineLatest',
  'merge',
  'concat',
  'forkJoin',
  'race',
  'zip',
  'defer',
  'iif',
  'throwError',
  'using',
  'partition',
]);

const RXJS_SUBJECT_CTORS = new Set(['Subject', 'BehaviorSubject', 'ReplaySubject', 'AsyncSubject', 'Observable']);

/**
 * Returns true if the expression looks like an Observable.
 * @param {any} node
 */
const isObservableInit = (node) => {
  if (!node) return false;

  // someObs.pipe(...)
  if (
    node.type === 'CallExpression' &&
    node.callee.type === 'MemberExpression' &&
    node.callee.property.type === 'Identifier' &&
    node.callee.property.name === 'pipe'
  ) {
    return true;
  }

  // from(...), of(...), interval(...), etc.
  if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && RXJS_CREATORS.has(node.callee.name)) {
    return true;
  }

  // new Subject(), new BehaviorSubject(...), etc.
  if (node.type === 'NewExpression' && node.callee.type === 'Identifier' && RXJS_SUBJECT_CTORS.has(node.callee.name)) {
    return true;
  }

  return false;
};

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require observable variables and class properties to use the $ suffix.',
    },
    schema: [],
    messages: {
      missingSuffix: "Observable '{{ name }}' must end with '$' (e.g. '{{ name }}$').",
    },
  },
  create(context) {
    /**
     * @param {string} name
     * @param {any} reportNode
     * @param {any} initNode
     */
    const checkBinding = (name, reportNode, initNode) => {
      if (!isObservableInit(initNode)) return;
      if (name.endsWith('$')) return;

      context.report({
        node: reportNode,
        messageId: 'missingSuffix',
        data: { name },
      });
    };

    return {
      // const myObs = ...
      VariableDeclarator(node) {
        const n = /** @type {any} */ (node);
        if (n.id.type !== 'Identifier') return;
        checkBinding(n.id.name, n.id, n.init);
      },

      // class Foo { myObs = ... }
      PropertyDefinition(node) {
        const n = /** @type {any} */ (node);
        if (n.key.type !== 'Identifier') return;
        checkBinding(n.key.name, n.key, n.value);
      },
    };
  },
};

module.exports = rule;
