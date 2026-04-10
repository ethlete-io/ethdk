// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const rule = require('./no-screaming-case-local');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

tester.run('no-screaming-case-local', rule, {
  valid: [
    // SCREAMING_CASE at module level — fine
    { code: `const MAX_RETRIES = 3;` },
    { code: `const API_URL = 'https://example.com';` },
    // camelCase inside functions — fine
    { code: `const fn = () => { const myValue = 42; };` },
    // lowercase local constant — fine
    { code: `function doWork() { const result = compute(); return result; }` },
    // camelCase function name — fine
    { code: `const myFunction = () => {};` },
  ],
  invalid: [
    {
      // SCREAMING_CASE inside arrow function body
      code: `const fn = () => { const RANDOM = Math.random(); };`,
      errors: [{ messageId: 'noScreamingCaseLocal' }],
    },
    {
      // SCREAMING_CASE inside regular function body
      code: `function fn() { const MY_FLAG = true; return MY_FLAG; }`,
      errors: [{ messageId: 'noScreamingCaseLocal' }],
    },
    {
      // SCREAMING_CASE name for a function-valued variable (at any scope)
      code: `const MY_HANDLER = () => {};`,
      errors: [{ messageId: 'noScreamingCaseFunctionName' }],
    },
    {
      // SCREAMING_CASE function expression
      code: `const DO_THING = function() {};`,
      errors: [{ messageId: 'noScreamingCaseFunctionName' }],
    },
  ],
});
