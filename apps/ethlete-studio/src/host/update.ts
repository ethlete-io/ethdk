import { Observable } from 'rxjs';
import { invokeHost$ } from './invoke';

/** Downloads a newer release, if there is one, and emits its version. A debug build emits `null`. */
export const updateReady$ = (): Observable<string | null> => invokeHost$<string | null>('update_ready');

/** Quits Studio, installs the release `updateReady$` downloaded, and starts it again. */
export const restartForUpdate$ = (): Observable<void> => invokeHost$<void>('update_restart');
