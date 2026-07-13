// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const tsParser = require('@typescript-eslint/parser');
const rule = require('./no-native-html-input-name');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module', parser: tsParser },
});

tester.run('no-native-html-input-name', rule, {
  valid: [
    // Non-global names are fine
    { code: `class C { label = input('x'); }` },
    { code: `class C { overlayId = input(''); }` },
    { code: `class C { isHidden = input(false); }` },

    // Element-specific attributes are intentionally allowed (mirroring pattern)
    { code: `class C { disabled = input(false); }` },
    { code: `class C { value = input(''); }` },
    { code: `class C { placeholder = input(''); }` },
    { code: `class C { size = input('md'); }` },
    { code: `class C { type = input('button'); }` },

    // Microdata / niche globals are excluded — they double as common domain terms
    { code: `class C { itemId = input.required<string>(); }` },
    { code: `class C { itemProp = input(''); }` },
    { code: `class C { part = input(''); }` },

    // A global-attribute name that is NOT an input/model is irrelevant
    { code: `class C { title = 'static'; }` },
    { code: `class C { title = someHelper(); }` },
    { code: `class C { role = output(); }` },

    // required inputs / models
    { code: `class C { label = input.required<string>(); }` },
    { code: `class C { selection = model<string>(''); }` },
  ],
  invalid: [
    {
      code: `class C { title = input('Widget'); }`,
      errors: [{ messageId: 'nativeName' }],
    },
    {
      code: `class C { id = input('et-1'); }`,
      errors: [{ messageId: 'nativeName' }],
    },
    {
      code: `class C { hidden = input(false); }`,
      errors: [{ messageId: 'nativeName' }],
    },
    {
      code: `class C { role = input<string | undefined>(undefined); }`,
      errors: [{ messageId: 'nativeName' }],
    },
    // required input
    {
      code: `class C { tabindex = input.required<number>(); }`,
      errors: [{ messageId: 'nativeName' }],
    },
    // model (two-way input) collides just the same
    {
      code: `class C { hidden = model(false); }`,
      errors: [{ messageId: 'nativeName' }],
    },
    // case-insensitive match against the attribute
    {
      code: `class C { tabIndex = input(0); }`,
      errors: [{ messageId: 'nativeName' }],
    },
  ],
});
