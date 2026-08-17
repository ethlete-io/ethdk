import { Observable } from 'rxjs';
import { invokeHost$ } from './invoke';

/** Whether the window may show what it holds, and whether the platform asks for the secret itself. */
export type WindowLockState = { locked: boolean; promptsItself: boolean };

/**
 * The host's own record of whether the window is locked.
 *
 * The database decrypts at startup because the collectors write to it every minute, so what a lock can
 * protect is the reading of it. The state is host-side and starts locked on every run: the webview is
 * what is being kept from showing a day, so it cannot be what decides whether it may.
 */
export type TauriWindowLock = {
  state$(): Observable<WindowLockState>;
  lock$(): Observable<void>;
  /** Resolves `false` for a wrong password. Only a platform that cannot check at all fails. */
  unlock$(password?: string): Observable<boolean>;
};

export const createTauriWindowLock = (): TauriWindowLock => ({
  state$: () => invokeHost$<WindowLockState>('lock_state'),
  lock$: () => invokeHost$<void>('lock_window'),
  unlock$: (password) => invokeHost$<boolean>('unlock_window', { password: password ?? null }),
});
