// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const tsParser = require('@typescript-eslint/parser');
const rule = require('./no-readonly-signal');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module', parser: tsParser },
});

tester.run('no-readonly-signal', rule, {
  valid: [
    // No readonly on reactive APIs — fine
    { code: `class Foo { count = signal(0); }` },
    { code: `class Foo { items = computed(() => []); }` },
    { code: `class Foo { svc = inject(MyService); }` },
    { code: `class Foo { data = input(null); }` },
    // readonly on a true constant — fine
    { code: `class Foo { readonly MAX = 100; }` },
    { code: `class Foo { readonly ID = 'my-id'; }` },
  ],
  invalid: [
    {
      code: `class Foo { readonly count = signal(0); }`,
      output: `class Foo { count = signal(0); }`,
      errors: [{ messageId: 'noReadonlySignal' }],
    },
    {
      code: `class Foo { readonly items = computed(() => []); }`,
      output: `class Foo { items = computed(() => []); }`,
      errors: [{ messageId: 'noReadonlySignal' }],
    },
    {
      code: `class Foo { readonly svc = inject(MyService); }`,
      output: `class Foo { svc = inject(MyService); }`,
      errors: [{ messageId: 'noReadonlySignal' }],
    },
    {
      code: `class Foo { readonly value = input(0); }`,
      output: `class Foo { value = input(0); }`,
      errors: [{ messageId: 'noReadonlySignal' }],
    },
    {
      code: `class Foo { readonly myModel = model(null); }`,
      output: `class Foo { myModel = model(null); }`,
      errors: [{ messageId: 'noReadonlySignal' }],
    },
    {
      code: `class Foo { readonly data$ = toSignal(obs$); }`,
      output: `class Foo { data$ = toSignal(obs$); }`,
      errors: [{ messageId: 'noReadonlySignal' }],
    },
  ],
});
