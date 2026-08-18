import { DOCUMENT, computed, inject } from '@angular/core';
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

    // A breakpoint switch can give an already open overlay a backdrop (an anchored pane becoming a
    // bottom sheet), so the backdrop is read as a signal rather than from the static config.
    const hasBlockingOverlay = computed(() =>
      overlayManager
        .openOverlays()
        .some((overlayRef) => overlayRef.config.mode !== 'non-modal' || !!overlayRef.elements?.backdropElement()),
    );

    const root = document.documentElement;
    let savedTop: number | null = null;

    combineLatest([toObservable(hasBlockingOverlay), toObservable(documentScrollState)])
      .pipe(
        tap(([hasOpenOverlays, scrollState]) => {
          if (hasOpenOverlays && scrollState.canScrollVertically && savedTop === null) {
            savedTop = document.defaultView?.scrollY ?? 0;

            renderer.setStyle(root, {
              position: 'fixed',
              top: `-${savedTop}px`,
              left: '0',
              right: '0',
              overflowY: 'scroll',
            });
          } else if (!hasOpenOverlays && savedTop !== null) {
            const top = savedTop;
            savedTop = null;

            renderer.setStyle(root, {
              position: null,
              top: null,
              left: null,
              right: null,
              overflowY: null,
              scrollBehavior: 'auto',
            });

            document.defaultView?.scrollTo(0, top);

            renderer.setStyle(root, { scrollBehavior: null });
          }
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  },
  { name: 'Overlay Scroll Blocker' },
);

/**
 * Blocks body scrolling while a modal overlay is open.
 * Register once via `provideOverlay()` (or call `injectOverlayScrollBlocker()` in an environment initializer).
 */
export const provideOverlayScrollBlocker = /* @__PURE__ */ toProvideFn(OVERLAY_SCROLL_BLOCKER_DEF);
export const injectOverlayScrollBlocker = /* @__PURE__ */ toInjectFn(OVERLAY_SCROLL_BLOCKER_DEF);
