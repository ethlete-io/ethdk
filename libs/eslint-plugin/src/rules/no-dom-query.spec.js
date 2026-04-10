// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const rule = require('./no-dom-query');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

tester.run('no-dom-query', rule, {
  valid: [
    // Angular signal queries — the correct pattern
    { code: `const label = viewChild('labelRef');` },
    { code: `const items = viewChildren(ItemDirective);` },
    { code: `const content = contentChild(ContentDirective);` },
    // Unrelated method calls that happen to share part of the name
    { code: `arr.find(x => x.id === id);` },
    { code: `map.get('key');` },
    { code: `this.service.getById(id);` },
    // ElementRef access on host — still direct, but not a query call
    { code: `this.elementRef.nativeElement.getBoundingClientRect();` },
  ],
  invalid: [
    {
      code: `host.querySelector('[data-id]');`,
      errors: [{ messageId: 'noDomQuery' }],
    },
    {
      code: `host.querySelectorAll('.item');`,
      errors: [{ messageId: 'noDomQuery' }],
    },
    {
      code: `document.getElementById('my-id');`,
      errors: [{ messageId: 'noDomQuery' }],
    },
    {
      code: `el.getElementsByClassName('foo');`,
      errors: [{ messageId: 'noDomQuery' }],
    },
    {
      code: `el.getElementsByTagName('div');`,
      errors: [{ messageId: 'noDomQuery' }],
    },
    {
      code: `el.getElementsByName('email');`,
      errors: [{ messageId: 'noDomQuery' }],
    },
    {
      code: `el.closest('.container');`,
      errors: [{ messageId: 'noDomQuery' }],
    },
    {
      code: `this.elementRef.nativeElement.querySelectorAll('[data-notification-id]');`,
      errors: [{ messageId: 'noDomQuery' }],
    },
    {
      code: `Array.from(host.querySelectorAll('[data-notification-id]'));`,
      errors: [{ messageId: 'noDomQuery' }],
    },
  ],
});
