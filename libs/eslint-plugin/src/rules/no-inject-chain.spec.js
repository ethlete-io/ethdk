// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const tsParser = require('@typescript-eslint/parser');
const rule = require('./no-inject-chain');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module', parser: tsParser },
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
    { code: `const bar = new (inject(Foo).Bar)();` },
    // Plain inject call without member access
    { code: `inject(MyService);` },
    { code: `const a = inject(Foo)?.bar();` },
    { code: `const { a } = inject(Foo);` },
    { code: `const inject = (x) => x; const a = inject(Foo).bar;` },
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
    {
      code: `const a = inject(Foo)?.bar;`,
      errors: [{ messageId: 'noChain' }],
    },
    {
      code: `const a = inject(Foo).bar.baz();`,
      errors: [{ messageId: 'noChain' }],
    },
    {
      code: `const a = inject(Foo)['bar'];`,
      errors: [{ messageId: 'noChain', data: { token: 'Foo', member: '...' } }],
    },
    {
      code: `const a = inject(TOKEN, { optional: true }).value;`,
      errors: [{ messageId: 'noChain', data: { token: 'TOKEN', member: 'value' } }],
    },
  ],
});
