import { listen } from '@tauri-apps/api/event';
import { EMPTY, Observable } from 'rxjs';

/** What the tray asks for when its timer entry is picked. Matches `TIMER_TOGGLE_EVENT` in `tray.rs`. */
export const TIMER_TOGGLE_EVENT = 'timer-toggle';

/** The tray's pause entry. Matches `COLLECTION_PAUSE_TOGGLE_EVENT` in `tray.rs`. */
export const COLLECTION_PAUSE_TOGGLE_EVENT = 'collection-pause-toggle';

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
