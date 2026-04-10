// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const rule = require('./no-subscribe-with-body');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

tester.run('no-subscribe-with-body', rule, {
  valid: [
    // Empty subscribe call — fine
    { code: `obs$.subscribe();` },
    // Empty arrow body
    { code: `obs$.subscribe(() => {});` },
    // Patterns not using subscribe
    { code: `obs$.pipe(tap(v => console.log(v))).subscribe();` },
    // Non-RxJS subscribe with string event name (e.g. Facebook SDK)
    { code: `player.subscribe('startedPlaying', () => { doSomething(); });` },
    { code: `player.subscribe('paused', () => { state.update(s => ({ ...s, isPlaying: false })); });` },
  ],
  invalid: [
    {
      // Concise arrow — non-empty expression body
      code: `obs$.subscribe(res => console.log(res));`,
      errors: [{ messageId: 'noSubscribeBody' }],
    },
    {
      // Block arrow with statements
      code: `obs$.subscribe(res => { doSomething(res); });`,
      errors: [{ messageId: 'noSubscribeBody' }],
    },
    {
      // Function expression with body
      code: `obs$.subscribe(function(res) { doSomething(res); });`,
      errors: [{ messageId: 'noSubscribeBody' }],
    },
    {
      // Observer object with non-empty next handler
      code: `obs$.subscribe({ next: res => doSomething(res) });`,
      errors: [{ messageId: 'noSubscribeBody' }],
    },
    {
      code: `obs$.subscribe({ next: res => { this.data = res; } });`,
      errors: [{ messageId: 'noSubscribeBody' }],
    },
  ],
});
