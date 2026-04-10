// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const rule = require('./prefer-viewport-size');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

tester.run('prefer-viewport-size', rule, {
  valid: [
    // Signal-based alternative — fine
    { code: `const viewport = injectViewportSize(); const w = viewport().width;` },
    // Unrelated window property
    { code: `const loc = window.location;` },
    { code: `const title = document.title;` },
  ],
  invalid: [
    {
      code: `const w = window.innerWidth;`,
      errors: [{ messageId: 'preferViewportSize' }],
    },
    {
      code: `const h = window.innerHeight;`,
      errors: [{ messageId: 'preferViewportSize' }],
    },
    {
      code: `const w = window.outerWidth;`,
      errors: [{ messageId: 'preferViewportSize' }],
    },
    {
      code: `const screen = window.screen;`,
      errors: [{ messageId: 'preferViewportSize' }],
    },
  ],
});
