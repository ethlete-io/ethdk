// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const rule = require('./prefer-match-media');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

tester.run('prefer-match-media', rule, {
  valid: [
    // Signal-based alternative — fine
    { code: `const isDark = injectMediaQueryIsMatched('(prefers-color-scheme: dark)');` },
    { code: `const canHover = injectCanHover();` },
    // Unrelated member calls
    { code: `arr.filter(x => x);` },
    { code: `el.querySelector('div');` },
    // injectBreakpointObserver from @ethlete/core is allowed
    { code: `import { injectBreakpointObserver } from '@ethlete/core';` },
    // Other CDK layout imports are fine
    { code: `import { BreakpointState } from '@angular/cdk/layout';` },
    // inject() with other tokens is fine
    { code: `inject(MyService);` },
  ],
  invalid: [
    {
      code: `window.matchMedia('(prefers-color-scheme: dark)').matches;`,
      errors: [{ messageId: 'preferMatchMedia' }],
    },
    {
      code: `const mq = window.matchMedia('(max-width: 768px)');`,
      errors: [{ messageId: 'preferMatchMedia' }],
    },
    {
      code: `document.defaultView.matchMedia('(min-width: 1200px)');`,
      errors: [{ messageId: 'preferMatchMedia' }],
    },
    {
      code: `import { BreakpointObserver } from '@angular/cdk/layout';`,
      errors: [{ messageId: 'noBreakpointObserver' }],
    },
    {
      code: `import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';`,
      errors: [{ messageId: 'noBreakpointObserver' }],
    },
    {
      code: `const bo = inject(BreakpointObserver);`,
      errors: [{ messageId: 'noBreakpointObserver' }],
    },
  ],
});
