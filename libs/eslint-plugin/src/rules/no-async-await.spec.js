// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const rule = require('./no-async-await');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

tester.run('no-async-await', rule, {
  valid: [
    { code: `const copy = (text) => from(navigator.clipboard.writeText(text));` },
    { code: `function load() { return defer(() => http.get('/x')); }` },
    { code: `class A { save() { return this.http.post('/x').pipe(tap(() => this.done.set(true))); } }` },
    // Storybook play functions are called by the test runner and have to be promises
    { code: `export const Basic = { play: async ({ canvasElement }) => { await userEvent.click(el); } };` },
    { code: `export const Basic = { async play({ canvasElement }) { await userEvent.click(el); } };` },
  ],
  invalid: [
    {
      code: `async function load() { return 1; }`,
      errors: [{ messageId: 'noAsync' }],
    },
    {
      code: `const load = async () => from(x);`,
      errors: [{ messageId: 'noAsync' }],
    },
    {
      code: `class A { async save() { return 1; } }`,
      errors: [{ messageId: 'noAsync' }],
    },
    {
      code: `async function load() { const r = await fetch('/x'); return r; }`,
      errors: [{ messageId: 'noAsync' }, { messageId: 'noAwait' }],
    },
    {
      code: `async function drain(source) { for await (const chunk of source) { use(chunk); } }`,
      errors: [{ messageId: 'noAsync' }, { messageId: 'noForAwait' }],
    },
    {
      code: `export const Basic = { render: async () => { await tick(); } };`,
      errors: [{ messageId: 'noAsync' }, { messageId: 'noAwait' }],
    },
  ],
});
