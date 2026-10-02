import {
  Directive,
  afterNextRender,
  effect,
  booleanAttribute,
  computed,
  inject,
  input,
  linkedSignal,
  numberAttribute,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  RuntimeError,
  injectHostElement,
  injectIsDocumentVisible,
  injectPrefersReducedMotion,
  injectStyleManager,
  signalHostElementIntersection,
} from '@ethlete/core';
import { EMPTY, switchMap, tap, timer } from 'rxjs';
import { CarouselAutoplayStylesComponent } from '../carousel-autoplay-styles.component';
import { CAROUSEL_ERROR_CODES } from '../carousel-errors';
import { CAROUSEL_AUTOPLAY_TOKEN, CAROUSEL_TOKEN } from './carousel.tokens';

/** Why autoplay isn't running, in the order the reasons are checked. `null` while it is running. */
export type CarouselAutoplayPauseReason =
  | 'disabled'
  | 'stopped'
  | 'reduced-motion'
  | 'page-hidden'
  | 'off-screen'
  | 'hover'
  | 'focus'
  | 'no-slides'
  | 'no-duration';

/**
 * Advances the carousel on its own. Opt-in - put it on the same element as `[etCarousel]` - so a carousel
 * that doesn't move by itself carries none of this.
 *
 * It pauses whenever moving the page under the user would be rude: pointer over the carousel, focus
 * inside it, the carousel scrolled off screen, or the user having asked for reduced motion (in which case
 * it never starts at all). It also stops at the last slide when the carousel doesn't `loop`, rather than
 * jumping back to the start forever.
 *
 * Resuming restarts the current slide's full duration instead of continuing a partial one - one clock,
 * so the progress a consumer renders can't drift away from when the slide actually changes.
 *
 * A carousel that plays by itself needs a control to stop it (WCAG 2.2.2): register one with
 * `etCarouselPlayToggle`, which the default `<et-carousel>` does for you. Dev mode throws without it.
 *
 * @example
 * <et-scrollable etCarousel etCarouselAutoplay [autoplayTime]="6000" etScrollableSnap itemSize="full">…</et-scrollable>
 */
@Directive({
  selector: '[etCarouselAutoplay]',
  exportAs: 'etCarouselAutoplay',
  providers: [{ provide: CAROUSEL_AUTOPLAY_TOKEN, useExisting: CarouselAutoplayDirective }],
  host: {
    '[attr.data-autoplaying]': 'isPlaying() ? "" : null',
    '(pointerenter)': 'setHovered($event, true)',
    '(pointerleave)': 'setHovered($event, false)',
    '(focusin)': 'isFocusWithin.set(true)',
    '(focusout)': 'isFocusWithin.set(false)',
  },
})
export class CarouselAutoplayDirective {
  private carousel = inject(CAROUSEL_TOKEN, { optional: true });
  private prefersReducedMotion = injectPrefersReducedMotion();
  private isDocumentVisible = injectIsDocumentVisible();
  private styleManager = injectStyleManager();
  private hostElement = injectHostElement();

  /**
   * Turn autoplay off without removing the directive - the same escape hatch `etScrollableSnap` has. A
   * disabled autoplay never plays and never asks for a pause control.
   * @default true
   */
  public enabled = input(true, { transform: booleanAttribute });

  /** How long each slide stays, in milliseconds. A slide can override it with its own `autoplayTime`. @default 5000 */
  public autoplayTime = input(5000, { transform: numberAttribute });

  /** Pause while the pointer is over the carousel. @default true */
  public pauseOnHover = input(true, { transform: booleanAttribute });

  /** Pause while focus is inside the carousel - moving the slide out from under a keyboard user is worse than stalling. @default true */
  public pauseOnFocus = input(true, { transform: booleanAttribute });

  /**
   * Pause whenever nobody can see the carousel: scrolled out of view, or on a tab that isn't the one in
   * front. The second is not the same check as the first - an IntersectionObserver reports a fully visible
   * element in a background tab - and it matters more, because a hidden tab throttles timers rather than
   * stopping them, so without it a carousel spends its time in the background queueing up slide changes to
   * deliver all at once on return. @default true
   */
  public pauseOnOffScreen = input(true, { transform: booleanAttribute });

  /** Start playing as soon as the carousel is ready. Off waits for `start()` (or the play control). @default true */
  public playOnInit = input(true, { transform: booleanAttribute });

  /** @internal Set by `<et-carousel>` from its `autoplay` input; `null` leaves {@link enabled} in charge. */
  public enabledOverride = signal<boolean | null>(null);

  /** Whether autoplay is switched on at all - this instance's `enabled`, or what `<et-carousel>` set. */
  public isEnabled = computed(() => this.enabledOverride() ?? this.enabled());
  private hostIntersection = signalHostElementIntersection({
    enabled: computed(() => this.isEnabled() && this.pauseOnOffScreen()),
  });

  /** @internal Set by `etCarouselPlayToggle`, and checked in dev mode: autoplay without a pause control fails WCAG 2.2.2. */
  public pauseControl = signal<unknown | null>(null);

