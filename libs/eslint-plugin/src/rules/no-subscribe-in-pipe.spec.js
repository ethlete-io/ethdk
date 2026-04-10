// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const rule = require('./no-subscribe-in-pipe');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

tester.run('no-subscribe-in-pipe', rule, {
  valid: [
    // subscribe() is outside pipe — fine
    { code: `obs$.pipe(map(x => x)).subscribe();` },
    // switchMap composition — fine
    { code: `obs$.pipe(switchMap(() => other$)).subscribe();` },
    // subscribe inside new Observable() — exempt boundary
    { code: `obs$.pipe(tap(() => {})).subscribe();` },
    {
      code: `obs$.pipe(tap(() => {
        const o = new Observable(sub => { inner$.subscribe(sub); });
      })).subscribe();`,
    },
  ],
  invalid: [
    {
      code: `obs$.pipe(tap(() => { inner$.subscribe(); })).subscribe();`,
      errors: [{ messageId: 'noSubscribeInPipe' }],
    },
    {
      code: `obs$.pipe(mergeMap(() => { side$.subscribe(); return of(1); })).subscribe();`,
      errors: [{ messageId: 'noSubscribeInPipe' }],
    },
    {
      code: `obs$.pipe(take(1), tap(() => other$.subscribe())).subscribe();`,
      errors: [{ messageId: 'noSubscribeInPipe' }],
    },
  ],
});
