// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const tsParser = require('@typescript-eslint/parser');
const rule = require('./no-rxjs-in-effect');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module', parser: tsParser },
});

tester.run('no-rxjs-in-effect', rule, {
  valid: [
    { code: `effect(() => { this.player.subscribe('paused', () => {}); });` },
    {
      code: `import { effect } from 'some-other-lib';
effect(() => { store.subscribe(cb); });`,
    },
    {
      code: `const effect = (fn) => fn();
effect(() => { store.subscribe(cb); });`,
    },
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
      code: `afterRenderEffect(() => { this.obs$.subscribe(); });`,
      errors: [{ messageId: 'noSubscribeInEffect', data: { context: 'afterRenderEffect' } }],
    },
    {
      code: `linkedSignal(() => { this.obs$.subscribe(); return 1; });`,
      errors: [{ messageId: 'noSubscribeInEffect', data: { context: 'linkedSignal' } }],
    },
    {
      code: `import { effect as ngEffect } from '@angular/core';
ngEffect(() => { obs$.subscribe(); });`,
      errors: [{ messageId: 'noSubscribeInEffect' }],
    },
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