  /**
   * Whether the user (or code) has stopped autoplay - the only pause that outlives hover and focus. Starts
   * out as the opposite of {@link playOnInit}, and follows it again whenever that binding changes.
   */
  public isStopped = linkedSignal(() => !this.playOnInit());

  /** @internal */
  public isHovered = signal(false);

  /** @internal */
  public isFocusWithin = signal(false);

  /**
   * @internal Whether the pointer is on the play/pause control. It and {@link isFocusOnPauseControl} are
   * excluded from the hover and focus pauses, or pressing play from inside the carousel could never resume it.
   */
  public isPointerOnPauseControl = signal(false);

  /** @internal */
  public isFocusOnPauseControl = signal(false);

  /** How long the current slide stays: its own `autoplayTime`, or the carousel's. */
  public duration = computed(() => {
    const carousel = this.carousel;

    if (!carousel) return this.autoplayTime();

    const activeIndex = carousel.currentIndex();
    // The slide itself, not one of its loop clones: they share an index, and the original is the one a
    // consumer set a duration on.
    const activeItem = carousel.items().find((item) => !item.isClone() && item.index() === activeIndex);

    return activeItem?.autoplayTime() ?? this.autoplayTime();
  });

  /** Why autoplay is not running, or `null` while it is. Useful for a "paused" affordance. */
  public pauseReason = computed<CarouselAutoplayPauseReason | null>(() => {
    if (!this.isEnabled()) return 'disabled';
    if (this.isStopped()) return 'stopped';
    if (this.prefersReducedMotion()) return 'reduced-motion';
    if ((this.carousel?.count() ?? 0) < 2) return 'no-slides';

    if (this.pauseOnOffScreen()) {
      if (!this.isDocumentVisible()) return 'page-hidden';

      const entries = this.hostIntersection();
      const isOnScreen = entries[0]?.isIntersecting ?? true;

      if (!isOnScreen) return 'off-screen';
    }

    if (this.pauseOnHover() && this.isHovered() && !this.isPointerOnPauseControl()) return 'hover';
    if (this.pauseOnFocus() && this.isFocusWithin() && !this.isFocusOnPauseControl()) return 'focus';
    if (this.duration() <= 0) return 'no-duration';

    return null;
  });

  /** Whether autoplay is counting down right now. */
  public isPlaying = computed(() => this.pauseReason() === null);

  constructor() {
    let hasMountedStyles = false;

    effect(() => {
      if (hasMountedStyles || !this.isEnabled()) return;

      hasMountedStyles = true;
      this.styleManager.mount(CarouselAutoplayStylesComponent);
    });

    // One clock, restarted whenever the slide, the duration or the playing state changes - a paused
    // carousel holds no timer at all. `equal` keeps an unrelated recompute from restarting the countdown.
    const run = computed(
      () => ({
        isPlaying: this.isPlaying(),
        duration: this.duration(),
        activeIndex: this.carousel?.currentIndex() ?? -1,
      }),
      {
        equal: (a, b) => a.isPlaying === b.isPlaying && a.duration === b.duration && a.activeIndex === b.activeIndex,
      },
    );

    toObservable(run)
      .pipe(
        switchMap(({ isPlaying, duration }) => (isPlaying ? timer(duration).pipe(tap(() => this.advance())) : EMPTY)),
        takeUntilDestroyed(),
      )
      .subscribe();

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.carousel) {
          throw new RuntimeError(
            CAROUSEL_ERROR_CODES.PART_OUTSIDE_CAROUSEL,
            '[CarouselAutoplayDirective] etCarouselAutoplay must be placed on the same element as [etCarousel].',
            { element: this.hostElement },
          );
        }

        if (this.isEnabled() && !this.pauseControl()) {
          throw new RuntimeError(
            CAROUSEL_ERROR_CODES.AUTOPLAY_WITHOUT_PAUSE_CONTROL,
            '[CarouselAutoplayDirective] A carousel that advances on its own needs a control to stop it (WCAG 2.2.2). ' +
              'Add a button with the etCarouselPlayToggle directive, or use <et-carousel>, which renders one.',
            { element: this.hostElement },
          );
        }
      });
    }
  }

  /** Start (or resume) autoplay. The current slide gets its full duration. */
  public start() {
    this.isStopped.set(false);
  }

  /** Stop autoplay until `start()` is called again. */
  public stop() {
    this.isStopped.set(true);
  }

  /** Stop if playing, start if not - what the play/pause control calls, so it matches the icon it renders. */
  public toggle() {
    if (this.isPlaying()) {
      this.stop();
    } else {
      this.start();
    }
  }

  protected setHovered(event: PointerEvent, isHovered: boolean) {
    if (event.pointerType === 'touch') return;

    this.isHovered.set(isHovered);
  }

  private advance() {
    const carousel = this.carousel;

    if (!carousel) return;

    if (!carousel.loop() && carousel.isAtEnd()) {
      this.stop();

      return;
    }

    carousel.next();
  }
}
