/* eslint-disable @typescript-eslint/no-explicit-any */
import { DOCUMENT, inject } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  createRootProvider,
  elementCanScroll,
  injectAngularRootElement,
  injectRenderer,
  writeScrollbarSizeToCssVariables,
} from '@ethlete/core';
import { combineLatest, fromEvent, map, of, startWith, switchMap, tap } from 'rxjs';
import { injectOverlayManager } from './overlay-manager';

export const [provideOverlayScrollBlocker, injectOverlayScrollBlocker] = createRootProvider(
  () => {
    const overlayManager = injectOverlayManager();
    const document = inject(DOCUMENT);
    const angularRoot = injectAngularRootElement();
    const renderer = injectRenderer();

    const root = document.documentElement;
    let isEnabled = false;

    writeScrollbarSizeToCssVariables();

    combineLatest({
      hasOpenOverlays: toObservable(overlayManager.hasOpenOverlays),
      angularRoot: toObservable(angularRoot),
    })
      .pipe(
        switchMap((data) => {
          if (!data.hasOpenOverlays || !data.angularRoot) return of(data);

          return fromEvent(window, 'resize').pipe(
            startWith(data),
            map(() => data),
          );
        }),
        tap(({ hasOpenOverlays, angularRoot }) => {
          if (!angularRoot) return;

          if (hasOpenOverlays && elementCanScroll(root)) {
            if (isEnabled) return;

            renderer.setStyle(angularRoot, {
              contain: 'content',
            });

            renderer.setStyle(root, {
              'padding-inline-end': 'var(--et-sw)',
              overflow: 'hidden',
            } as any);

            isEnabled = true;
          } else if (!hasOpenOverlays && isEnabled) {
            renderer.setStyle(root, {
              overflow: null,
              'padding-inline-end': null,
            } as any);

            renderer.setStyle(angularRoot, {
              contain: null,
            });

            isEnabled = false;
          }
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  },
  { name: 'Overlay Scroll Blocker' },
);
