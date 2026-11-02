import { Channel, invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { InjectionToken, provideAppInitializer, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import { catchError, Observable, of, shareReplay, take, timeout } from 'rxjs';
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

const WINDOW_CHROME_WAIT_MS = 1000;

const WINDOW_CHROME_WATCH_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const changes$ = windowChrome$().pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HostShellMissingError)) console.error(error);

      return of(null);
    }),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  return {
    chrome: toSignal(changes$, { initialValue: null }),
    first$: changes$.pipe(timeout({ first: WINDOW_CHROME_WAIT_MS, with: () => of(null) }), take(1)),
  };
});

const injectWindowChromeWatch = /* @__PURE__ */ toInjectFn(WINDOW_CHROME_WATCH_DEF);

/** The title bar's window buttons, or null without the desktop shell. A harness provides a fixed signal of its own. */
export const WINDOW_CHROME = new InjectionToken<Signal<WindowChrome | null>>('WINDOW_CHROME', {
  factory: () => {
    const watch = injectWindowChromeWatch();

    return watch.chrome;
  },
});

/** Holds back the first render until the desktop shell has answered with the window chrome, for at most a second. */
export const provideWindowChrome = () =>
  provideAppInitializer(() => {
    const watch = injectWindowChromeWatch();

    return watch.first$;
  });

export const minimizeWindow$ = () => hostOnly$(() => getCurrentWindow().minimize());

export const toggleMaximizeWindow$ = () => hostOnly$(() => getCurrentWindow().toggleMaximize());

export const closeWindow$ = () => hostOnly$(() => getCurrentWindow().close());

export const isWindowMaximized$ = () => hostOnly$(() => getCurrentWindow().isMaximized());
