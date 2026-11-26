// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const tsParser = require('@typescript-eslint/parser');
const rule = require('./prefer-viewport-size');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module', parser: tsParser },
});

tester.run('prefer-viewport-size', rule, {
  valid: [
    { code: `const h = window.outerHeight;` },
    { code: `const w = foo.window.innerWidth;` },
    { code: `const h = document.defaultView?.outerHeight;` },
    // Signal-based alternative — fine
    { code: `const viewport = injectViewportSize(); const w = viewport().width;` },
    // Unrelated window property
    { code: `const loc = window.location;` },
    { code: `const title = document.title;` },
    { code: `const w = window.outerWidth;` },
    { code: `const screen = window.screen;` },
    { code: `const w = layout.innerWidth;` },
    { code: `const w = myMock.notTheDefaultView.innerWidth;` },
    { code: `const read = (innerWidth: number) => innerWidth;` },
    { code: `const window = { innerWidth: 1 }; const w = window.innerWidth;` },
    { code: `class A { win = createMock(); read() { return this.win.innerWidth; } }` },
  ],
  invalid: [
    {
      code: `const w = document.defaultView.innerWidth;`,
      errors: [{ messageId: 'preferViewportSize' }],
    },
    {
      code: `const h = self.innerHeight;`,
      errors: [{ messageId: 'preferViewportSize' }],
    },
    {
      code: `class A {
  constructor() { this.win = document.defaultView; }
  read() { return this.win?.innerWidth; }
}`,
      errors: [{ messageId: 'preferViewportSize' }],
    },
    {
      code: `class A { win = inject(DOCUMENT).defaultView!; read() { return this.win.innerHeight; } }`,
      errors: [{ messageId: 'preferViewportSize' }],
    },
    {
      code: `const win = document.defaultView; const w = win?.innerWidth;`,
      errors: [{ messageId: 'preferViewportSize' }],
    },
    {
      code: `const w = globalThis.innerWidth;`,
      errors: [{ messageId: 'preferViewportSize' }],
    },
    {
      code: `const w = innerWidth + innerHeight;`,
      errors: [{ messageId: 'preferViewportSize' }, { messageId: 'preferViewportSize' }],
    },
    {
      code: `const w = innerWidth;`,
      languageOptions: { globals: { innerWidth: 'readonly', window: 'readonly' } },
      errors: [{ messageId: 'preferViewportSize' }],
    },
    {
      code: `const w = window['innerWidth'];`,
      errors: [{ messageId: 'preferViewportSize' }],
    },
    {
      code: `const h = document.defaultView?.innerHeight;`,
      errors: [{ messageId: 'preferViewportSize' }],
    },
    {
      code: `const w = window.innerWidth;`,
      errors: [{ messageId: 'preferViewportSize' }],
    },
    {
      code: `const h = window.innerHeight;`,
      errors: [{ messageId: 'preferViewportSize' }],
    },
  ],
});
