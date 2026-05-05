// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const tsParser = require('@typescript-eslint/parser');
const rule = require('./no-public-property');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module', parser: tsParser },
});

tester.run('no-public-property', rule, {
  valid: [
    { code: `class Foo { private service = inject(MyService); }` },
    { code: `class Foo { public service = inject(MyService); }` },
    { code: `class Foo { value = 1; }` },
  ],
  invalid: [
    {
      code: `class Foo { public value = 1; }`,
      output: `class Foo { value = 1; }`,
      errors: [{ messageId: 'noPublicProperty' }],
    },
    {
      code: `class Foo { public readonly value = 1; }`,
      output: `class Foo { readonly value = 1; }`,
      errors: [{ messageId: 'noPublicProperty' }],
    },
  ],
});
