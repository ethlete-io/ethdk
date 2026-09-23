// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const rule = require('./no-locale-id');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

tester.run('no-locale-id', rule, {
  valid: [
    {
      code: `import { inject } from 'some-other-lib';
inject(LOCALE_ID);`,
    },
    {
      code: `import { LOCALE_ID } from './tokens';
inject(LOCALE_ID);`,
    },
    // injectLocale from @ethlete/core — fine
    { code: `import { injectLocale } from '@ethlete/core';` },
    { code: `const locale = injectLocale();` },
    // Other @angular/core imports — fine
    { code: `import { inject, signal } from '@angular/core';` },
    { code: `import { Component, PLATFORM_ID } from '@angular/core';` },
    { code: `inject(MyService);` },
    { code: `import { LOCALE_ID } from '@angular/core'; const provider = { provide: LOCALE_ID, useValue: 'de' };` },
  ],
  invalid: [
    {
      code: `import { inject as ngInject, LOCALE_ID } from '@angular/core';
ngInject(LOCALE_ID);`,
      errors: [{ messageId: 'noLocaleId' }],
    },
    {
      code: `const locale = inject(LOCALE_ID);`,
      errors: [{ messageId: 'noLocaleId' }],
    },
  ],
});
