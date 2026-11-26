import { open } from '@tauri-apps/plugin-dialog';
import { Observable } from 'rxjs';
import { hostOnly$ } from './invoke';

/** Opens the OS folder dialog and emits the picked folder, or `null` when the user cancels. */
export const pickFolder$ = (): Observable<string | null> => hostOnly$(() => open({ directory: true }));
