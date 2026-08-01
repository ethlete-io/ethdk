import { DestroyRef, Directive, booleanAttribute, computed, effect, inject, input, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { getScrollSnapTarget } from '@ethlete/core';
import { fromEvent, merge, take, tap, timer } from 'rxjs';
import { ScrollableDirective } from './scrollable.directive';
import { ScrollableScrollOrigin } from './scrollable.types';

/**
 * How long to wait for a settling glide to arrive before handing snapping back regardless - for browsers
 * without `scrollend` (Safari before 18.2), and for a glide the reader interrupts.
 */
const SETTLE_TIMEOUT = 700;

/**
 * Makes the track come to rest on a child rather than wherever the gesture ran out.
 *
 * The snapping is **native CSS scroll snap** - `scroll-snap-type` on the container, `scroll-snap-align` on the
 * children, driven by the attributes this directive puts on the scrollable. That is not just a tidier
 * implementation, it is the only one that can feel right on a touch screen: the browser folds the snap into
 * the fling itself, on the compositor, so a swipe decelerates straight onto a child and stops. It cannot be
 * late, because there is no "after" for it to be late in.
 *
 * It used to be JavaScript throughout - wait for the scrolling to go quiet for 150ms, work out the nearest
 * child, then animate there - and that is what made a carousel feel broken on a phone. The gesture ended, the
 * track sat still, and *then* a second ~200ms animation ran to correct it, sometimes by three pixels. Every
 * swipe visibly stopped twice, and at a looping carousel's seam that late correction raced the loop teleport,
 * both acting on the same quiet stretch from measurements a frame or two stale.
 *
 * Native snap alone is not the whole answer either, because `mandatory` overrules a *programmatic* offset
 * outright and silently - which is why the scrollable can hold it off (see
 * `ScrollableDirective.suspendSnap`), and why the one thing still settled in JavaScript is a cursor drag:
 * releasing a mouse button produces no fling, so there is nothing for the platform to decelerate into.
 *
 * Opt-in, applied on the `<et-scrollable>` itself. Ships in `SCROLLABLE_DRAG_IMPORTS`.
 */
@Directive({
  selector: '[etScrollableSnap]',
})
export class ScrollableSnapDirective {
  private scrollable = inject(ScrollableDirective);
  private destroyRef = inject(DestroyRef);

  public enabled = input(true, { transform: booleanAttribute, alias: 'etScrollableSnap' });
  public snapOrigin = input<ScrollableScrollOrigin>('auto');

  constructor() {
    // The intersections stay on: `scrollMode="container"` asks the scrollable to page by whole viewports, and
    // which child that lands on is read off them - as is the drag settle below.
    this.scrollable.activateChildIntersections();
    this.scrollable.snapDirective.set(this);

    // Not a linkedSignal: the value is derived from this directive's inputs, but it has to be pushed into the
    // *scrollable's* signal, which is the only place that can put it on the host for the CSS to read.
    // eslint-disable-next-line ethlete/prefer-linked-signal
    effect(() => this.scrollable.activeSnapOrigin.set(this.enabled() ? this.snapOrigin() : null));

    this.settleCursorDrags();

    this.destroyRef.onDestroy(() => {
      this.scrollable.activeSnapOrigin.set(null);
      this.scrollable.snapDirective.set(null);
    });
  }

  /**
   * A mouse drag is the one gesture the platform gives no momentum to, so native snap has nothing to
   * decelerate into: letting go of the button would hard-cut the track to the nearest child (a 120px jump in
   * a single frame, measured). This glides there instead - once, on release.
   *
   * Snapping is held off for the whole drag rather than acquired on release, so there is never a frame where
   * the browser could snap the offset the drag is still writing, and never an ordering question between this
   * and the drag's own bookkeeping.
   */
  private settleCursorDrags() {
    const isDragging = computed(() => this.enabled() && this.scrollable.isCursorDragging());

    let releaseSnap: (() => void) | null = null;

    effect(() => {
      const dragging = isDragging();

      untracked(() => {
        if (dragging) {
          releaseSnap ??= this.scrollable.suspendSnap();

          return;
        }

        if (!releaseSnap) return;

        const release = releaseSnap;
        releaseSnap = null;

        this.glideToNearestChild(release);
      });
    });

    this.destroyRef.onDestroy(() => releaseSnap?.());
  }

  /** Scroll to the child the drag ended nearest, and hand snapping back once it has arrived. */
  private glideToNearestChild(release: () => void) {
    const scrollElement = this.scrollable.getScrollContainerRef()()?.nativeElement;
    const target = scrollElement
      ? getScrollSnapTarget(
          this.scrollable
            .childIntersections()
            .filter((intersection) => intersection.intersectionRatio > 0)
            .map((intersection) => intersection.target as HTMLElement),
          scrollElement,
          this.scrollable.direction(),
          this.snapOrigin(),
          this.scrollable.scrollMargin(),
        )
      : null;

    // Already within a pixel of a child, so there is nothing to glide to and snapping can come straight back.
    if (!scrollElement || !target) {
      release();

      return;
    }

    this.scrollable.scrollToElement({
      element: target.element,
      origin: target.origin,
      ignoreForcedOrigin: true,
    });

    // `scrollend` is the arrival; the pointer is a reader grabbing the track again mid-glide, who should get
    // native snapping back at once; the timer covers a browser with no `scrollend`.
    merge(
      fromEvent(scrollElement, 'scrollend'),
      fromEvent(scrollElement, 'pointerdown', { passive: true }),
      timer(SETTLE_TIMEOUT),
    )
      .pipe(take(1), tap(release), takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }
}
