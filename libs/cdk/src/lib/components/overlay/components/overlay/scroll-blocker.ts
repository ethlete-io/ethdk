import { DOCUMENT, inject } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  createDocumentElementSignal,
  defineRootProvider,
  injectRenderer,
  signalElementScrollState,
  toInjectFn,
  toProvideFn,
} from '@ethlete/core';
import { combineLatest, tap } from 'rxjs';
import { injectOverlayManager } from './overlay-manager';

const OVERLAY_SCROLL_BLOCKER_DEF = /* @__PURE__ */ defineRootProvider(
  () => {
    const overlayManager = injectOverlayManager();
    const document = inject(DOCUMENT);
    const renderer = injectRenderer();
    const documentScrollState = signalElementScrollState(createDocumentElementSignal());

    const root = document.documentElement;
    let savedTop: number | null = null;

    combineLatest([toObservable(overlayManager.hasOpenOverlays), toObservable(documentScrollState)])
      .pipe(
        tap(([hasOpenOverlays, scrollState]) => {
          if (hasOpenOverlays && scrollState.canScrollVertically && savedTop === null) {
            savedTop = document.defaultView?.scrollY ?? 0;

            renderer.setStyle(root, {
              position: 'fixed',
              top: `-${savedTop}px`,
              left: '0',
              right: '0',
              'overflow-y': 'scroll',
            } as any);
          } else if (!hasOpenOverlays && savedTop !== null) {
            const top = savedTop;
            savedTop = null;

            renderer.setStyle(root, {
              position: null,
              top: null,
              left: null,
              right: null,
              'overflow-y': null,
              'scroll-behavior': 'auto',
            } as any);

            document.defaultView?.scrollTo(0, top);

            renderer.setStyle(root, { 'scroll-behavior': null } as any);
          }
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  },
  { name: 'Overlay Scroll Blocker' },
);

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const provideOverlayScrollBlocker = /* @__PURE__ */ toProvideFn(OVERLAY_SCROLL_BLOCKER_DEF);
/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const injectOverlayScrollBlocker = /* @__PURE__ */ toInjectFn(OVERLAY_SCROLL_BLOCKER_DEF);
