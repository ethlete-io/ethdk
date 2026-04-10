// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const rule = require('./no-trivial-wrapper-method');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

tester.run('no-trivial-wrapper-method', rule, {
  valid: [
    // Zero-param methods — intentional API surface, exempt
    { code: `class Foo { reset() { this.value.set(null); } }` },
    // Method that transforms its argument
    { code: `class Foo { setDouble(val) { this.value.set(val * 2); } }` },
    // Method with multiple statements — not trivial
    { code: `class Foo { doThing(a) { this.log(a); this.impl.doThing(a); } }` },
    // Constructor — exempt
    { code: `class Foo { constructor(service) { this.service = service; } }` },
    // Method with destructured param — not simple
    { code: `class Foo { setItem({ key, value }) { this.store.set(key, value); } }` },
  ],
  invalid: [
    {
      // Direct void delegation
      code: `class Foo { setValue(val) { this.value.set(val); } }`,
      errors: [{ messageId: 'noTrivialWrapperMethod' }],
    },
    {
      // Return delegation
      code: `class Foo { getItem(key) { return this.store.get(key); } }`,
      errors: [{ messageId: 'noTrivialWrapperMethod' }],
    },
    {
      // Multi-param forwarding
      code: `class Foo { move(x, y) { this.renderer.move(x, y); } }`,
      errors: [{ messageId: 'noTrivialWrapperMethod' }],
    },
  ],
});
