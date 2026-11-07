import { DestroyRef, computed, inject, linkedSignal, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, finalize, map, of, switchMap, tap } from 'rxjs';
import { ProductAddress } from '../../host/design';
import { ListedException, approveException$, listedExceptions$ } from '../../host/design-exceptions';
import { INVENTORY_APPROVER } from './inventory';

type Reading = { exceptions: ListedException[]; error: string | null };

const NONE: Reading = { exceptions: [], error: null };

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Lists the design exceptions of the product at `address` anew on each change of it, and approves one as the
 * designer. Call it in an injection context.
 */
export const createExceptionStore = (address: () => (ProductAddress & { revision: number }) | null) => {
  const destroyRef = inject(DestroyRef);
  const reading = toSignal(
    toObservable(computed(address)).pipe(
      switchMap((shown) =>
        shown
          ? listedExceptions$(shown).pipe(
              map((exceptions): Reading => ({ exceptions, error: null })),
              catchError((error: unknown) => of<Reading>({ exceptions: [], error: messageOf(error) })),
            )
          : of(NONE),
      ),
    ),
    { initialValue: NONE },
  );
  const exceptions = linkedSignal(() => reading().exceptions);
  const approveError = linkedSignal<Reading, string | null>({ source: reading, computation: () => null });
  const busy = signal<string | null>(null);

  const approve = (key: string) => {
    const shown = address();

    if (!shown || busy() !== null) return;

    busy.set(key);
    approveError.set(null);
    approveException$(shown, { key, by: INVENTORY_APPROVER })
      .pipe(
        tap((approved) =>
          exceptions.update((listed) =>
            listed.map((exception) =>
              exception.key === key ? { ...exception, state: 'approved', approval: approved.approval } : exception,
            ),
          ),
        ),
        catchError((error: unknown) => {
          approveError.set(messageOf(error));

          return EMPTY;
        }),
        finalize(() => busy.set(null)),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe();
  };

  return {
    listed: exceptions.asReadonly(),
    error: computed(() => approveError() ?? reading().error),
    approve,
  };
};
