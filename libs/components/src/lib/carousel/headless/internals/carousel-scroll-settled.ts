import { DOCUMENT, Signal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, debounceTime, fromEvent, merge, switchMap, tap } from 'rxjs';
import { ScrollableDirective } from '../../../scrollable';

/** How long the scroll has to be quiet before the fallback treats it as finished, in milliseconds. */
const SCROLL_IDLE_DURATION = 140;

/** In its own function so the `in` check doesn't narrow the element away for everything after it. */
const supportsScrollEnd = (element: HTMLElement) => 'onscrollend' in element;

export type CarouselScrollSettledConfig = {
  scrollable: Signal<ScrollableDirective | null | undefined>;
  /**
   * The scrolling has stopped and no pointer is holding the track. Anything that must not happen
   * mid-gesture or mid-animation belongs here.
   */
  onSettled: () => void;
  /** A pointer has gone down on the track, so the reader is taking over from whatever was in flight. */
  onPointerDown?: () => void;
};

/**
 * When the track has come to rest.
 *
 * `scrollend` is the right signal for it — it cannot fire mid-animation, which is exactly when a jump would
 * be visible — with a quiet stretch of `scroll` events standing in where it is missing. Either way the
 * callback is held back while a pointer is down: a mouse drag scrolls instantly on every move, so
 * `scrollend` fires throughout one, and acting on it would fight the finger.
 *
 * @internal
 */
export const useCarouselScrollSettled = (config: CarouselScrollSettledConfig) => {
  const document = inject(DOCUMENT);
  const isPointerDown = signal(false);

  let isSettleDeferred = false;

  const settle = () => {
    if (isPointerDown()) {
      isSettleDeferred = true;

      return;
    }

    isSettleDeferred = false;
    config.onSettled();
  };

  const container = computed(() => config.scrollable()?.scrollContainerRef()?.nativeElement ?? null);

  toObservable(container)
    .pipe(
      switchMap((scrollContainer) => {
        if (!scrollContainer) return EMPTY;

        const settled$ = supportsScrollEnd(scrollContainer)
          ? fromEvent(scrollContainer, 'scrollend')
          : // a debounced scroll is standing in for `scrollend`; the offset itself is read on the spot
            // eslint-disable-next-line ethlete/prefer-scroll-state
            fromEvent(scrollContainer, 'scroll', { passive: true }).pipe(debounceTime(SCROLL_IDLE_DURATION));

        const release = () => {
          isPointerDown.set(false);

          if (isSettleDeferred) settle();
        };

        return merge(
          settled$.pipe(tap(() => settle())),
          fromEvent(scrollContainer, 'pointerdown', { passive: true }).pipe(
            tap(() => {
              isPointerDown.set(true);
              config.onPointerDown?.();
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
