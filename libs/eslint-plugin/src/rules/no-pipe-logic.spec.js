// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const tsParser = require('@typescript-eslint/parser');
const rule = require('./no-pipe-logic');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module', parser: tsParser },
});

tester.run('no-pipe-logic', rule, {
  valid: [
    // transform assigned as reference to external utility — fine
    {
      code: `
@Pipe({ name: 'myPipe' })
class MyPipe {
  transform = myUtil;
}`,
    },
    // transform method in a non-Pipe class — fine
    {
      code: `
class NotAPipe {
  transform(value) { return value + 1; }
}`,
    },
    // @Pipe class without transform — fine
    {
      code: `
@Pipe({ name: 'empty' })
class EmptyPipe {}`,
    },
  ],
  invalid: [
    {
      // Method definition with body
      code: `
@Pipe({ name: 'myPipe' })
class MyPipe {
  transform(value) { return value + 1; }
}`,
      errors: [{ messageId: 'noLogicInTransform' }],
    },
    {
      // Arrow function property with body
      code: `
@Pipe({ name: 'myPipe' })
class MyPipe {
  transform = (value) => value + 1;
}`,
      errors: [{ messageId: 'noLogicInTransform' }],
    },
    {
      // Function expression property
      code: `
@Pipe({ name: 'myPipe' })
class MyPipe {
  transform = function(value) { return value + 1; };
}`,
      errors: [{ messageId: 'noLogicInTransform' }],
    },
  ],
});
