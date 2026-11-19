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
  map,
  switchMap,
  take,
} from 'rxjs';
import { HostReceivedSettings } from '../../host';

const SEND_DEBOUNCE_MS = 2_000;

/** Sends the rules and stand-ins once a change settles; an unchanged set is not sent again. */
export const sendSharedSettings$ = (options: {
  settings$: Observable<TimetrackSettings>;
  ownKeys$: () => Observable<CheckoutKeys>;
  send$: (entries: readonly SharedSettingsEntry[]) => Observable<void>;
  debounceMs?: number;
}): Observable<void> =>
  options.settings$.pipe(
    debounceTime(options.debounceMs ?? SEND_DEBOUNCE_MS),
    switchMap((settings) =>
      options.ownKeys$().pipe(
        take(1),
        map((ownKeys) => sharedSettingsEntriesOf({ settings, ownKeys })),
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
