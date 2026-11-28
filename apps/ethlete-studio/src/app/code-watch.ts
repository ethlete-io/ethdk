import { DOCUMENT } from '@angular/common';
import { DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import { EMPTY, Observable, Subject, catchError, defer, exhaustMap, first, map, of, tap, timer } from 'rxjs';
import { StudioCodeState, quitForRebuild$, studioCodeState$ } from '../host/studio-code';
import { CODE_LABELS } from './i18n/shell-labels';

export const CODE_WATCH_INTERVAL_MS = 10_000;

export const PAGE_POLL_MS = 1000;

export type CodeAction = 'restartStudio' | 'restartServer' | 'restartServerAndReload';

export type RestartState = 'pending' | 'reloading' | 'failed' | null;

export type CodeNotice = { text: string; action: CodeAction };

export const codeNoticeOf = (state: StudioCodeState | null, pageLoadedAt: string | null): CodeNotice | null => {
  if (!state) return null;

  const { host, cli, frontend } = state;
  const labels = CODE_LABELS;

  if (host.running && host.latest && host.running !== host.latest) {
    return { text: labels.host, action: 'restartStudio' };
  }

  if (cli.running && cli.latest && cli.running !== cli.latest) {
    return { text: labels.cli, action: 'restartServer' };
  }

  if (pageLoadedAt && frontend.latest && pageLoadedAt !== frontend.latest) {
    return { text: labels.frontend, action: 'restartServerAndReload' };
  }

  return null;
};

export const serverRenewalOf = (state: StudioCodeState | null, pageLoadedAt: string | null): string | null =>
  codeNoticeOf(state, pageLoadedAt)?.action === 'restartServer' && state
    ? `${state.cli.running}>${state.cli.latest}`
    : null;

/** Whether the server that serves this page answers it again, so a reload cannot land on a refused page. */
export const pageAnswers$ = (view: Window): Observable<boolean> =>
  defer(() => view.fetch(view.location.pathname, { cache: 'no-store' })).pipe(
    map((response) => response.ok),
    // eslint-disable-next-line ethlete/no-silent-catch-error -- a refused fetch means the server is still down; the poll asks again
    catchError(() => of(false)),
  );

const CODE_WATCH_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const state = signal<StudioCodeState | null>(null);
  const pageLoadedAt = signal<string | null>(null);

  timer(0, CODE_WATCH_INTERVAL_MS)
    .pipe(
      exhaustMap(() =>
        studioCodeState$().pipe(
          tap((next) => {
            if (!pageLoadedAt()) pageLoadedAt.set(next?.frontend.latest ?? null);
            state.set(next);
          }),
          // eslint-disable-next-line ethlete/no-silent-catch-error -- the watch polls again; a release build has nothing to watch
          catchError(() => EMPTY),
        ),
      ),
      takeUntilDestroyed(),
    )
    .subscribe();

  const serverRestartRequests$ = new Subject<void>();

  const restart = signal<RestartState>(null);
  const document = inject(DOCUMENT);
  const destroyRef = inject(DestroyRef);
  let reloadAfterRestart = false;

  const reloadOncePageAnswers = () => {
    const view = document.defaultView;

    if (!view) return;

    restart.set('reloading');
    timer(0, PAGE_POLL_MS)
      .pipe(
        exhaustMap(() => pageAnswers$(view)),
        first(Boolean),
        tap(() => view.location.reload()),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe();
  };

  const act = (action: CodeAction) => {
    restart.set('pending');
    reloadAfterRestart = action === 'restartServerAndReload';

    if (action === 'restartStudio') {
      quitForRebuild$()
        .pipe(
          tap({ error: () => restart.set('failed') }),
          // eslint-disable-next-line ethlete/no-silent-catch-error -- the failure shows as the restart toast
          catchError(() => EMPTY),
        )
        .subscribe();

      return;
    }

    serverRestartRequests$.next();
  };

  return {
    notice: computed(() => codeNoticeOf(state(), pageLoadedAt())),
    serverRenewal: computed(() => serverRenewalOf(state(), pageLoadedAt())),
    act,
    restart: restart.asReadonly(),
    failRestart: () => restart.set('failed'),
    settleRestart: () => {
      if (restart() !== 'pending') return;

      if (reloadAfterRestart) {
        reloadOncePageAnswers();

        return;
      }

      restart.set(null);
    },
    dismissRestart: () => restart.set(null),
    serverRestarts$: serverRestartRequests$.asObservable(),
  };
});

export const injectCodeWatch = /* @__PURE__ */ toInjectFn(CODE_WATCH_DEF);
