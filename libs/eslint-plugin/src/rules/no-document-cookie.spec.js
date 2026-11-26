// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const rule = require('./no-document-cookie');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

tester.run('no-document-cookie', rule, {
  valid: [
    { code: `function read(document) { return document.cookie; }` },
    {
      code: `import { document } from './fake-dom';
document.cookie;`,
    },
    // Cookie utilities from @ethlete/core — fine
    { code: `import { getCookie, setCookie, hasCookie, deleteCookie } from '@ethlete/core';` },
    { code: `setCookie('name', 'value');` },
    { code: `getCookie('session');` },
    { code: `hasCookie('token');` },
    { code: `deleteCookie('session');` },
    // Other document properties — fine
    { code: `document.title;` },
    { code: `document.body;` },
    { code: `document.getElementById('app');` },
    { code: `class A { doc = inject(Other); read() { return this.doc.cookie; } }` },
    { code: `const window = { document: { cookie: '' } }; window.document.cookie;` },
  ],
  invalid: [
    // read
    {
      code: `const raw = document.cookie;`,
      errors: [{ messageId: 'noDocumentCookie' }],
    },
    // write
    {
      code: `document.cookie = 'name=value; path=/';`,
      errors: [{ messageId: 'noDocumentCookie' }],
    },
    // used in expression
    {
      code: `if (document.cookie.includes('session=')) {}`,
      errors: [{ messageId: 'noDocumentCookie' }],
    },
    // split
    {
      code: `document.cookie.split(';').forEach(c => console.log(c));`,
      errors: [{ messageId: 'noDocumentCookie' }],
    },
    {
      code: `class A { doc = inject(DOCUMENT); read() { return this.doc.cookie; } }`,
      errors: [{ messageId: 'noDocumentCookie' }],
    },
    {
      code: `const doc = inject(DOCUMENT); doc.cookie = 'a=b';`,
      errors: [{ messageId: 'noDocumentCookie' }],
    },
    { code: `window.document.cookie;`, errors: [{ messageId: 'noDocumentCookie' }] },
    { code: `globalThis.document.cookie;`, errors: [{ messageId: 'noDocumentCookie' }] },
    { code: `document['cookie'];`, errors: [{ messageId: 'noDocumentCookie' }] },
  ],
});
