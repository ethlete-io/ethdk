import { DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, of, switchMap, tap } from 'rxjs';
import { DesignRoots, designRoots$, designRootsAdd$ } from '../../host/design';
import { pickFolder$ } from '../../host/dialog';
import { workspaceRoot$ } from '../../host/workspace';

export const folderNameOf = (path: string) => path.split(/[\\/]/).filter(Boolean).pop() ?? path;

const NONE: DesignRoots = { search: '', roots: [] };

export type CheckoutsOptions = {
  /** The checkout the window showed last. It wins over the first kept one when Studio still keeps it. */
  remembered: string;
  pick: (checkout: string) => void;
};

/** Keeps the list of checkouts and the picked one. Call it in an injection context. */
export const createCheckouts = ({ remembered, pick }: CheckoutsOptions) => {
  const destroyRef = inject(DestroyRef);
  const held = signal<DesignRoots>(NONE);
  const current = signal('');

  const choose = (checkout: string) => {
    if (!checkout || checkout === current()) return;

    current.set(checkout);
    pick(checkout);
  };

  const settle = (roots: DesignRoots) => {
    held.set(roots);

    if (roots.roots.includes(current())) return;

    choose(roots.roots.includes(remembered) ? remembered : (roots.roots[0] ?? ''));
  };

  const keep = (folder: string) =>
    designRootsAdd$(folder).pipe(
      tap((roots) => {
        held.set(roots);
        choose(folder);
      }),
    );

  const keepTheHostCheckout = () =>
    workspaceRoot$().pipe(
      switchMap((root) => (root ? designRootsAdd$(root) : of(NONE))),
      catchError(() => of(NONE)),
    );

  designRoots$()
    .pipe(
      catchError(() => of(NONE)),
      switchMap((roots) => (roots.roots.length ? of(roots) : keepTheHostCheckout())),
      tap((roots) => settle(roots)),
      takeUntilDestroyed(destroyRef),
    )
    .subscribe();

  return {
    current: current.asReadonly(),
    names: computed(() => held().roots.map(folderNameOf)),
    chooseByName: (name: string) => {
      const checkout = held().roots.find((root) => folderNameOf(root) === name);

      if (checkout) choose(checkout);
    },
    /** Opens the OS folder dialog; a folder with design work is kept and becomes the checkout. */
    openFolder: () => {
      pickFolder$()
        .pipe(
          switchMap((folder) => (folder ? keep(folder) : EMPTY)),
          catchError(() => EMPTY),
          takeUntilDestroyed(destroyRef),
        )
        .subscribe();
    },
  };
};

export type Checkouts = ReturnType<typeof createCheckouts>;
