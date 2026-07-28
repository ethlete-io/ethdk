import {
  Directive,
  afterNextRender,
  booleanAttribute,
  computed,
  inject,
  input,
  numberAttribute,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { RuntimeError, injectPrefersReducedMotion, signalHostElementIntersection } from '@ethlete/core';
import { EMPTY, switchMap, tap, timer } from 'rxjs';
import { CAROUSEL_ERROR_CODES } from '../carousel-errors';
import { CAROUSEL_AUTOPLAY_TOKEN, CAROUSEL_TOKEN } from './carousel.tokens';

/** Why autoplay isn't running, in the order the reasons are checked. `null` while it is running. */
export type CarouselAutoplayPauseReason =
  'disabled' | 'stopped' | 'reduced-motion' | 'off-screen' | 'hover' | 'focus' | 'no-slides';

/**
 * Advances the carousel on its own. Opt-in — put it on the same element as `[etCarousel]` — so a carousel
 * that doesn't move by itself carries none of this.
 *
 * It pauses whenever moving the page under the user would be rude: pointer over the carousel, focus
 * inside it, the carousel scrolled off screen, or the user having asked for reduced motion (in which case
 * it never starts at all). It also stops at the last slide when the carousel doesn't `loop`, rather than
 * jumping back to the start forever.
 *
 * Resuming restarts the current slide's full duration instead of continuing a partial one — one clock,
 * so the progress a consumer renders can't drift away from when the slide actually changes.
 *
 * A carousel that plays by itself needs a control to stop it (WCAG 2.2.2): register one with
 * `etCarouselPlayToggle`, which the default `<et-carousel>` does for you. Dev mode throws without it.
 *
 * @example
 * <et-scrollable etCarousel etCarouselAutoplay [autoplayTime]="6000" snap itemSize="full">…</et-scrollable>
 */
@Directive({
  selector: '[etCarouselAutoplay]',
  exportAs: 'etCarouselAutoplay',
  providers: [{ provide: CAROUSEL_AUTOPLAY_TOKEN, useExisting: CarouselAutoplayDirective }],
  host: {
    '[attr.data-autoplaying]': 'isPlaying() ? "" : null',
    '(mouseenter)': 'isHovered.set(true)',
    '(mouseleave)': 'isHovered.set(false)',
    '(focusin)': 'isFocusWithin.set(true)',
    '(focusout)': 'isFocusWithin.set(false)',
  },
})
export class CarouselAutoplayDirective {
  private carousel = inject(CAROUSEL_TOKEN, { optional: true });
  private prefersReducedMotion = injectPrefersReducedMotion();

  /**
   * Turn autoplay off without removing the directive — what `<et-carousel>`'s `autoplay` input flips, and
   * the same escape hatch `etScrollableSnap` has. A disabled autoplay never plays and never asks for a
   * pause control. @default true
   */
  public enabled = input(true, { transform: booleanAttribute });

  /** How long each slide stays, in milliseconds. A slide can override it with its own `autoplayTime`. @default 5000 */
  public autoplayTime = input(5000, { transform: numberAttribute });

  /** Pause while the pointer is over the carousel. @default true */
  public pauseOnHover = input(true, { transform: booleanAttribute });

  /** Pause while focus is inside the carousel — moving the slide out from under a keyboard user is worse than stalling. @default true */
  public pauseOnFocus = input(true, { transform: booleanAttribute });

  /** Pause while the carousel is scrolled off screen, so it isn't racing through slides nobody can see. @default true */
  public pauseOnOffScreen = input(true, { transform: booleanAttribute });

  /** Start playing as soon as the carousel is ready. Off waits for `start()` (or the play control). @default true */
  public playOnInit = input(true, { transform: booleanAttribute });
  private hostIntersection = signalHostElementIntersection();

  /** @internal Set by `etCarouselPlayToggle`, and checked in dev mode: autoplay without a pause control fails WCAG 2.2.2. */
  public pauseControl = signal<unknown | null>(null);

  /** Whether the user (or code) has stopped autoplay — the only pause that outlives hover and focus. */
  public isStopped = signal(false);

  /** @internal */
  public isHovered = signal(false);

  /** @internal */
  public isFocusWithin = signal(false);

  /** How long the current slide stays: its own `autoplayTime`, or the carousel's. */
  public duration = computed(() => {
    const carousel = this.carousel;

    if (!carousel) return this.autoplayTime();

    const activeIndex = carousel.activeIndex();
    const activeItem = carousel.items().find((item) => item.index() === activeIndex);

    return activeItem?.autoplayTime() ?? this.autoplayTime();
  });

  /** Why autoplay is not running, or `null` while it is. Useful for a "paused" affordance. */
  public pauseReason = computed<CarouselAutoplayPauseReason | null>(() => {
    if (!this.enabled()) return 'disabled';
    if (this.isStopped()) return 'stopped';
    if (this.prefersReducedMotion()) return 'reduced-motion';
    if ((this.carousel?.count() ?? 0) < 2) return 'no-slides';

    if (this.pauseOnOffScreen()) {
      const entries = this.hostIntersection();
      const isOnScreen = entries[0]?.isIntersecting ?? true;

      if (!isOnScreen) return 'off-screen';
    }

    if (this.pauseOnHover() && this.isHovered()) return 'hover';
    if (this.pauseOnFocus() && this.isFocusWithin()) return 'focus';

    return null;
  });

  /** Whether autoplay is counting down right now. */
  public isPlaying = computed(() => this.pauseReason() === null && this.duration() > 0);

  constructor() {
    this.isStopped.set(!this.playOnInit());

    // One clock, restarted whenever the slide, the duration or the playing state changes — a paused
    // carousel holds no timer at all. `equal` keeps an unrelated recompute from restarting the countdown.
    const run = computed(
      () => ({
        isPlaying: this.isPlaying(),
        duration: this.duration(),
        activeIndex: this.carousel?.activeIndex() ?? -1,
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
          );
        }

        if (this.enabled() && !this.pauseControl()) {
          throw new RuntimeError(
            CAROUSEL_ERROR_CODES.AUTOPLAY_WITHOUT_PAUSE_CONTROL,
            '[CarouselAutoplayDirective] A carousel that advances on its own needs a control to stop it (WCAG 2.2.2). ' +
              'Add a button with the etCarouselPlayToggle directive, or use <et-carousel>, which renders one.',
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

  /** Stop if playing, start if stopped — what the play/pause control calls. */
  public toggle() {
    this.isStopped.update((stopped) => !stopped);
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
