// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const rule = require('./no-locale-id');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

tester.run('no-locale-id', rule, {
  valid: [
    // injectLocale from @ethlete/core — fine
    { code: `import { injectLocale } from '@ethlete/core';` },
    { code: `const locale = injectLocale();` },
    // Other @angular/core imports — fine
    { code: `import { inject, signal } from '@angular/core';` },
    { code: `import { Component, PLATFORM_ID } from '@angular/core';` },
    { code: `inject(MyService);` },
  ],
  invalid: [
    {
      code: `import { LOCALE_ID } from '@angular/core';`,
      errors: [{ messageId: 'noLocaleId' }],
    },
    {
      code: `import { inject, LOCALE_ID } from '@angular/core';`,
      errors: [{ messageId: 'noLocaleId' }],
    },
    {
      code: `const locale = inject(LOCALE_ID);`,
      errors: [{ messageId: 'noLocaleId' }],
    },
  ],
});
