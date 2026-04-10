// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const rule = require('./no-angular-seo-services');

const tester = new RuleTester({
  languageOptions: {
    parser: require('@typescript-eslint/parser'),
    ecmaVersion: 2022,
    sourceType: 'module',
  },
});

tester.run('no-angular-seo-services', rule, {
  valid: [
    // Using ethlete/core SEO utilities is fine
    { code: `import { injectTitleBinding } from '@ethlete/core';` },
    { code: `import { injectMetaBinding } from '@ethlete/core';` },
    // Importing other things from @angular/platform-browser is fine
    { code: `import { DomSanitizer } from '@angular/platform-browser';` },
    { code: `import { BrowserModule } from '@angular/platform-browser';` },
    // inject() with other tokens is fine
    { code: `const router = inject(Router);` },
    { code: `const doc = inject(DOCUMENT);` },
    // Identifiers named Title/Meta that are not inject() arguments
    { code: `const x = Title;` },
    { code: `const x = Meta;` },
  ],

  invalid: [
    // ── inject(Title) ────────────────────────────────────────────────────────

    {
      code: `const title = inject(Title);`,
      errors: [{ messageId: 'noInjectTitle' }],
    },
    {
      code: `const t = inject(Title);`,
      errors: [{ messageId: 'noInjectTitle' }],
    },

    // ── inject(Meta) ─────────────────────────────────────────────────────────

    {
      code: `const meta = inject(Meta);`,
      errors: [{ messageId: 'noInjectMeta' }],
    },

    // ── import { Title } from '@angular/platform-browser' ────────────────────

    {
      code: `import { Title } from '@angular/platform-browser';`,
      errors: [{ messageId: 'noImportTitle' }],
    },
    {
      // Aliased import — still flags the imported name
      code: `import { Title as AngularTitle } from '@angular/platform-browser';`,
      errors: [{ messageId: 'noImportTitle' }],
    },

    // ── import { Meta } from '@angular/platform-browser' ─────────────────────

    {
      code: `import { Meta } from '@angular/platform-browser';`,
      errors: [{ messageId: 'noImportMeta' }],
    },

    // ── both in a single import statement ────────────────────────────────────

    {
      code: `import { Title, Meta } from '@angular/platform-browser';`,
      errors: [{ messageId: 'noImportTitle' }, { messageId: 'noImportMeta' }],
    },

    // ── real-world usage pattern ──────────────────────────────────────────────

    {
      code: `
import { Title, Meta } from '@angular/platform-browser';
import { inject } from '@angular/core';

class MyComponent {
  title = inject(Title);
  meta  = inject(Meta);
}`,
      errors: [
        { messageId: 'noImportTitle' },
        { messageId: 'noImportMeta' },
        { messageId: 'noInjectTitle' },
        { messageId: 'noInjectMeta' },
      ],
    },
  ],
});
