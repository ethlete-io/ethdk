import { DOCUMENT, DestroyRef, Directive, ElementRef, afterNextRender, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RuntimeError, SwipeTracker, createSwipeTracker, injectRenderer, matchesReducedMotion } from '@ethlete/core';
import { filter, fromEvent, tap } from 'rxjs';
import { claimsPointerAxis, isInteractivePointerTarget } from '../../internals/pointer-gesture-target';
import { injectNotificationManagerConfig } from '../notification-config';
import { NOTIFICATION_ERROR_CODES } from '../notification-errors';
import { NOTIFICATION_STACK_CONTEXT_TOKEN } from '../notification-stack-context.token';
import { NotificationDirective } from './notification.directive';

/** Distance the pointer must travel along the swipe axis before the notification starts following it. */
const COMMIT_THRESHOLD_PX = 8;

/** Fraction of the notification's width a slow drag must cover to count as a dismissal. */
const DISMISS_DISTANCE_RATIO = 0.3;

/** Floor for that distance, so a narrow notification still needs a deliberate drag. */
const MIN_DISMISS_DISTANCE_PX = 64;

/** Release speed (px/s) at which a flick dismisses regardless of how far it got. */
const MIN_DISMISS_VELOCITY = 150;

/** Bounds for the momentum-driven exit, matching the overlay drag gesture's settle animation. */
const MIN_EXIT_DURATION_MS = 100;
const MAX_EXIT_DURATION_MS = 350;

/** Below this release speed the gesture reads as parking the notification, not throwing it. */
const MIN_EXIT_SPEED = 50;

/** How long a released-but-not-dismissed notification takes to slide back into the stack. */
const SETTLE_DURATION_MS = 150;

/** How far past its own edge the notification travels on the way out. */
const EXIT_OVERSHOOT_PX = 16;

/** Opacity the notification reaches once it has been dragged its full width. */
const MIN_SWIPE_OPACITY = 0.3;

/**
 * Swipe-to-dismiss for a notification: drag it toward the edge its stack is docked to and let go.
 * A flick or a drag past a third of its width sends it away carrying the speed of the release; a
 * shorter one slides back. Dismissing this way is a manual dismissal - it does not touch the
 * auto-dismiss semantics of whatever is left on screen.
 *
 * Applied by `et-notification` unless the manager's `swipeToDismiss` is off. Add it to a custom
 * notification element to get the same gesture.
 */
@Directive({
  selector: '[etNotificationSwipeToDismiss]',
  exportAs: 'etNotificationSwipeToDismiss',
  host: {
    // The gesture owns the inline axis, the page keeps the block one. Unlike a sheet, a notification
    // never scrolls on its own dismiss axis, so declaring it is enough - no touchmove handling.
    '[style.touch-action]': "isEnabled ? 'pan-y' : null",
  },
})
export class NotificationSwipeToDismissDirective {
  private document = inject(DOCUMENT);
  private renderer = injectRenderer();
  private destroyRef = inject(DestroyRef);
  private managerConfig = injectNotificationManagerConfig();
  private stackContext = inject(NOTIFICATION_STACK_CONTEXT_TOKEN, { optional: true });
  private notification = inject(NotificationDirective, { optional: true });
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  /** The manager config is static, so this is settled once, at construction. */
  protected isEnabled = this.managerConfig.swipeToDismiss !== false;

  private tracker: SwipeTracker | null = null;
  private activePointerId: number | null = null;
  private isCommitted = false;

  /** The direction this gesture committed to, once it has one. */
  private sign: 1 | -1 = 1;

  /** How far the notification has been dragged toward dismissal, in px. Never negative. */
  private offset = 0;

  /** The notification's own width plus the overshoot - the distance a full dismissal covers. */
  private extent = 0;

