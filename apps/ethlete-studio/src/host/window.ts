import { Channel, invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Observable } from 'rxjs';
import { hasHostShell, HostShellMissingError, hostOnly$ } from './invoke';

export type WindowButton = 'minimize' | 'maximize' | 'close';

/** The window buttons Studio draws on each side of its title bar. On macOS both sides are empty. */
export type WindowChrome = {
  os: 'macos' | 'windows' | 'linux';
  left: WindowButton[];
  right: WindowButton[];
  preferNoCsd: boolean;
};

/** Emits the title bar's window buttons now and again whenever the desktop's button layout changes. */
export const windowChrome$ = (): Observable<WindowChrome> =>
  new Observable<WindowChrome>((subscriber) => {
    if (!hasHostShell()) {
      subscriber.error(new HostShellMissingError());

      return;
    }

    const changes = new Channel<WindowChrome>();

    changes.onmessage = (chrome) => subscriber.next(chrome);

    invoke('window_chrome_watch', { changes }).catch((error: unknown) => subscriber.error(error));
  });

export const minimizeWindow$ = () => hostOnly$(() => getCurrentWindow().minimize());

export const toggleMaximizeWindow$ = () => hostOnly$(() => getCurrentWindow().toggleMaximize());

export const closeWindow$ = () => hostOnly$(() => getCurrentWindow().close());

export const isWindowMaximized$ = () => hostOnly$(() => getCurrentWindow().isMaximized());
