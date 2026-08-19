import {
  Directive,
  afterNextRender,
  effect,
  booleanAttribute,
  computed,
  inject,
  input,
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
  'disabled' | 'stopped' | 'reduced-motion' | 'page-hidden' | 'off-screen' | 'hover' | 'focus' | 'no-slides';

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
    '(mouseenter)': 'isHovered.set(true)',
    '(mouseleave)': 'isHovered.set(false)',
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
   *
   * `true` by default because putting the directive on an element *is* the opt-in. `<et-carousel>` is the
   * exception - it always carries the directive, so it cannot let this default stand; see
   * {@link enabledOverride}. Read {@link isEnabled} for what is actually in effect.
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
  private hostIntersection = signalHostElementIntersection();

  /**
   * @internal Set by `<et-carousel>` from its own `autoplay` input, which is opt-in and so defaults to
   * `false`.
   *
   * The component attaches this directive unconditionally - its host listeners have to cover the controls as
   * well as the track, so it cannot be conditional - which meant every `<et-carousel>` that did not say
   * `[autoplay]="false"` was playing, against what both this directive and the component document. A
   * `hostDirectives` alias forwards an input but cannot change its default, so the component takes the value
   * over entirely and pushes it here. `null` leaves {@link enabled} in charge, which is the headless case.
   */
  public enabledOverride = signal<boolean | null>(null);

  /** Whether autoplay is switched on at all - this instance's `enabled`, or what `<et-carousel>` set. */
  public isEnabled = computed(() => this.enabledOverride() ?? this.enabled());

  /** @internal Set by `etCarouselPlayToggle`, and checked in dev mode: autoplay without a pause control fails WCAG 2.2.2. */
  public pauseControl = signal<unknown | null>(null);

  /** Whether the user (or code) has stopped autoplay - the only pause that outlives hover and focus. */
  public isStopped = signal(false);

  /** @internal */
  public isHovered = signal(false);

  /** @internal */
  public isFocusWithin = signal(false);

  /**
   * @internal Whether the pointer is on the play/pause control, and whether focus is.
   *
   * Both are subtracted from the hover and focus pauses, because the control lives *inside* the carousel -
   * it has to, it is part of the region it controls. Without this, pressing play would clear `isStopped`
   * and then immediately report `'hover'` or `'focus'` instead, because the pointer and focus are still on
   * the button that was just pressed: autoplay could never be restarted by the one control WCAG requires
   * for it. And the subtraction is the honest rule rather than a workaround - those pauses exist so a
   * slide doesn't move while someone is reading or tabbing through it, and the pause control is neither.
   */
  public isPointerOnPauseControl = signal(false);

  /** @internal */
  public isFocusOnPauseControl = signal(false);

  /** How long the current slide stays: its own `autoplayTime`, or the carousel's. */
  public duration = computed(() => {
    const carousel = this.carousel;

    if (!carousel) return this.autoplayTime();

    const activeIndex = carousel.activeIndex();
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

    return null;
  });

  /** Whether autoplay is counting down right now. */
  public isPlaying = computed(() => this.pauseReason() === null && this.duration() > 0);

  constructor() {
    this.isStopped.set(!this.playOnInit());

    // `<et-carousel>` always carries this directive, so the countdown ring and pause control only reach the
    // document once autoplay is actually switched on.
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

  /** Stop if playing, start if stopped - what the play/pause control calls. */
  public toggle() {
    if (this.isStopped()) {
      this.start();
    } else {
      this.stop();
    }
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