  constructor() {
    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.notification) {
          throw new RuntimeError(
            NOTIFICATION_ERROR_CODES.SWIPE_OUTSIDE_NOTIFICATION,
            '[EtNotificationSwipeToDismissDirective] etNotificationSwipeToDismiss must be placed inside an [etNotification] element.',
            { element: this.elementRef.nativeElement },
          );
        }
      });
    }

    this.listen();
  }

  /**
   * Which way the notification may be thrown, as a physical sign, or `null` for either - resolved
   * per gesture because it depends on the writing direction, which can change under the stack.
   */
  private get allowedSign(): 1 | -1 | null {
    const position = this.stackContext?.position ?? 'bottom-end';

    if (position.endsWith('center')) return null;

    const isRtl = getComputedStyle(this.elementRef.nativeElement).direction === 'rtl';
    const docksToInlineEnd = position.endsWith('end');

    return docksToInlineEnd === isRtl ? -1 : 1;
  }

  private listen() {
    fromEvent<PointerEvent>(this.elementRef.nativeElement, 'pointerdown')
      .pipe(
        tap((event) => this.startGesture(event)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    // The document covers the moves before `setPointerCapture` retargets anything to the element.
    fromEvent<PointerEvent>(this.document, 'pointermove')
      .pipe(
        filter((event) => event.pointerId === this.activePointerId),
        tap((event) => this.trackGesture(event)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    fromEvent<PointerEvent>(this.document, 'pointerup')
      .pipe(
        filter((event) => event.pointerId === this.activePointerId),
        tap(() => this.endGesture()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    // The browser took the gesture over (a scroll won the disambiguation, the pointer left the
    // window). Put the notification back rather than act on an input the user never completed.
    fromEvent<PointerEvent>(this.document, 'pointercancel')
      .pipe(
        filter((event) => event.pointerId === this.activePointerId),
        tap(() => this.cancelGesture()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private startGesture(event: PointerEvent) {
    if (!this.isEnabled || this.activePointerId !== null) return;
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    if (isInteractivePointerTarget(event.target as HTMLElement)) return;
    if (claimsPointerAxis(event.target as HTMLElement, { boundary: this.elementRef.nativeElement, axis: 'x' })) return;

    this.tracker = createSwipeTracker(event);
    this.activePointerId = event.pointerId;
    this.isCommitted = false;
    this.offset = 0;
    this.extent = this.elementRef.nativeElement.offsetWidth + EXIT_OVERSHOOT_PX;

    // A touch never hovers, so this is the only thing that keeps a notification from timing out
    // under the finger holding it.
    this.notification?.ref().pauseTimer('gesture');
  }

  private trackGesture(event: PointerEvent) {
    if (!this.tracker) return;

    const el = this.elementRef.nativeElement;
    const { movementX, isScrolling } = this.tracker.update(event);

    if (!this.isCommitted) {
      // The pointer is panning the page, not swiping the notification.
      if (isScrolling) {
        this.forgetGesture();
        this.notification?.ref().resumeTimer('gesture');

        return;
      }

      const sign = this.allowedSign ?? (movementX >= 0 ? 1 : -1);

      if (movementX * sign < COMMIT_THRESHOLD_PX) return;

      this.sign = sign;
      this.isCommitted = true;
      el.setPointerCapture(event.pointerId);

      // Dragging text around would otherwise start selecting it.
      this.renderer.setStyle(el, { userSelect: 'none' });
    }

    this.offset = Math.min(Math.max(0, movementX * this.sign), this.extent);
    this.paint(this.offset);
  }

  private endGesture() {
    const tracker = this.tracker;
    const wasCommitted = this.isCommitted;

    this.forgetGesture();

    if (tracker && wasCommitted) {
      const velocity = tracker.end().pixelPerSecondX * this.sign;
      const width = this.elementRef.nativeElement.offsetWidth;
      const dismissDistance = Math.max(MIN_DISMISS_DISTANCE_PX, width * DISMISS_DISTANCE_RATIO);

      if (this.offset >= dismissDistance || velocity >= MIN_DISMISS_VELOCITY) {
        // On its way out - the timer it was paused on is moot.
        this.dismissWithMomentum(Math.abs(velocity));

        return;
      }

      this.settleBack();
    }

    this.notification?.ref().resumeTimer('gesture');
  }

  private cancelGesture() {
    const wasCommitted = this.isCommitted;

    this.forgetGesture();

    if (wasCommitted) this.settleBack();

    this.notification?.ref().resumeTimer('gesture');
  }

  private forgetGesture() {
    this.tracker = null;
    this.activePointerId = null;
    this.isCommitted = false;
    this.renderer.setStyle(this.elementRef.nativeElement, { userSelect: null });
  }

  /** Puts the notification where the gesture has dragged it to, fading it as it goes. */
  private paint(offset: number) {
    const el = this.elementRef.nativeElement;
    const progress = this.extent ? Math.min(1, offset / this.extent) : 0;

    this.renderer.setStyle(el, { transform: `translateX(${offset * this.sign}px)`, transition: null });
    this.renderer.setCssProperty(el, '--_et-notification-swipe-opacity', `${1 - progress * (1 - MIN_SWIPE_OPACITY)}`);
  }

  private settleBack() {
    const el = this.elementRef.nativeElement;

    this.offset = 0;
    this.renderer.setStyle(el, {
      transition: `transform ${SETTLE_DURATION_MS}ms ease, opacity ${SETTLE_DURATION_MS}ms ease`,
      transform: 'translateX(0px)',
    });
    this.renderer.setCssProperty(el, '--_et-notification-swipe-opacity', '1');
  }

  /**
   * Hands the swipe's momentum to the leave animation instead of the stylesheet's fixed duration -
   * the notification carries on in the direction it was thrown. Position stays continuous because
   * the leave transition starts from the drag's own inline transform (see the `data-swiped-away`
   * rules in `notification.component.css`, which need `!important` to override it).
   */
  private dismissWithMomentum(speed: number) {
    const el = this.elementRef.nativeElement;
    const remainingDistance = Math.max(0, this.extent - this.offset);
    const ideal = speed >= MIN_EXIT_SPEED ? (remainingDistance / speed) * 1000 : MAX_EXIT_DURATION_MS;
    const duration = Math.round(Math.min(MAX_EXIT_DURATION_MS, Math.max(MIN_EXIT_DURATION_MS, ideal)));

    this.renderer.setCssProperty(el, '--_et-notification-swipe-exit-x', `${this.extent * this.sign}px`);
    this.renderer.setAttribute(el, 'data-swiped-away', '');

    if (!matchesReducedMotion(el)) {
      this.renderer.setStyle(el, { transitionDuration: `${duration}ms` });
    }

    this.notification?.ref().dismiss();
  }
}
