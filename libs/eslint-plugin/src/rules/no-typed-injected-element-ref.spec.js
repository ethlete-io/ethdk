// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const tsParser = require('@typescript-eslint/parser');
const rule = require('./no-typed-injected-element-ref');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module', parser: tsParser },
});

tester.run('no-typed-injected-element-ref', rule, {
  valid: [
    // Correct: generic on inject(), plain ElementRef token
    { code: `inject<ElementRef<HTMLElement>>(ElementRef);` },
    { code: `inject<ElementRef<HTMLButtonElement>>(ElementRef);` },
    { code: `inject<ElementRef<HTMLInputElement>>(ElementRef);` },
    // Other tokens should not be flagged
    { code: `inject(SomeService);` },
    { code: `inject(DestroyRef);` },
    { code: `inject<SomeService>(SomeService);` },
  ],
  invalid: [
    // No generic at all — fix: add default <ElementRef<HTMLElement>>
    {
      code: `inject(ElementRef);`,
      output: `inject<ElementRef<HTMLElement>>(ElementRef);`,
      errors: [{ messageId: 'missingGeneric' }],
    },
    // Extra args preserved when adding the generic
    {
      code: `inject(ElementRef, { optional: true });`,
      output: `inject<ElementRef<HTMLElement>>(ElementRef, { optional: true });`,
      errors: [{ messageId: 'missingGeneric' }],
    },
    // Generic on the token itself — fix: move type arg to inject(), replace token with plain identifier
    {
      code: `inject(ElementRef<HTMLElement>);`,
      output: `inject<ElementRef<HTMLElement>>(ElementRef);`,
      errors: [{ messageId: 'missingGeneric' }],
    },
    {
      code: `inject(ElementRef<HTMLButtonElement>);`,
      output: `inject<ElementRef<HTMLButtonElement>>(ElementRef);`,
      errors: [{ messageId: 'missingGeneric' }],
    },
    // Generic on both inject() and the token — fix: strip type arg from token, keep inject's type param
    {
      code: `inject<ElementRef<HTMLElement>>(ElementRef<HTMLElement>);`,
      output: `inject<ElementRef<HTMLElement>>(ElementRef);`,
      errors: [{ messageId: 'missingGeneric' }],
    },
  ],
});
