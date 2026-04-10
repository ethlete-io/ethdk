// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const rule = require('./no-inject-chain');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

tester.run('no-inject-chain', rule, {
  valid: [
    // Assign to const first, then use
    { code: `const svc = inject(Service); svc.doSomething();` },
    // Immediately invoked — intentional Angular idiom
    { code: `inject(DestroyRef).onDestroy(() => {});` },
    // Plain inject call without member access
    { code: `inject(MyService);` },
  ],
  invalid: [
    {
      code: `const ref = inject(Service).someRef;`,
      errors: [{ messageId: 'noChain' }],
    },
    {
      code: `inject(Service).property;`,
      errors: [{ messageId: 'noChain' }],
    },
    {
      code: `const x = inject(Foo).bar + 1;`,
      errors: [{ messageId: 'noChain' }],
    },
  ],
});
