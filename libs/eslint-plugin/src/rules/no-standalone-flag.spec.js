// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const rule = require('./no-standalone-flag');

const tester = new RuleTester({
  languageOptions: {
    parser: require('@typescript-eslint/parser'),
  },
});

tester.run('no-standalone-flag', rule, {
  valid: [
    {
      code: `import { Component } from 'some-other-lib';
@Component({ selector: 'et-a', standalone: true }) class A {}`,
    },
    {
      code: `@Component({ selector: 'et-test', template: '' }) class Foo {}`,
    },
    {
      code: `@Directive({ selector: '[etTest]' }) class Foo {}`,
    },
    {
      code: `@Pipe({ name: 'testPipe' }) class Foo {}`,
    },
    {
      code: `@Directive({ selector: '[etTest]', standalone: false, host: {} }) class Foo {}`,
    },
    { code: `@Component({ selector: 'et-a', standalone: !0 }) class A {}` },
    { code: `@Injectable({ standalone: true }) class A {}` },
    { code: `@NgModule({ standalone: true }) class A {}` },
    { code: `@Component() class A {}` },
    { code: `@Component(metadata) class A {}` },
  ],
  invalid: [
    {
      code: `import * as ng from '@angular/core';
@ng.Component({ selector: 'et-a', standalone: true }) class A {}`,
      output: `import * as ng from '@angular/core';
@ng.Component({ selector: 'et-a' }) class A {}`,
      errors: [{ messageId: 'noStandalone' }],
    },
    {
      code: `@Component({ selector: 'et-test', standalone: true, template: '' }) class Foo {}`,
      output: `@Component({ selector: 'et-test', template: '' }) class Foo {}`,
      errors: [{ messageId: 'noStandalone' }],
    },
    {
      code: `@Pipe({ standalone: true, name: 'testPipe' }) class Foo {}`,
      output: `@Pipe({ name: 'testPipe' }) class Foo {}`,
      errors: [{ messageId: 'noStandalone' }],
    },
    {
      code: `@Component({ standalone: true }) class A {}`,
      output: `@Component({}) class A {}`,
      errors: [{ messageId: 'noStandalone' }],
    },
    {
      code: `@Component({ 'standalone': true, selector: 'a' }) class A {}`,
      output: `@Component({ selector: 'a' }) class A {}`,
      errors: [{ messageId: 'noStandalone' }],
    },
    {
      code: `@Component({ ['standalone']: true, selector: 'a' }) class A {}`,
      output: `@Component({ selector: 'a' }) class A {}`,
      errors: [{ messageId: 'noStandalone' }],
    },
    {
      code: `@Component({ ...base, standalone: true }) class A {}`,
      output: `@Component({ ...base }) class A {}`,
      errors: [{ messageId: 'noStandalone' }],
    },
    {
      code: `@Component({\n  selector: 'a',\n  standalone: true,\n  template: '',\n})\nclass A {}`,
      output: `@Component({\n  selector: 'a',\n  template: '',\n})\nclass A {}`,
      errors: [{ messageId: 'noStandalone' }],
    },
    {
      code: `
@Component({
  selector: 'et-test',
  standalone: true,
})
class Foo {}
`,
      output: `
@Component({
  selector: 'et-test',
})
class Foo {}
`,
      errors: [{ messageId: 'noStandalone' }],
    },
  ],
});
