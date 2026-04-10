// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const rule = require('./prefer-rxjs-timer');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

tester.run('prefer-rxjs-timer', rule, {
  valid: [
    // RxJS alternatives — fine
    { code: `timer(500).pipe(takeUntilDestroyed()).subscribe();` },
    { code: `interval(2000).pipe(takeUntilDestroyed()).subscribe();` },
    { code: `fromEvent(el, 'click').pipe(takeUntilDestroyed()).subscribe();` },
    // Unrelated calls
    { code: `Math.random();` },
    { code: `Promise.resolve();` },
  ],
  invalid: [
    {
      code: `setTimeout(() => this.refresh(), 500);`,
      errors: [{ messageId: 'preferTimer' }],
    },
    {
      code: `setInterval(() => this.poll(), 2000);`,
      errors: [{ messageId: 'preferInterval' }],
    },
    {
      code: `clearTimeout(handle);`,
      errors: [{ messageId: 'preferUnsubscribe' }],
    },
    {
      code: `clearInterval(handle);`,
      errors: [{ messageId: 'preferUnsubscribe' }],
    },
    {
      code: `el.addEventListener('click', handler);`,
      errors: [{ messageId: 'preferFromEvent' }],
    },
    {
      code: `el.removeEventListener('click', handler);`,
      errors: [{ messageId: 'preferFromEventRemove' }],
    },
  ],
});
