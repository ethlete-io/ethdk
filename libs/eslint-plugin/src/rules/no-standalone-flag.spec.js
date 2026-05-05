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
      code: `@Component({ selector: 'et-test', template: '' }) class Foo {}`,
    },
    {
      code: `@Directive({ selector: '[etTest]' }) class Foo {}`,
    },
    {
      code: `@Pipe({ name: 'testPipe' }) class Foo {}`,
    },
  ],
  invalid: [
    {
      code: `@Component({ selector: 'et-test', standalone: true, template: '' }) class Foo {}`,
      output: `@Component({ selector: 'et-test', template: '' }) class Foo {}`,
      errors: [{ messageId: 'noStandalone' }],
    },
    {
      code: `@Directive({ selector: '[etTest]', standalone: false, host: {} }) class Foo {}`,
      output: `@Directive({ selector: '[etTest]', host: {} }) class Foo {}`,
      errors: [{ messageId: 'noStandalone' }],
    },
    {
      code: `@Pipe({ standalone: true, name: 'testPipe' }) class Foo {}`,
      output: `@Pipe({ name: 'testPipe' }) class Foo {}`,
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
