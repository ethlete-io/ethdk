import { signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, switchMap, tap, timer } from 'rxjs';
import { QUERY_DEVTOOLS_COPIED_RESET_MS } from './query-devtools-types';

/**
 * A copy confirmation that falls back to `idle` once {@link QUERY_DEVTOOLS_COPIED_RESET_MS} pass; each
 * `mark` restarts the countdown. Create it in an injection context.
 */
export const createQueryDevtoolsCopiedTick = <T>(idle: T) => {
  const value = signal<T>(idle);
  const reset$ = new Subject<void>();

  reset$
    .pipe(
      switchMap(() => timer(QUERY_DEVTOOLS_COPIED_RESET_MS)),
      tap(() => value.set(idle)),
      takeUntilDestroyed(),
    )
    .subscribe();

  return {
    value: value.asReadonly(),
    mark: (next: T) => {
      value.set(next);
      reset$.next();
    },
    clear: () => value.set(idle),
  };
};

export type QueryDevtoolsCopiedTick<T> = ReturnType<typeof createQueryDevtoolsCopiedTick<T>>;
