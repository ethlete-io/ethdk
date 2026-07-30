import { DestroyRef, Signal, computed, effect, inject, untracked } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { clamp, injectRenderer } from '@ethlete/core';
import { EMPTY, fromEvent, switchMap, tap } from 'rxjs';
import { ScrollableDirective } from '../../../scrollable';

/**
 * The one number every slide transition reads: `-1` just before the slide enters the track's viewport,
 * `0` centred, `1` just after it has left. Registered in `CarouselTransitionStylesComponent`.
 */
export const CAROUSEL_SLIDE_PROGRESS_PROPERTY = '--et-carousel-slide-progress';

/** Below this much change the write would not be visible, so it is skipped. */
const WRITE_THRESHOLD = 0.004;

type SlideMetrics = {
  element: HTMLElement;
  /** Layout offset within the scroll content — unaffected by a transition's own scaling. */
  offset: number;
  size: number;
};

export type CarouselSlideProgressConfig = {
  scrollable: Signal<ScrollableDirective | null | undefined>;
  /** Whether this driver is the one filling the property. Off for the scroll-driven timeline. */
  enabled: Signal<boolean>;
};

/**
 * Fills {@link CAROUSEL_SLIDE_PROGRESS_PROPERTY} from a passive `scroll` listener batched into a frame —
 * the fallback for browsers without scroll-driven animations (Firefox, as of this writing). It produces
 * the same numbers over the same range as the `view(inline)` timeline does, so every effect is one piece
 * of CSS either way and neither driver is the "real" one.
 *
 * A scroll does not change layout, so the slides are measured once per layout change and a frame then
 * costs one `scrollLeft` read for the whole track. Slides whose progress has settled — anything off
 * screen sits at ±1 — stop being written at all.
 *
 * @internal
 */
export const useCarouselSlideProgress = (config: CarouselSlideProgressConfig) => {
  const renderer = injectRenderer();

  let container: HTMLElement | null = null;
  let horizontal = true;
  let viewport = 0;
  let metrics: SlideMetrics[] = [];
  let written: number[] = [];
  let frame: number | null = null;

  const cancelFrame = () => {
    if (frame === null) return;

    cancelAnimationFrame(frame);
    frame = null;
  };

  const clearWrittenProgress = () => {
    for (const { element } of metrics) {
      renderer.setCssProperty(element, CAROUSEL_SLIDE_PROGRESS_PROPERTY, null);
    }

    metrics = [];
    written = [];
    container = null;
  };

  const measure = () => {
    const scrollable = config.scrollable();
    const scrollContainer = scrollable?.scrollContainerRef()?.nativeElement ?? null;

    container = scrollContainer;
    horizontal = scrollable?.direction() !== 'vertical';
    viewport = scrollContainer ? (horizontal ? scrollContainer.clientWidth : scrollContainer.clientHeight) : 0;

    metrics = (scrollable?.scrollableChildren() ?? []).map((element) => ({
      element,
      offset: horizontal ? element.offsetLeft : element.offsetTop,
      size: horizontal ? element.offsetWidth : element.offsetHeight,
    }));

    // NaN so the first pass always writes: no value is ever "close enough" to it.
    written = metrics.map(() => Number.NaN);
  };

  const write = () => {
    frame = null;

    if (!container || !viewport) return;

    const scroll = horizontal ? container.scrollLeft : container.scrollTop;

    for (const [index, { element, offset, size }] of metrics.entries()) {
      // The slide's whole pass across the viewport, which is the range `view()` covers too: it opens one
      // viewport-length before the slide's leading edge and closes one slide-length past its trailing one.
      const span = viewport + size;

      if (span <= 0) continue;

      const progress = clamp((2 * (viewport - (offset - scroll))) / span - 1, -1, 1);
      const previous = written[index] ?? Number.NaN;

      if (Math.abs(progress - previous) < WRITE_THRESHOLD) continue;

      written[index] = progress;
      renderer.setCssProperty(element, CAROUSEL_SLIDE_PROGRESS_PROPERTY, progress.toFixed(3));
    }
  };

  const schedule = () => {
    if (frame === null) frame = requestAnimationFrame(write);
  };

  const scrollContainer = computed(() =>
    config.enabled() ? (config.scrollable()?.scrollContainerRef()?.nativeElement ?? null) : null,
  );

  effect(() => {
    const isEnabled = config.enabled();
    const scrollable = config.scrollable();

    // Anything that moves a slide in layout invalidates the measurements.
    scrollable?.scrollableChildren();
    scrollable?.scrollableDimensions();

    untracked(() => {
      if (!isEnabled) {
        clearWrittenProgress();

        return;
      }

      measure();
      write();
    });
  });

  toObservable(scrollContainer)
    .pipe(
      switchMap((element) => {
        if (!element) return EMPTY;

        // the raw offset every frame is the whole point here; the scroll-state utility reports edges only
        // eslint-disable-next-line ethlete/prefer-scroll-state
        return fromEvent(element, 'scroll', { passive: true }).pipe(tap(() => schedule()));
      }),
      takeUntilDestroyed(),
    )
    .subscribe();

  inject(DestroyRef).onDestroy(() => cancelFrame());

  /**
   * Write the progress values for the offset the track is at *now*, rather than on the next frame.
   *
   * For the caller that moves the scroll offset without scrolling — the loop's teleport — which is the one
   * case where waiting a frame is visible. The teleport shifts the track a whole length in one go; a frame
   * still holding the values from before it puts every slide's content a whole track away from the box that
   * clips it, and `wipe` then draws a slide as a blank rectangle for that frame. That is the black flash at
   * the seam. Cheap enough to be unconditional: it is one `scrollLeft` read and, at most, one write per slide.
   */
  const flush = () => {
    cancelFrame();
    write();
  };

  return { flush };
};
