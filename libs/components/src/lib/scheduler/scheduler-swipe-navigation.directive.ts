import { computed, DestroyRef, Directive, ElementRef, inject, input } from '@angular/core';
import { createSwipeTracker, injectRenderer, RuntimeError, SwipeTracker } from '@ethlete/core';
import { SchedulerDirective, SchedulerFeatureConfig, schedulerFeatureConfig } from './headless';
import { SCHEDULER_ERROR_CODES } from './scheduler-errors';

/** Distance along the inline axis at which the gesture stops being a tap and becomes the scheduler's. */
const COMMIT_THRESHOLD_PX = 16;

/** How far a deliberate, unhurried swipe has to travel to step a period. */
const MIN_SWIPE_DISTANCE_PX = 56;

/** A flick steps a period on speed instead of distance, but still has to be a stroke rather than a twitch. */
const MIN_FLICK_DISTANCE_PX = 32;
const MIN_FLICK_VELOCITY = 300;

/** Options for {@link SchedulerSwipeNavigationDirective}. */
export type SchedulerSwipeNavigationConfig = SchedulerFeatureConfig;

/**
 * Swipe left for the next period, right for the previous one - the same steps the toolbar's
 * prev/next buttons take. Touch only: a horizontal mouse drag on a view draws a range instead.
 *
 * One of the default pieces `<et-scheduler>` bundles; add it to a bare `[etScheduler]` composition
 * to get the same gesture.
 *
 * @example
 * <et-scheduler [etSchedulerSwipeNavigation]="{ enabled: false }" … />
 */
@Directive({
  selector: '[etSchedulerSwipeNavigation]',
  exportAs: 'etSchedulerSwipeNavigation',
})
export class SchedulerSwipeNavigationDirective {
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private renderer = injectRenderer();
  private destroyRef = inject(DestroyRef);
  private scheduler = inject(SchedulerDirective, { optional: true });

  /** See {@link SchedulerSwipeNavigationConfig}. */
  public config = input({} as SchedulerSwipeNavigationConfig, {
    alias: 'etSchedulerSwipeNavigation',
    transform: schedulerFeatureConfig<SchedulerSwipeNavigationConfig>,
  });

  private isEnabled = computed(() => this.config().enabled ?? true);

  private tracker: SwipeTracker | null = null;
  private isCommitted = false;

  constructor() {
    if (!this.scheduler) {
      throw new RuntimeError(
        SCHEDULER_ERROR_CODES.SWIPE_NAVIGATION_OUTSIDE_SCHEDULER,
        '[etSchedulerSwipeNavigation] must be used on an <et-scheduler> or an [etScheduler] element.',
        { element: this.elementRef.nativeElement },
      );
    }

    this.listen();
  }

  private listen() {
    const element = this.elementRef.nativeElement;

    const unlisten = [
      this.renderer.listen(element, 'touchstart', (event: Event) => this.startGesture(event as TouchEvent)),
      this.renderer.listen(element, 'touchmove', (event: Event) => this.trackGesture(event as TouchEvent)),
      this.renderer.listen(element, 'touchend', (event: Event) => this.endGesture(event as TouchEvent)),
      this.renderer.listen(element, 'touchcancel', () => this.forgetGesture()),
    ];

    this.destroyRef.onDestroy(() => unlisten.forEach((stop) => stop()));
  }

  private startGesture(event: TouchEvent) {
    if (!this.isEnabled() || this.tracker) return;

    // A second finger is a pinch or a zoom, neither of which is a period step.
    if (event.touches.length !== 1) return;

    this.tracker = createSwipeTracker(event);
    this.isCommitted = false;
  }

  private trackGesture(event: TouchEvent) {
    const tracker = this.tracker;

    if (!tracker) return;

    // A long press has armed a view's own gesture, so this finger is drawing a range or dragging an
    // appointment - either way it is not a period step.
    if (this.scheduler?.draftRange() || this.scheduler?.appointmentDrag()) return this.forgetGesture();

    const { positiveMovementX, isScrolling } = tracker.update(event);

    if (isScrolling) return this.forgetGesture();

    if (!this.isCommitted) {
      if (positiveMovementX < COMMIT_THRESHOLD_PX) return;

      this.isCommitted = true;
    }

    // Preventing the move both stops the page panning under the gesture and stops the tap the
    // browser would otherwise synthesize on release - which, over an appointment, opens it.
    if (event.cancelable) event.preventDefault();
  }

  private endGesture(event: TouchEvent) {
    const tracker = this.tracker;
    const wasCommitted = this.isCommitted;

    this.forgetGesture();

    if (!tracker || !wasCommitted) return;
    if (event.cancelable) event.preventDefault();

    const { movementX, positiveMovementX, positivePixelPerSecondX } = tracker.end();
    const isSwipe =
      positiveMovementX >= MIN_SWIPE_DISTANCE_PX ||
      (positiveMovementX >= MIN_FLICK_DISTANCE_PX && positivePixelPerSecondX >= MIN_FLICK_VELOCITY);

    if (!isSwipe) return;

    // Dragging the period away to the inline start pulls the next one in, so the physical direction
    // flips with the writing direction.
    const isRtl = getComputedStyle(this.elementRef.nativeElement).direction === 'rtl';
    const isForwards = isRtl ? movementX > 0 : movementX < 0;

    if (isForwards) {
      this.scheduler?.next();
    } else {
      this.scheduler?.previous();
    }
  }

  private forgetGesture() {
    this.tracker = null;
    this.isCommitted = false;
  }
}
