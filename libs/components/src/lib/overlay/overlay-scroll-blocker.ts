import { DOCUMENT, DestroyRef, computed, inject } from '@angular/core';
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
import { markOverlayScrollBlockerActive } from './overlay-scroll-blocker-registry';

const OVERLAY_SCROLL_BLOCKER_DEF = /* @__PURE__ */ defineRootProvider(
  () => {
    const overlayManager = injectOverlayManager();
    const document = inject(DOCUMENT);
    const renderer = injectRenderer();
    const documentScrollState = signalElementScrollState(createDocumentElementSignal());

    markOverlayScrollBlockerActive(document);

    const blockedDocuments = computed(
      () => {
        const documents = new Set<Document>();

        for (const overlayRef of overlayManager.openOverlays()) {
          const elements = overlayRef.elements;

          if (overlayRef.config.mode !== 'non-modal' || !!elements?.backdropElement()) {
            documents.add(elements?.hostElement.ownerDocument ?? document);
          }
        }

        return documents;
      },
      { equal: (a, b) => a.size === b.size && [...a].every((entry) => b.has(entry)) },
    );

    const savedOffsets = new Map<Document, { top: number; left: number }>();

    const canScrollVertically = (target: Document, mainDocumentCanScroll: boolean) => {
      if (target === document) return mainDocumentCanScroll;

      const root = target.documentElement;

      return root.scrollHeight > root.clientHeight;
    };

    const lock = (target: Document) => {
      const top = target.defaultView?.scrollY ?? 0;
      const left = target.defaultView?.scrollX ?? 0;

      savedOffsets.set(target, { top, left });

      renderer.setStyle(target.documentElement, {
        position: 'fixed',
        top: `-${top}px`,
        left: `${-left}px`,
        right: `${left}px`,
        overflowY: 'scroll',
      });
    };

    const unlock = (target: Document) => {
      const offsets = savedOffsets.get(target);

      if (!offsets) return;

      savedOffsets.delete(target);

      const root = target.documentElement;

      renderer.setStyle(root, {
        position: null,
        top: null,
        left: null,
        right: null,
        overflowY: null,
        scrollBehavior: 'auto',
      });

      target.defaultView?.scrollTo(offsets.left, offsets.top);

      renderer.setStyle(root, { scrollBehavior: null });
    };

    inject(DestroyRef).onDestroy(() => [...savedOffsets.keys()].forEach(unlock));

    combineLatest([toObservable(blockedDocuments), toObservable(documentScrollState)])
      .pipe(
        tap(([blocked, scrollState]) => {
          for (const target of [...savedOffsets.keys()]) {
            if (!blocked.has(target)) unlock(target);
          }

          for (const target of blocked) {
            if (!savedOffsets.has(target) && canScrollVertically(target, scrollState.canScrollVertically)) {
              lock(target);
            }
          }
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  },
  { name: 'Overlay Scroll Blocker' },
);

/**
 * Blocks page scrolling while a modal overlay is open, in the window the overlay is mounted in.
 * Register once via `provideOverlay()` (or call `injectOverlayScrollBlocker()` in an environment initializer).
 */
export const provideOverlayScrollBlocker = /* @__PURE__ */ toProvideFn(OVERLAY_SCROLL_BLOCKER_DEF);
export const injectOverlayScrollBlocker = /* @__PURE__ */ toInjectFn(OVERLAY_SCROLL_BLOCKER_DEF);
