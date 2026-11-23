import {
  CheckoutKeys,
  PeerSharedSettings,
  SharedSettingsEntry,
  TimetrackSettings,
  encodeSharedSettings,
  sharedSettingsEntriesOf,
} from '@ethlete/timetrack';
import {
  EMPTY,
  Observable,
  catchError,
  concatMap,
  debounceTime,
  distinctUntilChanged,
  exhaustMap,
  forkJoin,
  map,
  of,
  switchMap,
  take,
} from 'rxjs';
import { HostReceivedSettings } from '../../host';

const SEND_DEBOUNCE_MS = 2_000;

/** Sends the rules and stand-ins once a change settles; an unchanged set is not sent again. */
export const sendSharedSettings$ = (options: {
  settings$: Observable<TimetrackSettings>;
  ownKeys$: () => Observable<CheckoutKeys>;
  carriedPaths$?: () => Observable<readonly string[]>;
  send$: (entries: readonly SharedSettingsEntry[]) => Observable<void>;
  debounceMs?: number;
}): Observable<void> =>
  options.settings$.pipe(
    debounceTime(options.debounceMs ?? SEND_DEBOUNCE_MS),
    switchMap((settings) =>
      forkJoin([
        options.ownKeys$().pipe(take(1)),
        (options.carriedPaths$?.() ?? of([])).pipe(
          take(1),
          catchError(() => of([])),
        ),
      ]).pipe(
        map(([ownKeys, carriedPaths]) => sharedSettingsEntriesOf({ settings, ownKeys, carriedPaths })),
        catchError(() => EMPTY),
      ),
    ),
    distinctUntilChanged((left, right) => encodeSharedSettings(left) === encodeSharedSettings(right)),
    concatMap((entries) =>
      options.send$(entries).pipe(
        take(1),
        catchError(() => EMPTY),
      ),
    ),
  );

/** On each tick, hands what the paired machines last sent to `merge`. */
export const receiveSharedSettings$ = (options: {
  tick$: Observable<unknown>;
  received$: () => Observable<HostReceivedSettings>;
  merge: (peers: readonly PeerSharedSettings[]) => void;
}): Observable<void> =>
  options.tick$.pipe(
    exhaustMap(() =>
      options.received$().pipe(
        take(1),
        catchError(() => EMPTY),
      ),
    ),
    map((received) => {
      if (received.peers.length) options.merge(received.peers);
    }),
  );
