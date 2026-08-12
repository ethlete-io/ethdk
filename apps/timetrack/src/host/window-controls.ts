import { getCurrentWindow } from '@tauri-apps/api/window';
import { Observable } from 'rxjs';
import { hostOnly$, invokeHost$ } from './invoke';

/**
 * What the window manager will honour. A control the compositor ignores has to stay off the
 * titlebar — a button that silently does nothing is worse than a missing one.
 */
export type WindowCapabilities = {
  minimize: boolean;
  maximize: boolean;
  fullscreen: boolean;
};

export type TauriWindowControls = {
  capabilities$(): Observable<WindowCapabilities>;
  isMaximized$(): Observable<boolean>;
  minimize$(): Observable<void>;
  toggleMaximize$(): Observable<void>;
  /** Asks to close, which the host turns into hiding to the tray so the collectors keep running. */
  close$(): Observable<void>;
};

export const createTauriWindowControls = (): TauriWindowControls => ({
  capabilities$: () => invokeHost$<WindowCapabilities>('window_capabilities'),
  isMaximized$: () => hostOnly$(() => getCurrentWindow().isMaximized()),
  minimize$: () => hostOnly$(() => getCurrentWindow().minimize()),
  toggleMaximize$: () => hostOnly$(() => getCurrentWindow().toggleMaximize()),
  close$: () => hostOnly$(() => getCurrentWindow().close()),
});
