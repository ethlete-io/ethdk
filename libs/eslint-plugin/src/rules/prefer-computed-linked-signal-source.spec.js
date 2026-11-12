// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const tsParser = require('@typescript-eslint/parser');
const rule = require('./prefer-computed-linked-signal-source');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module', parser: tsParser },
});

const header = `import { input, model, computed, linkedSignal, signal } from '@angular/core';`;

tester.run('prefer-computed-linked-signal-source', rule, {
  valid: [
    {
      code: `${header}
class A { foo = input(0); fooComputed = computed(() => this.foo()); value = linkedSignal(this.fooComputed); }`,
    },
    {
      code: `${header}
class A { foo = input(0); fooComputed = computed(() => this.foo()); value = linkedSignal({ source: this.fooComputed, computation: (v) => v }); }`,
    },
    {
      code: `${header}
class A { other = signal(0); value = linkedSignal(() => this.other()); }`,
    },
    {
      code: `import { linkedSignal } from 'other-lib';
class A { foo = input(0); value = linkedSignal(() => this.foo()); }`,
    },
    {
      code: `${header}
const value = linkedSignal(() => foo());`,
    },
  ],
  invalid: [
    {
      code: `${header}
class A { foo = input(0); value = linkedSignal(() => this.foo()); }`,
      errors: [{ messageId: 'inlineSource' }],
    },
    {
      code: `${header}
class A { foo = input.required<number>(); value = linkedSignal(() => this.foo() + 1); }`,
      errors: [{ messageId: 'inlineSource' }],
    },
    {
      code: `${header}
class A { foo = model(0); value = linkedSignal(function () { return this.foo(); }); }`,
      errors: [{ messageId: 'inlineSource' }],
    },
    {
      code: `${header}
class A { foo = input(0); value = linkedSignal({ source: () => this.foo(), computation: (v) => v }); }`,
      errors: [{ messageId: 'inlineSource' }],
    },
  ],
});
