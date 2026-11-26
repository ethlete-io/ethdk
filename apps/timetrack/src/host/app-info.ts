import { getVersion } from '@tauri-apps/api/app';
import { Observable } from 'rxjs';
import { hostOnly$ } from './invoke';

/** The version of the running shell, which is the one in `tauri.conf.json`. */
export const appVersion$ = (): Observable<string> => hostOnly$(() => getVersion());
