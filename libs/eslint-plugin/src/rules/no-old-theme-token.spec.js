// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const tsParser = require('@typescript-eslint/parser');
const plugin = require('../index');
const rule = require('./no-old-theme-token');

const cssTester = new RuleTester({
  plugins: { ethlete: plugin },
  language: 'ethlete/css',
});

const tsTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module', parser: tsParser },
});

cssTester.run('no-old-theme-token (css)', rule, {
  valid: [
    { code: `.a { color: var(--et-surface-text); background: var(--et-tone-fill-hover); }` },
    { code: `.a { border-color: var(--et-surface-border); --et-surface-type: dark; }` },
    { code: `.a { color: color-mix(in srgb, var(--et-surface-border) 20%, transparent); }` },
    { code: `.a { --et-color-theme-type: light; --et-color-picker-size: 1px; }` },
    { code: `@apply bg-gg-tone-fill text-gg-surface-text;`, options: [{ prefixes: ['gg'] }] },
    { code: `@apply bg-et-theme;`, options: [{ prefixes: [] }] },
    { code: `@apply bg-fut-theme;`, options: [{ prefixes: ['gg'] }] },
  ],
  invalid: [
    {
      code: `.a { color: var(--et-surface-background-solid); }`,
      errors: [{ messageId: 'retiredToken', data: { name: '--et-surface-background-solid' }, line: 1, column: 17 }],
    },
    {
      code: `.a {\n  background: rgb(var(--et-surface-background-rgb));\n}`,
      errors: [{ messageId: 'retiredToken', line: 2, column: 23, endColumn: 50 }],
    },
    {
      code: `.a { color: var(--et-theme-color-primary); --x: var(--et-theme-color-on-primary-rgb); }`,
      errors: [{ messageId: 'retiredToken' }, { messageId: 'retiredToken' }],
    },
    { code: `.a { color: var(--et-color-primary-hover); }`, errors: [{ messageId: 'retiredToken' }] },
    { code: `.a { color: var(--et-color-secondary); }`, errors: [{ messageId: 'retiredToken' }] },
    {
      code: `.a { color: rgb(var(--et-surface-border) / 0.2); }`,
      errors: [{ messageId: 'tripletRead', line: 1, column: 13 }],
    },
    { code: `.a { color: rgba(var(--et-surface-interaction-hover), 0.2); }`, errors: [{ messageId: 'tripletRead' }] },
    {
      code: `.a { @apply bg-et-theme text-et-on-theme-hover border-et-theme-ink; }`,
      errors: [{ messageId: 'tailwindName' }, { messageId: 'tailwindName' }, { messageId: 'tailwindName' }],
    },
    {
      code: `.a { @apply bg-gg-surface-bg text-gg-surface text-gg-surface-subtle; }`,
      options: [{ prefixes: ['gg'] }],
      errors: [{ messageId: 'tailwindName' }, { messageId: 'tailwindName' }, { messageId: 'tailwindName' }],
    },
    {
      code: `@theme { --color-gg-theme-hover: red; --color-fut-theme: blue; }`,
      options: [{ prefixes: ['gg', 'fut'] }],
      errors: [{ messageId: 'tailwindName' }, { messageId: 'tailwindName' }],
    },
  ],
});

tsTester.run('no-old-theme-token (ts)', rule, {
  valid: [{ code: `const c = 'bg-et-tone-fill text-et-surface-text';` }, { code: `const p = '--et-surface-text';` }],
  invalid: [
    { code: `const c = 'bg-et-theme';`, errors: [{ messageId: 'tailwindName', line: 1, column: 15 }] },
    { code: 'const v = `var(--et-theme-color-primary-${state})`;', errors: [{ messageId: 'retiredToken' }] },
  ],
});
