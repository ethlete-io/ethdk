// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const rule = require('./no-window-location');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

tester.run('no-window-location', rule, {
  valid: [
    // Signal-based alternatives — fine
    { code: `const url = injectUrl();` },
    { code: `const route = injectRoute();` },
    { code: `const param = injectQueryParam('id');` },
    { code: `const fragment = injectFragment();` },
    // Navigation redirect — not flagged
    { code: `window.location.href = 'https://example.com';` },
    // Non-state properties — fine
    { code: `window.location.hostname;` },
    { code: `window.location.origin;` },
    { code: `window.location.host;` },
    { code: `const location = { href: '' }; location.href;` },
    { code: `const loc = other.location; loc.href;` },
    { code: `const { origin } = window.location;` },
    // URLSearchParams with a non-location arg — fine
    { code: `new URLSearchParams('a=1&b=2');` },
    { code: `new URLSearchParams(someString);` },
  ],
  invalid: [
    {
      code: `const path = window.location.pathname;`,
      errors: [{ messageId: 'noWindowLocation' }],
    },
    {
      code: `const url = window.location.href;`,
      errors: [{ messageId: 'noWindowLocation' }],
    },
    {
      code: `const search = window.location.search;`,
      errors: [{ messageId: 'noWindowLocation' }],
    },
    {
      code: `const hash = window.location.hash;`,
      errors: [{ messageId: 'noWindowLocation' }],
    },
    {
      code: `const full = window.location.pathname + window.location.search + window.location.hash;`,
      errors: [{ messageId: 'noWindowLocation' }, { messageId: 'noWindowLocation' }, { messageId: 'noWindowLocation' }],
    },
    {
      code: `const params = new URLSearchParams(window.location.search);`,
      errors: [{ messageId: 'noURLSearchParams' }, { messageId: 'noWindowLocation' }],
    },
    { code: `const url = location.href;`, errors: [{ messageId: 'noWindowLocation' }] },
    { code: `const url = globalThis.location.pathname;`, errors: [{ messageId: 'noWindowLocation' }] },
    {
      code: `const loc = window.location;
const url = loc.href;`,
      errors: [{ messageId: 'noWindowLocation' }],
    },
    {
      code: `const { pathname, search } = window.location;`,
      errors: [{ messageId: 'noWindowLocation' }, { messageId: 'noWindowLocation' }],
    },
    { code: `window.location.href += '#x';`, errors: [{ messageId: 'noWindowLocation' }] },
  ],
});
