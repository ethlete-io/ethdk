// @ts-check
'use strict';

/**
 * Disallows `readonly` on class properties initialized with reactive Angular/RxJS APIs.
 *
 * The `readonly` modifier on a signal, input, computed, or inject() call is misleading —
 * the "readonly" constraint applies to the reference (you can't reassign the property),
 * but the underlying value is mutable. It also prevents common patterns like
 * resetting or swapping the signal.
 *
 * BAD:
 *   readonly mySignal = signal(false);
 *   readonly myInput = input(false);
 *   readonly myComputed = computed(() => this.x() + 1);
 *   readonly myService = inject(MyService);
 *
 * GOOD (constants that truly never change):
 *   readonly MAX_ITEMS = 100;
 *   readonly PLATFORM = inject(PLATFORM_ID);   // ← still a violation; assign without readonly
 *
 * GOOD (actual usage):
 *   mySignal = signal(false);
 *   myInput = input(false);
 *   myComputed = computed(() => this.x() + 1);
 *   private myService = inject(MyService);
 */

/**
 * Names of Angular/RxJS reactive APIs that should never be marked `readonly`.
 */
const REACTIVE_APIS = new Set([
  // Angular signals
  'signal',
  'computed',
  'linkedSignal',
  // Angular models / inputs / outputs
  'input',
  'model',
  'output',
  'outputFromObservable',
  // Angular view queries
  'viewChild',
  'viewChildren',
  'contentChild',
  'contentChildren',
  // Angular DI
  'inject',
  // Angular lifecycle
  'effect',
  'afterNextRender',
  'afterRender',
  'afterRenderEffect',
  'resource',
  'rxResource',
  'httpResource',
  // RxJS interop
  'toSignal',
  'toObservable',
]);

/** @type {import('eslint').Rule.RuleModule} */
const noReadonlySignal = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description: 'Disallow `readonly` on class properties initialized with reactive Angular/RxJS APIs.',
      recommended: true,
    },
    messages: {
      noReadonlySignal:
        "Remove `readonly` from '{{name}}' — reactive APIs return mutable references, and `readonly` gives a false sense of immutability.",
    },
    schema: [],
  },
  create(context) {
    return {
      PropertyDefinition(node) {
        // Only flag when readonly is set
        if (!node.readonly) return;

        const init = node.value;
        if (!init || init.type !== 'CallExpression') return;

        const { callee } = init;
        let apiName = null;

        // Simple call: signal(), input(), computed(), inject(), etc.
        if (callee.type === 'Identifier' && (REACTIVE_APIS.has(callee.name) || callee.name.startsWith('inject'))) {
          apiName = callee.name;
        }
        // Member call: input.required(), outputFromObservable.something(), etc.
        else if (
          callee.type === 'MemberExpression' &&
          callee.object.type === 'Identifier' &&
          REACTIVE_APIS.has(callee.object.name)
        ) {
          apiName = `${callee.object.name}.${callee.property.type === 'Identifier' ? callee.property.name : '...'}`;
        }

        if (apiName) {
          context.report({
            node,
            messageId: 'noReadonlySignal',
            data: { name: apiName },
            fix(fixer) {
              const sourceCode = context.sourceCode;
              const tokens = sourceCode.getTokens(node);
              const decoratorEnd = node.decorators?.at(-1)?.range[1] ?? node.range[0];
              const readonlyToken = tokens.find(
                (token) =>
                  token.value === 'readonly' && token.range[0] >= decoratorEnd && token.range[1] <= node.key.range[0],
              );
              if (!readonlyToken) return null;
              const nextToken = sourceCode.getTokenAfter(readonlyToken);
              const rangeEnd = nextToken ? nextToken.range[0] : readonlyToken.range[1];
              return fixer.removeRange([readonlyToken.range[0], rangeEnd]);
            },
          });
        }
      },
    };
  },
};

module.exports = noReadonlySignal;
