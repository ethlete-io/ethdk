import { DestroyRef, assertInInjectionContext, inject } from '@angular/core';
import { Subject } from 'rxjs';

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
