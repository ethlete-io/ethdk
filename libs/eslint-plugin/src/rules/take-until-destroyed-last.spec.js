// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const rule = require('./take-until-destroyed-last');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

tester.run('take-until-destroyed-last', rule, {
  valid: [
    {
      code: `import { takeUntilDestroyed } from 'some-other-lib';
a$.pipe(takeUntilDestroyed(), map((x) => x));`,
    },
    { code: `obs$.pipe(takeUntilDestroyed()).subscribe();` },
    { code: `obs$.pipe(map(x => x), takeUntilDestroyed(this.destroyRef)).subscribe();` },
    { code: `obs$.pipe(switchMap(() => fromEvent(el, 'scroll')), takeUntilDestroyed()).subscribe();` },
    { code: `obs$.pipe(takeUntil(destroy$), switchMap(() => other$)).subscribe();` },
    { code: `obs$.pipe(switchMap(() => inner$.pipe(takeUntilDestroyed())), takeUntilDestroyed()).subscribe();` },
    { code: `obs$.pipe(map(x => x), shareReplay(1));` },
  ],
  invalid: [
    {
      code: `import { takeUntilDestroyed as untilDestroyed } from '@angular/core/rxjs-interop';
a$.pipe(untilDestroyed(), map((x) => x));`,
      errors: [{ messageId: 'takeUntilDestroyedLast' }],
    },
    {
      code: `obs$.pipe(takeUntilDestroyed(), switchMap(() => fromEvent(el, 'scroll'))).subscribe();`,
      errors: [{ messageId: 'takeUntilDestroyedLast' }],
    },
    {
      code: `obs$.pipe(map(x => x), takeUntilDestroyed(this.destroyRef), shareReplay(1));`,
      errors: [{ messageId: 'takeUntilDestroyedLast' }],
    },
    {
      code: `obs$.pipe(takeUntilDestroyed(), tap(() => {}), takeUntilDestroyed()).subscribe();`,
      errors: [{ messageId: 'takeUntilDestroyedLast', column: 11 }],
    },
    {
      code: `obs$.pipe(switchMap(() => inner$.pipe(takeUntilDestroyed(), tap(() => {}))), takeUntilDestroyed()).subscribe();`,
      errors: [{ messageId: 'takeUntilDestroyedLast' }],
    },
  ],
});
