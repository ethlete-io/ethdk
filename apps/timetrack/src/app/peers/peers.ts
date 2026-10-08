import { computed, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import {
  EMPTY,
  Observable,
  Subject,
  catchError,
  defer,
  exhaustMap,
  finalize,
  map,
  merge,
  of,
  switchMap,
  tap,
  timer,
} from 'rxjs';
import { PairTarget, PairedMachine, PairingOffer, injectHostPorts } from '../../host';
import { connectedMachines } from './peer-status';

const POLL_MS = 30_000;

const messageOf = (error: unknown) => {
  const text = error instanceof Error ? error.message : String(error);

  return text.charAt(0).toUpperCase() + text.slice(1);
};

const PEERS_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const ports = injectHostPorts();
  const refresh$ = new Subject<void>();
  const actions$ = new Subject<Observable<unknown>>();

  const busy = signal(false);
  const failure = signal<{ heading: string; message: string } | null>(null);
  const offer = signal<PairingOffer | null>(null);
  const justPaired = signal<string | null>(null);

  const read = toSignal(
    merge(timer(0, POLL_MS), refresh$).pipe(
      switchMap(() =>
        ports.peers.list$().pipe(
          map((machines) => ({ machines, atMs: Date.now() })),
          catchError(() => EMPTY),
        ),
      ),
    ),
    { initialValue: { machines: [] as PairedMachine[], atMs: Date.now() } },
  );

  const started = (heading: string, work$: Observable<unknown>) =>
    defer(() => {
      busy.set(true);
      failure.set(null);
      justPaired.set(null);

      return work$.pipe(
        catchError((error: unknown) => {
          failure.set({ heading, message: messageOf(error) });

          return EMPTY;
        }),
        finalize(() => busy.set(false)),
      );
    });

  actions$
    .pipe(
      exhaustMap((action$) => action$),
      takeUntilDestroyed(),
    )
    .subscribe();

  const accept$ = (target: PairTarget, code: string) =>
    ports.peers.accept$(target, code).pipe(
      tap((paired) => justPaired.set(paired.label)),
      switchMap((paired) => ports.peers.hello$(paired.machineId).pipe(catchError(() => of(null)))),
      tap(() => refresh$.next()),
    );

  return {
    paired: computed(() => read().machines),
    connected: computed(() => connectedMachines(read().machines, read().atMs)),
    readAtMs: computed(() => read().atMs),
    busy: busy.asReadonly(),
    failure: failure.asReadonly(),
    offer: offer.asReadonly(),
    justPaired: justPaired.asReadonly(),

    showCode: () =>
      actions$.next(started('No code could be shown', ports.peers.offer$().pipe(tap((opened) => offer.set(opened))))),
    hideCode: () => offer.set(null),
    pair: (target: PairTarget, code: string) =>
      actions$.next(started('The machine could not be paired', accept$(target, code))),
    forget: (machineId: string) =>
      actions$.next(
        started('The machine could not be forgotten', ports.peers.forget$(machineId).pipe(tap(() => refresh$.next()))),
      ),
    rename: (machineId: string, name: string) =>
      actions$.next(
        started(
          'The machine could not be renamed',
          ports.peers.rename$(machineId, name).pipe(tap(() => refresh$.next())),
        ),
      ),
    refresh: () => refresh$.next(),
  };
});

export const injectPeers = /* @__PURE__ */ toInjectFn(PEERS_DEF);
