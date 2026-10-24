import { DOCUMENT, Signal, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, debounceTime, fromEvent, merge, switchMap, tap } from 'rxjs';
import { ScrollableDirective } from '../../../scrollable';

const SCROLL_IDLE_DURATION = 140;

const SCROLL_KEYS = /* @__PURE__ */ new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'PageUp',
  'PageDown',
  'Home',
  'End',
  ' ',
]);

/** In its own function so the `in` check doesn't narrow the element away for everything after it. */
const supportsScrollEnd = (element: HTMLElement) => 'onscrollend' in element;

export type CarouselScrollSettledConfig = {
  scrollable: Signal<ScrollableDirective | null | undefined>;
  onSettled: () => void;
  onPointerDown?: (event: PointerEvent) => void;
  /** A wheel, trackpad or scroll key on the track - input that takes over any scroll still running. */
  onScrollInput?: () => void;
};

/**
 * When the track has come to rest.
 *
 * `scrollend` is the right signal for it - it cannot fire mid-animation, which is exactly when a jump would
 * be visible - with a quiet stretch of `scroll` events standing in where it is missing. Either way the
 * callback is held back while a pointer is down: a mouse drag scrolls instantly on every move, so
 * `scrollend` fires throughout one, and acting on it would fight the finger. It is also held while snapping
 * is suspended: crossing the seam under the glide `etScrollableSnap` runs after a mouse drag sends that
 * glide back across every slide.
 *
 * @internal
 */
export const useCarouselScrollSettled = (config: CarouselScrollSettledConfig) => {
  const document = inject(DOCUMENT);
  const isPointerDown = signal(false);

  let isSettleDeferred = false;

  const isHeld = computed(() => isPointerDown() || !!config.scrollable()?.isSnapSuspended());

  const settle = () => {
    if (isHeld()) {
      isSettleDeferred = true;

      return;
    }

    isSettleDeferred = false;
    config.onSettled();
  };

  const container = computed(() => config.scrollable()?.scrollContainerRef()?.nativeElement ?? null);

  effect(() => {
    if (isHeld()) return;

    untracked(() => {
      if (isSettleDeferred) settle();
    });
  });

  toObservable(container)
    .pipe(
      switchMap((scrollContainer) => {
        if (!scrollContainer) return EMPTY;

        const settled$ = supportsScrollEnd(scrollContainer)
          ? fromEvent(scrollContainer, 'scrollend')
          : // a debounced scroll is standing in for `scrollend`; the offset itself is read on the spot
            // eslint-disable-next-line ethlete/prefer-scroll-state
            fromEvent(scrollContainer, 'scroll', { passive: true }).pipe(debounceTime(SCROLL_IDLE_DURATION));

        const release = () => isPointerDown.set(false);

        return merge(
          settled$.pipe(tap(() => settle())),
          fromEvent<PointerEvent>(scrollContainer, 'pointerdown', { passive: true }).pipe(
            tap((event) => {
              isPointerDown.set(true);
              config.onPointerDown?.(event);
            }),
          ),
          fromEvent(scrollContainer, 'wheel', { passive: true }).pipe(tap(() => config.onScrollInput?.())),
          fromEvent<KeyboardEvent>(scrollContainer, 'keydown').pipe(
            tap((event) => {
              if (SCROLL_KEYS.has(event.key)) config.onScrollInput?.();
            }),
          ),
          // on the document, because a drag that starts on the track routinely ends off it
          fromEvent(document, 'pointerup', { passive: true }).pipe(tap(release)),
          fromEvent(document, 'pointercancel', { passive: true }).pipe(tap(release)),
        );
      }),
      takeUntilDestroyed(),
    )
    .subscribe();

  return { isPointerDown: isPointerDown.asReadonly() };
};
