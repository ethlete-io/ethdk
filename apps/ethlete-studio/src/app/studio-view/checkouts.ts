import { DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { injectNotificationManager } from '@ethlete/components';
import { EMPTY, Observable, catchError, concat, finalize, last, of, switchMap, tap } from 'rxjs';
import {
  DesignRoots,
  designOpenRequests$,
  designRoots$,
  designRootsAdd$,
  designRootsForget$,
  designRootsSearch$,
  designScan$,
} from '../../host/design';
import { pickFolder$ } from '../../host/dialog';
import { workspaceRoot$ } from '../../host/workspace';
import { SCAN_CHECKOUTS_LABELS, OPEN_FOLDER_LABELS } from '../i18n/shell-labels';

export const folderNameOf = (path: string) => path.split(/[\\/]/).filter(Boolean).pop() ?? path;

export const parentFolderOf = (path: string) => path.replace(/[\\/]+[^\\/]*[\\/]*$/, '');

const NONE: DesignRoots = { search: '', roots: [] };

export type CheckoutsOptions = {
  /** The checkout the window showed last. It wins over the first kept one when Studio still keeps it. */
  remembered: string;
  pick: (checkout: string) => void;
  openRequests$?: Observable<string>;
};

/** Keeps the list of checkouts and the picked one. Call it in an injection context. */
export const createCheckouts = ({ remembered, pick, openRequests$ = designOpenRequests$() }: CheckoutsOptions) => {
  const destroyRef = inject(DestroyRef);
  const notifications = injectNotificationManager();
  const held = signal<DesignRoots>(NONE);
  const current = signal('');
  const adding = signal(false);

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

  const keep = (folder: string) => {
    adding.set(true);

    return designRootsAdd$(folder).pipe(
      tap((roots) => {
        held.set(roots);
        choose(folder);
      }),
      finalize(() => adding.set(false)),
    );
  };

  const keepTheHostCheckout = () =>
    workspaceRoot$().pipe(
      switchMap((root) => (root ? designRootsAdd$(root) : of(NONE))),
      // eslint-disable-next-line ethlete/no-silent-catch-error -- adding the host checkout is best effort; the checkout list stays empty
      catchError(() => of(NONE)),
    );

  designRoots$()
    .pipe(
      // eslint-disable-next-line ethlete/no-silent-catch-error -- an unreadable roots list falls back to the host checkout path
      catchError(() => of(NONE)),
      switchMap((roots) => (roots.roots.length ? of(roots) : keepTheHostCheckout())),
      tap((roots) => settle(roots)),
      takeUntilDestroyed(destroyRef),
    )
    .subscribe();

  openRequests$
    .pipe(
      switchMap((checkout) =>
        designRoots$().pipe(
          tap((roots) => {
            held.set(roots);
            choose(checkout);
          }),
          // eslint-disable-next-line ethlete/no-silent-catch-error -- a failed read leaves the list and the shown checkout as they were
          catchError(() => EMPTY),
        ),
      ),
      // eslint-disable-next-line ethlete/no-silent-catch-error -- outside the host shell there is no agent to ask for a checkout
      catchError(() => EMPTY),
      takeUntilDestroyed(destroyRef),
    )
    .subscribe();

  return {
    current: current.asReadonly(),
    adding: adding.asReadonly(),
    names: computed(() => held().roots.map(folderNameOf)),
    roots: computed(() => held().roots),
    chooseByName: (nameOrPath: string) => {
      const checkout = held().roots.find((root) => root === nameOrPath || folderNameOf(root) === nameOrPath);

      if (checkout) choose(checkout);
    },
    /** Keeps every checkout with design work below the search folder, the folder next to the shown checkout until one is named. */
    scan: () => {
      const named = held().search;
      const folder = named || parentFolderOf(current());

      if (!folder || adding()) return;

      adding.set(true);

      (named ? of(held()) : designRootsSearch$(folder))
        .pipe(
          switchMap(() => designScan$(folder)),
          switchMap((found) => {
            const fresh = found.filter((checkout) => !held().roots.includes(checkout));

            if (!fresh.length) return of(0);

            return concat(...fresh.map((checkout) => designRootsAdd$(checkout))).pipe(
              last(),
              tap((roots) => held.set(roots)),
              switchMap(() => of(fresh.length)),
            );
          }),
          tap((count) =>
            notifications.open({
              status: 'success',
              title: count ? SCAN_CHECKOUTS_LABELS.found(count) : SCAN_CHECKOUTS_LABELS.none,
            }),
          ),
          // eslint-disable-next-line ethlete/no-silent-catch-error -- the user is already notified with the failure title; the cause adds nothing
          catchError(() => {
            notifications.open({ status: 'error', title: SCAN_CHECKOUTS_LABELS.failedTitle });

            return EMPTY;
          }),
          finalize(() => adding.set(false)),
          takeUntilDestroyed(destroyRef),
        )
        .subscribe();
    },
    /** Stops keeping the shown checkout and shows the first one left. Does nothing while only one is kept. */
    forget: () => {
      const checkout = current();

      if (!checkout || held().roots.length < 2) return;

      designRootsForget$(checkout)
        .pipe(
          tap((roots) => {
            held.set(roots);
            choose(roots.roots[0] ?? '');
          }),
          // eslint-disable-next-line ethlete/no-silent-catch-error -- the kept list stays as it was; the menu shows the checkout unchanged
          catchError(() => EMPTY),
          takeUntilDestroyed(destroyRef),
        )
        .subscribe();
    },
    /** Opens the OS folder dialog; a folder with design work is kept and becomes the checkout. */
    openFolder: () => {
      pickFolder$()
        .pipe(
          switchMap((folder) => (folder ? keep(folder) : EMPTY)),
          // eslint-disable-next-line ethlete/no-silent-catch-error -- the user is already notified with the refusal message; the cause adds nothing
          catchError(() => {
            notifications.open({
              status: 'error',
              title: OPEN_FOLDER_LABELS.refusedTitle,
              message: OPEN_FOLDER_LABELS.refusedMessage,
            });

            return EMPTY;
          }),
          takeUntilDestroyed(destroyRef),
        )
        .subscribe();
    },
  };
};

export type Checkouts = ReturnType<typeof createCheckouts>;
