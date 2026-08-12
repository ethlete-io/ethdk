import { invoke, InvokeArgs } from '@tauri-apps/api/core';
import { Observable, defer, from, throwError } from 'rxjs';

const SHELL_MISSING =
  'This window is not running inside the Timetrack desktop shell, so no host command is reachable. Start it with `yarn timetrack`.';

/**
 * Wraps a Tauri command as a cold Observable, so nothing is sent until somebody subscribes.
 *
 * Unsubscribing stops the notification, not the command — the host has no way to recall a request
 * that is already in flight, so a write that was unsubscribed from may still have happened.
 */
export const invokeHost$ = <T>(command: string, args?: InvokeArgs): Observable<T> =>
  defer(() =>
    '__TAURI_INTERNALS__' in window ? from(invoke<T>(command, args)) : throwError(() => new Error(SHELL_MISSING)),
  );
