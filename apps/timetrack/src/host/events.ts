import { emit, listen } from '@tauri-apps/api/event';
import { EMPTY, Observable } from 'rxjs';
import { hostOnly$ } from './invoke';

/** What the tray asks for when its timer entry is picked. Matches `TIMER_TOGGLE_EVENT` in `tray.rs`. */
export const TIMER_TOGGLE_EVENT = 'timer-toggle';

/** The tray's pause entry. Matches `COLLECTION_PAUSE_TOGGLE_EVENT` in `tray.rs`. */
export const COLLECTION_PAUSE_TOGGLE_EVENT = 'collection-pause-toggle';

/**
 * One request an agent's CLI made of this machine, handed over by the loopback endpoint. Matches
 * `REQUEST_EVENT` in `agent.rs`, which addresses the main window alone.
 */
export const AGENT_REQUEST_EVENT = 'agent-request';

/**
 * An event the host emits, as a cold Observable that unlistens when the last subscriber leaves.
 *
 * Outside the desktop shell this is silent rather than an error: a story or a browser tab has no host
 * to hear from, and nothing that listens for a host event has anything to fall back to.
 */
export const hostEvent$ = (event: string): Observable<void> =>
  new Observable<void>((subscriber) => {
    if (!('__TAURI_INTERNALS__' in globalThis)) return EMPTY.subscribe(subscriber);

    const unlisten = listen(event, () => subscriber.next());

    return () => void unlisten.then((stop) => stop());
  });

/** The same, for an event that carries a document. Silent outside the shell, for the same reason. */
export const hostEventWith$ = <T>(event: string): Observable<T> =>
  new Observable<T>((subscriber) => {
    if (!('__TAURI_INTERNALS__' in globalThis)) return EMPTY.subscribe(subscriber);

    const unlisten = listen<T>(event, (received) => subscriber.next(received.payload));

    return () => void unlisten.then((stop) => stop());
  });

/**
 * Sends an event to every window of this app, including the one that sent it.
 *
 * It is how one window tells another what it has computed, which is cheaper and simpler than a store
 * both of them read: the app window already reconstructs the day, and nothing else needs to.
 */
export const emitHostEvent$ = <T>(event: string, payload: T): Observable<void> => hostOnly$(() => emit(event, payload));
