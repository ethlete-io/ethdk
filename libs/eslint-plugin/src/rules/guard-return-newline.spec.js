// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const rule = require('./guard-return-newline');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

tester.run('guard-return-newline', rule, {
  valid: [
    // Single-statement guard inside function — exempt
    { code: `function fn() { if (!x) return; }` },
    // Multi-statement guard WITH empty line before return — fine
    {
      code: `function fn() {
if (!allFilled) {
  doSomething();

  return;
}
}`,
    },
    // return inside non-if block — not applicable
    {
      code: `
function fn() {
  doA();
  doB();
  return;
}`,
    },
    // Single statement in block — exempt
    {
      code: `function fn() {
if (!x) {
  return;
}
}`,
    },
  ],
  invalid: [
    {
      code: `function fn() {
if (!allFilled) {
  doSomething();
  return;
}
}`,
      output: `function fn() {
if (!allFilled) {
  doSomething();

  return;
}
}`,
      errors: [{ messageId: 'missingEmptyLine' }],
    },
    {
      code: `function fn() {
if (condition) {
  doA();
  doB();
  return;
}
}`,
      output: `function fn() {
if (condition) {
  doA();
  doB();

  return;
}
}`,
      errors: [{ messageId: 'missingEmptyLine' }],
    },
  ],
});
