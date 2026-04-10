// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const rule = require('./no-rxjs-in-effect');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

tester.run('no-rxjs-in-effect', rule, {
  valid: [
    // subscribe outside effect/computed
    { code: `obs$.subscribe();` },
    { code: `obs$.pipe(map(x => x)).subscribe();` },
    // effect with signal reads only
    { code: `effect(() => { this.count(); });` },
    // subscribe in a plain method, not effect
    { code: `class Foo { doWork() { this.obs$.subscribe(); } }` },
    // computed without subscribe
    { code: `computed(() => this.items().length);` },
  ],
  invalid: [
    {
      code: `effect(() => { this.obs$.subscribe(); });`,
      errors: [{ messageId: 'noSubscribeInEffect', data: { context: 'effect' } }],
    },
    {
      code: `effect(() => { obs.pipe(map(x => x)).subscribe(); });`,
      errors: [{ messageId: 'noSubscribeInEffect', data: { context: 'effect' } }],
    },
    {
      code: `computed(() => { obs$.subscribe(); return 1; });`,
      errors: [{ messageId: 'noSubscribeInEffect', data: { context: 'computed' } }],
    },
  ],
});
