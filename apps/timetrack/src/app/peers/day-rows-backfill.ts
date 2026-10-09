import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import {
  DayBoundary,
  PEER_DAY_ROWS_BACKFILL_DAYS,
  dayBoundaryOf,
  ledgerEntriesForRange$,
  localDayKey,
  localDayRange,
  peerDayRowsToBackfill,
  shiftDayKey,
} from '@ethlete/timetrack';
import {
  EMPTY,
  Observable,
  catchError,
  concat,
  concatMap,
  defer,
  exhaustMap,
  filter,
  forkJoin,
  from,
  ignoreElements,
  map,
  of,
  scan,
  switchMap,
  take,
  timer,
} from 'rxjs';
import { injectHostPorts } from '../../host';
import { injectAgentDay } from '../agent/agent-day';
import { injectTimetrackSettings } from '../settings/settings';
import { injectPeers } from './peers';

const PACE_MS = 2_000;

const DAY_ROWS_BACKFILL_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const ports = injectHostPorts();
  const settings = injectTimetrackSettings();
  const peers = injectPeers();
  const agentDay = injectAgentDay();

  const bookedDays$ = (days: readonly string[], boundary: DayBoundary): Observable<string[]> =>
    forkJoin(
      days.map((day) =>
        ledgerEntriesForRange$({ ledger: ports.ledger, day, boundary }).pipe(
          take(1),
          map((entries) => (entries.length > 0 ? [day] : [])),
          catchError(() => of([])),
        ),
      ),
    ).pipe(map((booked) => booked.flat()));

  const run$ = defer(() => {
    const boundary = dayBoundaryOf(settings.settings());
    const today = localDayKey(new Date(), boundary);
    const days = Array.from({ length: PEER_DAY_ROWS_BACKFILL_DAYS }, (_, index) => shiftDayKey(today, -(index + 1)));
    const oldest = days[days.length - 1] ?? today;

    return forkJoin({
      booked: bookedDays$(days, boundary),
      stored: ports.peers.ownDayRowsFrom$(localDayRange(oldest, boundary).from).pipe(take(1)),
    });
  }).pipe(
    concatMap(({ booked, stored }) => from(peerDayRowsToBackfill({ bookedDays: booked, stored }))),
    concatMap((day) =>
      concat(
        agentDay.sendDayRows$(day).pipe(
          take(1),
          catchError(() => EMPTY),
        ),
        timer(PACE_MS),
      ).pipe(ignoreElements()),
    ),
    catchError(() => EMPTY),
  );

  const machinePaired$ = toObservable(peers.paired).pipe(
    scan(
      (state, machines) => ({
        seen: new Set([...state.seen, ...machines.map((machine) => machine.machineId)]),
        fresh: machines.some((machine) => !state.seen.has(machine.machineId)),
      }),
      { seen: new Set<string>(), fresh: false },
    ),
    filter((state) => state.fresh),
  );

  settings.ready$
    .pipe(
      switchMap(() => machinePaired$),
      exhaustMap(() => run$),
      takeUntilDestroyed(),
    )
    .subscribe();

  return {};
});

export const injectDayRowsBackfill = /* @__PURE__ */ toInjectFn(DAY_ROWS_BACKFILL_DEF);
