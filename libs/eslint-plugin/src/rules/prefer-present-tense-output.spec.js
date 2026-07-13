// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const tsParser = require('@typescript-eslint/parser');
const rule = require('./prefer-present-tense-output');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module', parser: tsParser },
});

tester.run('prefer-present-tense-output', rule, {
  valid: [
    // Present-tense event names
    { code: `class C { playerSelect = output<Player>(); }` },
    { code: `class C { change = output<void>(); }` },
    { code: `class C { dragStart = output<void>(); }` },
    { code: `class C { fileUpload = output<File>(); }` },

    // Base-form words that merely end in "ed"
    { code: `class C { uploadSucceed = output<void>(); }` },
    { code: `class C { speed = output<number>(); }` },
    { code: `class C { feed = output<void>(); }` },

    // Not an output — inputs/models/methods are out of scope
    { code: `class C { selected = input(false); }` },
    { code: `class C { checked = model(false); }` },
    { code: `class C { removed = 1; }` },

    // Too short to be a past participle
    { code: `class C { ed = output<void>(); }` },
  ],
  invalid: [
    {
      code: `class C { playerSelected = output<Player>(); }`,
      errors: [{ messageId: 'pastTense' }],
    },
    {
      code: `class C { filesRejected = output<void>(); }`,
      errors: [{ messageId: 'pastTense' }],
    },
    {
      code: `class C { removed = output<void>(); }`,
      errors: [{ messageId: 'pastTense' }],
    },
    {
      code: `class C { dragStarted = outputFromObservable(src$); }`,
      errors: [{ messageId: 'pastTense' }],
    },
    {
      code: `class C { uploadFailed = output<void>(); }`,
      errors: [{ messageId: 'pastTense' }],
    },
  ],
});
