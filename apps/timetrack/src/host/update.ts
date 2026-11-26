import { Observable } from 'rxjs';
import { invokeHost$ } from './invoke';

/** Downloads a newer release, if there is one, and emits its version. A debug build emits `null`. */
export const updateReady$ = (): Observable<string | null> => invokeHost$<string | null>('update_ready');

/** Installs the release `updateReady$` downloaded and restarts the app into it. */
export const updateInstall$ = (): Observable<void> => invokeHost$<void>('update_install');
