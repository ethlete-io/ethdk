// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const tsParser = require('@typescript-eslint/parser');
const rule = require('./no-subscribe-in-pipe');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module', parser: tsParser },
});

tester.run('no-subscribe-in-pipe', rule, {
  valid: [
    {
      code: `import { Observable as Obs } from 'rxjs';
source$.pipe(switchMap(() => new Obs((subscriber) => inner$.subscribe(subscriber))));`,
    },
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
    { code: `defer(() => { trigger$.subscribe(); return source$; }).pipe(take(1));` },
    { code: `obs$.pipe(map(() => 1)).subscribe(() => other$.subscribe());` },
    { code: `obs$.pipe(takeUntil(stop$)).subscribe();` },
  ],
  invalid: [
    {
      code: `obs$.pipe(tap(function () { other$.subscribe(); }));`,
      errors: [{ messageId: 'noSubscribeInPipe' }],
    },
    {
      code: `obs$.pipe(tap(() => other$?.subscribe()));`,
      errors: [{ messageId: 'noSubscribeInPipe' }],
    },
    {
      code: `defer(() => source$).pipe(tap(() => other$.subscribe()));`,
      errors: [{ messageId: 'noSubscribeInPipe' }],
    },
    {
      code: `obs$.pipe(map((x) => x)).pipe(switchMap(() => { other$.subscribe(); return of(1); }));`,
      errors: [{ messageId: 'noSubscribeInPipe' }],
    },
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
