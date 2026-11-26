import { getVersion } from '@tauri-apps/api/app';
import { Observable } from 'rxjs';
import { hostOnly$, invokeHost$ } from './invoke';

/** Emits the version of the running Studio build. */
export const studioVersion$ = (): Observable<string> => hostOnly$(() => getVersion());

/** Opens the Studio docs in the system browser. */
export const openHelp$ = (): Observable<void> => invokeHost$<void>('help_open');
