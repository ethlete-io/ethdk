// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const tsParser = require('@typescript-eslint/parser');
const rule = require('./no-trivial-wrapper-method');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module', parser: tsParser },
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
    // `focus`/`blur`/`reset` on an Angular class — Angular resolves them by name on the instance
    { code: `@Component({}) class Foo { focus(options) { this.dir.focus(options); } }` },
    { code: `@Directive() class Foo { blur(options) { this.dir.blur(options); } }` },
    { code: `@Component({}) class Foo { reset(value) { this.dir.reset(value); } }` },
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
    {
      // The contract exemption is Angular-only — a plain class gets no pass
      code: `class Foo { focus(options) { this.dir.focus(options); } }`,
      errors: [{ messageId: 'noTrivialWrapperMethod' }],
    },
    {
      // …and it covers only the contract names, not every method on a component
      code: `@Component({}) class Foo { scrollTo(target) { this.dir.scrollTo(target); } }`,
      errors: [{ messageId: 'noTrivialWrapperMethod' }],
    },
  ],
});
