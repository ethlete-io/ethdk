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
    { code: `const check = (check): boolean => { return check; };` },
    { code: `function walk(node): boolean { return node.ok && walk(node.next); }` },
    // No return type annotation — inferred
    { code: `const fn = () => {};` },
    { code: `const fn = () => 'hello';` },
    // Non-trivial return type
    { code: `const parse = (): Date => new Date();` },
    { code: `const build = (): MyType => ({});` },
    { code: `export const remove = (key: string): void => cache.delete(key);` },
    { code: `const check = (): boolean => true;` },
    { code: `const getName = (): string => 'name';` },
    { code: `const getCount = (): number => 42;` },
    { code: `const maybeUndefined = (): undefined => undefined;` },
    { code: `const noop = (): null => null;` },
    // Type context — allowed
    { code: `type F = () => void;` },
    { code: `interface I { fn(): string; }` },
    // Self-referencing (recursive) — TS can't infer the return type (TS7023), keep it
    { code: `const walk = (n): boolean => n <= 0 || walk(n - 1);` },
    { code: `const f = function go(n): boolean { return n <= 0 || go(n - 1); };` },
    { code: `class A { check(n): boolean { return n <= 0 || this.check(n - 1); } }` },
    { code: `class A { check = (n): boolean => n <= 0 || this.check(n - 1); }` },
    { code: `const obj = { check(n): boolean { return n <= 0 || this.check(n - 1); } };` },
    // Indirect self-reference inside a callback still counts
    { code: `class A { all(nodes): boolean { return nodes.every((n) => this.all(n.children)); } }` },
  ],
  invalid: [
    {
      code: `class C { private data: any; name(): string { return this.data.name; } }`,
      output: null,
      errors: [
        {
          messageId: 'trivialReturnType',
          suggestions: [
            {
              messageId: 'removeReturnType',
              output: `class C { private data: any; name() { return this.data.name; } }`,
            },
          ],
        },
      ],
    },
    {
      code: `const disabled = (v: any): boolean => { return v.disabled; };`,
      errors: [
        {
          messageId: 'trivialReturnType',
          suggestions: [
            { messageId: 'removeReturnType', output: `const disabled = (v: any) => { return v.disabled; };` },
          ],
        },
      ],
    },
    {
      code: `const disabled = (v: any): boolean => { return { disabled: 1 } && v; };`,
      errors: [
        {
          messageId: 'trivialReturnType',
          suggestions: [
            { messageId: 'removeReturnType', output: `const disabled = (v: any) => { return { disabled: 1 } && v; };` },
          ],
        },
      ],
    },
    {
      code: `const fn = (): void => {};`,
      errors: [
        {
          messageId: 'trivialReturnType',
          suggestions: [{ messageId: 'removeReturnType', output: `const fn = () => {};` }],
        },
      ],
    },
    // Non-recursive class method — still stripped
    {
      code: `class A { check(): boolean { return true; } }`,
      errors: [
        {
          messageId: 'trivialReturnType',
          suggestions: [{ messageId: 'removeReturnType', output: `class A { check() { return true; } }` }],
        },
      ],
    },
    {
      code: `export function go(): boolean { return true; }`,
      errors: [
        {
          messageId: 'trivialReturnType',
          suggestions: [{ messageId: 'removeReturnType', output: `export function go() { return true; }` }],
        },
      ],
    },
  ],
});
