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
      code: `@Component({ selector: 'et-test', template: '', imports: [FooComponent] }) class Foo {}`,
    },
    {
      code: `@Directive({ selector: '[etTest]', hostDirectives: [FooDirective] }) class Foo {}`,
    },
  ],
  invalid: [
    {
      code: `@Component({ selector: 'et-test', imports: [], template: '' }) class Foo {}`,
      output: `@Component({ selector: 'et-test', template: '' }) class Foo {}`,
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
