// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const tsParser = require('@typescript-eslint/parser');
const rule = require('./no-trivial-return-type');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module', parser: tsParser },
});

tester.run('no-trivial-return-type', rule, {
  valid: [
    // No return type annotation — inferred
    { code: `const fn = () => {};` },
    { code: `const fn = () => 'hello';` },
    // Non-trivial return type
    { code: `const parse = (): Date => new Date();` },
    { code: `const build = (): MyType => ({});` },
    // Type context — allowed
    { code: `type F = () => void;` },
    { code: `interface I { fn(): string; }` },
  ],
  invalid: [
    {
      code: `const fn = (): void => {};`,
      output: `const fn = () => {};`,
      errors: [{ messageId: 'trivialReturnType' }],
    },
    {
      code: `const check = (): boolean => true;`,
      output: `const check = () => true;`,
      errors: [{ messageId: 'trivialReturnType' }],
    },
    {
      code: `const getName = (): string => 'name';`,
      output: `const getName = () => 'name';`,
      errors: [{ messageId: 'trivialReturnType' }],
    },
    {
      code: `const getCount = (): number => 42;`,
      output: `const getCount = () => 42;`,
      errors: [{ messageId: 'trivialReturnType' }],
    },
    {
      code: `const maybeUndefined = (): undefined => undefined;`,
      output: `const maybeUndefined = () => undefined;`,
      errors: [{ messageId: 'trivialReturnType' }],
    },
    {
      code: `const noop = (): null => null;`,
      output: `const noop = () => null;`,
      errors: [{ messageId: 'trivialReturnType' }],
    },
  ],
});
