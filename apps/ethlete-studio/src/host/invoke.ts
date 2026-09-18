import { invoke, InvokeArgs } from '@tauri-apps/api/core';
import { defer, from, Observable, throwError } from 'rxjs';

const SHELL_MISSING =
  'This window is not running inside the Ethlete Studio desktop shell, so no host command is reachable. Start it with `yarn studio`.';

/**
 * Thrown when the call never reached a host at all, which is a different answer from a host that
 * refused.
 */
export class HostShellMissingError extends Error {
  constructor() {
    super(SHELL_MISSING);
    this.name = 'HostShellMissingError';
  }
}

/** Whether this window runs inside the desktop shell, so a host command can reach a host at all. */
export const hasHostShell = () => '__TAURI_INTERNALS__' in globalThis;

/**
 * Wraps a call into the desktop shell as a cold Observable, so nothing runs until somebody
 * subscribes and a browser without the shell fails with a readable message rather than a crash.
 */
export const hostOnly$ = <T>(act: () => Promise<T>): Observable<T> =>
  defer(() => (hasHostShell() ? from(act()) : throwError(() => new HostShellMissingError())));

/** Wraps a Tauri command as a cold Observable. */
export const invokeHost$ = <T>(command: string, args?: InvokeArgs): Observable<T> =>
  hostOnly$(() => invoke<T>(command, args));
