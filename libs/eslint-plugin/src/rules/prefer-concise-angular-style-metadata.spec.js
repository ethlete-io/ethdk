// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const rule = require('./prefer-concise-angular-style-metadata');

const tester = new RuleTester({
  languageOptions: {
    parser: require('@typescript-eslint/parser'),
  },
});

tester.run('prefer-concise-angular-style-metadata', rule, {
  valid: [
    {
      code: `import { Component } from 'some-other-lib';
@Component({ styleUrls: ['./a.css'] }) class A {}`,
    },
    {
      code: `@Component({ styleUrl: './foo.css' }) class Foo {}`,
    },
    {
      code: `@Component({ styleUrls: ['./foo.css', './bar.css'] }) class Foo {}`,
    },
    {
      code: '@Component({ styles: `:host { display: block; }` }) class Foo {}',
    },
    {
      code: `@Component({ styles: [BASE_STYLES, EXTRA_STYLES] }) class Foo {}`,
    },
    {
      code: `@Directive({ styleUrls: ['./foo.css'] }) class Foo {}`,
    },
    {
      code: `@Component({ styleUrl: './a.css', styleUrls: ['./b.css'] }) class Foo {}`,
    },
  ],
  invalid: [
    {
      code: `import { Component as Cmp } from '@angular/core';
@Cmp({ styleUrls: ['./a.css'] }) class A {}`,
      output: `import { Component as Cmp } from '@angular/core';
@Cmp({ styleUrl: './a.css' }) class A {}`,
      errors: [{ messageId: 'preferStyleUrl' }],
    },
    {
      code: `@Component({ styleUrls: ['./foo.css'] }) class Foo {}`,
      output: `@Component({ styleUrl: './foo.css' }) class Foo {}`,
      errors: [{ messageId: 'preferStyleUrl' }],
    },
    {
      code: `@Component({ styles: [\` :host { display: block; } \`] }) class Foo {}`,
      output: `@Component({ styles: \` :host { display: block; } \` }) class Foo {}`,
      errors: [{ messageId: 'preferSingleStyle' }],
    },
    {
      code: `@Component({ styles: [STORY_STYLES] }) class Foo {}`,
      output: `@Component({ styles: STORY_STYLES }) class Foo {}`,
      errors: [{ messageId: 'preferSingleStyle' }],
    },
  ],
});
