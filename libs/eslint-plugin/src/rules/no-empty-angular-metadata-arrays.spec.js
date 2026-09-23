// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const rule = require('./no-empty-angular-metadata-arrays');

const tester = new RuleTester({
  languageOptions: {
    parser: require('@typescript-eslint/parser'),
  },
});

tester.run('no-empty-angular-metadata-arrays', rule, {
  valid: [
    {
      code: `import { Component } from 'some-other-lib';
@Component({ selector: 'et-a', imports: [] }) class A {}`,
    },
    {
      code: `@Component({ selector: 'et-test', template: '', imports: [FooComponent] }) class Foo {}`,
    },
    {
      code: `@Directive({ selector: '[etTest]', hostDirectives: [FooDirective] }) class Foo {}`,
    },
  ],
  invalid: [
    {
      code: `import { Component as Cmp } from '@angular/core';
@Cmp({ selector: 'et-a', imports: [] }) class A {}`,
      output: `import { Component as Cmp } from '@angular/core';
@Cmp({ selector: 'et-a' }) class A {}`,
      errors: [{ messageId: 'noEmptyImports' }],
    },
    {
      code: `@Component({ selector: 'et-test', imports: [], template: '' }) class Foo {}`,
      output: `@Component({ selector: 'et-test', template: '' }) class Foo {}`,
      errors: [{ messageId: 'noEmptyImports' }],
    },
    {
      code: `@Component({ ...BASE, imports: [] }) class Foo {}`,
      output: `@Component({ ...BASE }) class Foo {}`,
      errors: [{ messageId: 'noEmptyImports' }],
    },
    {
      code: `@Directive({ selector: '[etTest]', hostDirectives: [], standalone: true }) class Foo {}`,
      output: `@Directive({ selector: '[etTest]', standalone: true }) class Foo {}`,
      errors: [{ messageId: 'noEmptyHostDirectives' }],
    },
    {
      code: `
@Component({
  selector: 'et-test',
  imports: [],
})
class Foo {}
`,
      output: `
@Component({
  selector: 'et-test',
})
class Foo {}
`,
      errors: [{ messageId: 'noEmptyImports' }],
    },
  ],
});
