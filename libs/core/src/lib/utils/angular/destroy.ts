import { DestroyRef, assertInInjectionContext, inject } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * @deprecated Use `takeUntilDestroyed()` from `@angular/core/rxjs-interop`. `yarn nx g @ethlete/core:migrate-create-destroy` rewrites the common pattern.
 */
export const createDestroy = () => {
  assertInInjectionContext(createDestroy);

  const destroy$ = new Subject<boolean>();

  const ref = inject(DestroyRef);

  ref.onDestroy(() => {
    destroy$.next(true);
    destroy$.complete();
  });

  return destroy$.asObservable();
};
