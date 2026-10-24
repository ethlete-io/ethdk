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

/** The release speed (px/ms) above which a mouse drag counts as a flick and carries on to the next child. */
const FLICK_VELOCITY = 0.5;

/**
 * Makes the track come to rest on a child rather than wherever the gesture ran out.
 *
 * The snapping is **native CSS scroll snap** - `scroll-snap-type` on the container, `scroll-snap-align` on the
 * children, driven by the attributes this directive puts on the scrollable.
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

        this.glideToRestingChild(release);
      });
    });

    this.destroyRef.onDestroy(() => releaseSnap?.());
  }

  private glideToRestingChild(release: () => void) {
    const scrollElement = this.scrollable.getScrollContainerRef()()?.nativeElement;
    const direction = this.scrollable.direction();
    const velocity = this.scrollable.cursorDragReleaseVelocity()[direction === 'horizontal' ? 'x' : 'y'];
    const towards = velocity > FLICK_VELOCITY ? 'forward' : velocity < -FLICK_VELOCITY ? 'backward' : undefined;
    const candidates = this.scrollable
      .childIntersections()
      .filter((intersection) => intersection.intersectionRatio > 0)
      .map((intersection) => intersection.target as HTMLElement);
    const snapTarget = (bias?: 'forward' | 'backward') =>
      scrollElement
        ? getScrollSnapTarget(
            candidates,
            scrollElement,
            direction,
            this.snapOrigin(),
            this.scrollable.scrollMargin(),
            bias,
          )
        : null;
    const target = (towards && snapTarget(towards)) || snapTarget();

    if (!scrollElement || !target) {
      release();

      return;
    }

    this.scrollable.scrollToElement({
      element: target.element,
      origin: target.origin,
      ignoreForcedOrigin: true,
    });

    merge(
      fromEvent(scrollElement, 'scrollend'),
      fromEvent(scrollElement, 'pointerdown', { passive: true }),
      timer(SETTLE_TIMEOUT),
    )
      .pipe(take(1), tap(release), takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }
}
