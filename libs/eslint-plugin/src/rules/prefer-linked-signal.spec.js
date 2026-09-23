// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const rule = require('./prefer-linked-signal');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

tester.run('prefer-linked-signal', rule, {
  valid: [
    {
      code: `import { effect } from 'some-other-lib';
effect(() => { a.set(b()); });`,
    },
    // .set() in an event handler or method — fine
    { code: `class Foo { onClick() { this.selected.set(null); } }` },
    // .set() inside effect with multiple statements — not a pure derivation, exempt
    { code: `effect(() => { this.log('change'); this.selected.set(this.items()[0]); });` },
    // .set() inside untracked callback WITHIN effect — exempted (not the direct callback)
    { code: `effect(() => { untracked(() => { this.selected.set(null); }); });` },
    // linkedSignal already used — fine
    { code: `selectedItem = linkedSignal(() => this.items()[0] ?? null);` },
    // effect without set
    { code: `effect(() => { console.log(this.count()); });` },
  ],
  invalid: [
    {
      code: `import { effect as ngEffect } from '@angular/core';
ngEffect(() => { a.set(b()); });`,
      errors: [{ messageId: 'preferLinkedSignal' }],
    },
    {
      // Arrow with expression body — sole statement
      code: `effect(() => this.selectedItem.set(this.items()[0] ?? null));`,
      errors: [{ messageId: 'preferLinkedSignal' }],
    },
    {
      // Block body with single set statement
      code: `effect(() => { this.selectedItem.set(this.items()[0] ?? null); });`,
      errors: [{ messageId: 'preferLinkedSignal' }],
    },
  ],
});
