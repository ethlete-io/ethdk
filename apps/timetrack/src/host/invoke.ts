import { invoke, InvokeArgs } from '@tauri-apps/api/core';
import { Observable, defer, from, throwError } from 'rxjs';

const SHELL_MISSING =
  'This window is not running inside the Timetrack desktop shell, so no host command is reachable. Start it with `yarn timetrack`.';

/**
 * Wraps a call into the desktop shell as a cold Observable, so nothing runs until somebody
 * subscribes and a browser without the shell fails with a readable message rather than a crash.
 *
 * Unsubscribing stops the notification, not the call — the host has no way to recall a request that
 * is already in flight, so a write that was unsubscribed from may still have happened.
 */
export const hostOnly$ = <T>(act: () => Promise<T>): Observable<T> =>
  defer(() => ('__TAURI_INTERNALS__' in globalThis ? from(act()) : throwError(() => new Error(SHELL_MISSING))));

/** Wraps a Tauri command as a cold Observable. */
export const invokeHost$ = <T>(command: string, args?: InvokeArgs): Observable<T> =>
  hostOnly$(() => invoke<T>(command, args));
