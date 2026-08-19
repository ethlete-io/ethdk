// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const parser = require('@typescript-eslint/parser');
const rule = require('./no-enum');

const tester = new RuleTester({
  languageOptions: { parser, ecmaVersion: 2022, sourceType: 'module' },
});

tester.run('no-enum', rule, {
  valid: [
    {
      code: `export const MatchState = { Live: 'live' } as const;\nexport type MatchState = (typeof MatchState)[keyof typeof MatchState];`,
    },
    { code: `type MatchState = 'live' | 'preMatch';` },
    { code: `const states = { live: 'live' };` },
  ],
  invalid: [
    {
      code: `enum A {\n  X = 'x',\n}`,
      errors: [{ messageId: 'noEnum', data: { name: 'A' } }],
      output: `const A = {\n  X: 'x',\n} as const;\n\ntype A = (typeof A)[keyof typeof A];`,
    },
    {
      code: `export enum MatchState {\n  PRE_MATCH = 'preMatch',\n  LIVE = 'live',\n}`,
      errors: [{ messageId: 'noEnum' }],
      output: `export const MatchState = {\n  PRE_MATCH: 'preMatch',\n  LIVE: 'live',\n} as const;\n\nexport type MatchState = (typeof MatchState)[keyof typeof MatchState];`,
    },
    {
      code: `export const enum QueryState {\n  Success = 'SUCCESS',\n}`,
      errors: [{ messageId: 'noConstEnum', data: { name: 'QueryState' } }],
      output: `export const QueryState = {\n  Success: 'SUCCESS',\n} as const;\n\nexport type QueryState = (typeof QueryState)[keyof typeof QueryState];`,
    },
    {
      // A member's JSDoc survives the fix
      code: `export enum Strategy {\n  /** Refresh before the token expires. */\n  BeforeExpiration = 'beforeExpiration',\n}`,
      errors: [{ messageId: 'noEnum' }],
      output: `export const Strategy = {\n  /** Refresh before the token expires. */\n  BeforeExpiration: 'beforeExpiration',\n} as const;\n\nexport type Strategy = (typeof Strategy)[keyof typeof Strategy];`,
    },
    {
      // A multi-line JSDoc keeps its `*` alignment
      code: `export enum Strategy {\n  /**\n   * Refresh before expiration.\n   */\n  BeforeExpiration = 'beforeExpiration',\n}`,
      errors: [{ messageId: 'noEnum' }],
      output: `export const Strategy = {\n  /**\n   * Refresh before expiration.\n   */\n  BeforeExpiration: 'beforeExpiration',\n} as const;\n\nexport type Strategy = (typeof Strategy)[keyof typeof Strategy];`,
    },
    {
      // A numeric enum has no safe const-object equivalent, so it is reported without a fix
      code: `enum Level {\n  Low,\n  High,\n}`,
      errors: [{ messageId: 'noEnum' }],
      output: null,
    },
    {
      code: `declare enum Ambient {\n  X = 'x',\n}`,
      errors: [{ messageId: 'noEnum' }],
      output: null,
    },
  ],
});
