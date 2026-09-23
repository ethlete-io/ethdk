// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const rule = require('./no-inject-chain');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

tester.run('no-inject-chain', rule, {
  valid: [
    {
      code: `import { inject } from 'some-other-lib';
const t = inject(Foo).bar;`,
    },
    // Assign to const first, then use
    { code: `const svc = inject(Service); svc.doSomething();` },
    // Immediately invoked — intentional Angular idiom
    { code: `inject(DestroyRef).onDestroy(() => {});` },
    // Plain inject call without member access
    { code: `inject(MyService);` },
  ],
  invalid: [
    {
      code: `import { inject as ngInject } from '@angular/core';
const t = ngInject(Foo).bar;`,
      errors: [{ messageId: 'noChain' }],
    },
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
