// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const tsParser = require('@typescript-eslint/parser');
const rule = require('./require-view-encapsulation-none');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module', parser: tsParser },
});

tester.run('require-view-encapsulation-none', rule, {
  valid: [
    // Correct — ViewEncapsulation.None explicitly set
    {
      code: `
@Component({ selector: 'my-cmp', template: '', encapsulation: ViewEncapsulation.None })
class MyCmp {}`,
    },
    // Not a @Component decorator — not checked
    {
      code: `
@Directive({ selector: '[myDir]' })
class MyDir {}`,
    },
    // @Pipe — not checked
    {
      code: `
@Pipe({ name: 'myPipe' })
class MyPipe {}`,
    },
  ],
  invalid: [
    {
      // Missing encapsulation property — default is Emulated, not allowed
      code: `
@Component({ selector: 'my-cmp', template: '' })
class MyCmp {}`,
      errors: [{ messageId: 'missing' }],
    },
    {
      // Explicitly set to Emulated
      code: `
@Component({ selector: 'my-cmp', template: '', encapsulation: ViewEncapsulation.Emulated })
class MyCmp {}`,
      errors: [{ messageId: 'notNone' }],
    },
    {
      // ShadowDom
      code: `
@Component({ selector: 'my-cmp', template: '', encapsulation: ViewEncapsulation.ShadowDom })
class MyCmp {}`,
      errors: [{ messageId: 'notNone' }],
    },
  ],
});
