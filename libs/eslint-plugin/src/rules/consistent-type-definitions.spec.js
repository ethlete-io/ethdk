// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const parser = require('@typescript-eslint/parser');
const rule = require('./consistent-type-definitions');

const tester = new RuleTester({
  languageOptions: { parser, ecmaVersion: 2022, sourceType: 'module' },
});

tester.run('consistent-type-definitions', rule, {
  valid: [
    { code: `type User = { name: string };` },
    {
      code: `declare module '@ethlete/core' {\n  interface EthleteColorThemeNameRegistry {\n    name: 'brand';\n  }\n}\n\nexport {};`,
      filename: 'generated-tailwind-themes.d.ts',
    },
    {
      code: `declare module '@ethlete/core' {\n  interface EthleteColorThemeNameRegistry {\n    name: 'brand';\n  }\n}`,
    },
    { code: `declare global {\n  interface Window {\n    appVersion: string;\n  }\n}\n\nexport {};` },
    { code: `declare namespace Express {\n  interface Request {\n    user: string;\n  }\n}` },
  ],
  invalid: [
    {
      code: `interface User { name: string }`,
      errors: [{ messageId: 'typeOverInterface' }],
      output: `type User = { name: string }`,
    },
    {
      code: `export interface Admin extends User { role: string }`,
      errors: [{ messageId: 'typeOverInterface' }],
      output: `export type Admin = { role: string } & User`,
    },
    {
      code: `declare module '@ethlete/core' {\n  type Extra = { a: string };\n}\n\ninterface User { name: string }`,
      errors: [{ messageId: 'typeOverInterface', line: 5 }],
      output: `declare module '@ethlete/core' {\n  type Extra = { a: string };\n}\n\ntype User = { name: string }`,
    },
  ],
});
