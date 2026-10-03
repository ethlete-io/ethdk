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
    { code: `declare module 'x' {\n  namespace Inner {\n    interface Bar {\n      a: 1;\n    }\n  }\n}` },
    { code: `declare module 'x' {\n  export interface Bar extends Base {}\n}` },
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
      code: `interface Foo<T> { a: T }`,
      errors: [{ messageId: 'typeOverInterface' }],
      output: `type Foo<T> = { a: T }`,
    },
    {
      code: `interface A extends B, C { a: 1 }`,
      errors: [{ messageId: 'typeOverInterface' }],
      output: `type A = { a: 1 } & B & C`,
    },
    {
      code: `export default interface Foo { a: 1 }`,
      errors: [{ messageId: 'typeOverInterface' }],
      output: `type Foo = { a: 1 }\nexport default Foo`,
    },
    {
      code: `declare global {\n  function f(): void;\n}\n\ninterface Bar { a: 1 }`,
      errors: [{ messageId: 'typeOverInterface', line: 5 }],
      output: `declare global {\n  function f(): void;\n}\n\ntype Bar = { a: 1 }`,
    },
    {
      code: `declare module '@ethlete/core' {\n  type Extra = { a: string };\n}\n\ninterface User { name: string }`,
      errors: [{ messageId: 'typeOverInterface', line: 5 }],
      output: `declare module '@ethlete/core' {\n  type Extra = { a: string };\n}\n\ntype User = { name: string }`,
    },
  ],
});
