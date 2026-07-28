import {
  Directive,
  afterNextRender,
  booleanAttribute,
  computed,
  contentChild,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { ScrollableDirective } from '../../scrollable';
import { CAROUSEL_ERROR_CODES } from '../carousel-errors';
import { CarouselLabels, injectCarouselLabels } from '../carousel-labels';
import { CAROUSEL_TOKEN } from './carousel.tokens';
import { CarouselItemDirective } from './carousel-item.directive';

/** How the slides look as they move. See `CarouselDirective.transition`. */
export const CAROUSEL_TRANSITIONS = {
  NONE: 'none',
  DIM: 'dim',
} as const;

export type CarouselTransition = (typeof CAROUSEL_TRANSITIONS)[keyof typeof CAROUSEL_TRANSITIONS];

/**
 * Turns a `[etScrollable]` into a carousel: which slide is current, moving between them, and the
 * landmark semantics a carousel needs. The sliding itself stays native scrolling — that is what gives
 * touch, swipe momentum and keyboard scrolling for free — so this directive adds meaning, not movement.
 *
 * Apply it on the scrollable element (`<et-scrollable etCarousel snap itemSize="full">`), or use the
 * default `<et-carousel>`, which is that composition with controls and chrome.
 *
 * Autoplay is a separate opt-in (`etCarouselAutoplay`) so a carousel that doesn't advance itself carries
 * none of its code.
 *
 * @example
 * <et-scrollable etCarousel snap itemSize="full" #carousel="etCarousel">
 *   <div etCarouselItem>…</div>
 *   <div etCarouselItem>…</div>
 * </et-scrollable>
 * <button (click)="carousel.previous()">Back</button>
 */
@Directive({
  selector: '[etCarousel]',
  exportAs: 'etCarousel',
  providers: [{ provide: CAROUSEL_TOKEN, useExisting: CarouselDirective }],
  host: {
    role: 'region',
    'aria-roledescription': 'carousel',
    '[attr.aria-label]': 'resolvedLabels().carousel',
    '[attr.data-transition]': 'transition()',
  },
})
export class CarouselDirective {
  private injectedLabels = injectCarouselLabels();

  // Three ways the carousel finds its track, because where you put `etCarousel` decides what else can see
  // it: slides and controls resolve the carousel from an *ancestor*, so wrapping the scrollable is usually
  // what you want — and then the scrollable is a descendant, which DI can't reach.
  private ownScrollable = inject(ScrollableDirective, { optional: true });

  /**
   * Wrap around at the ends: `next()` on the last slide goes back to the first and `previous()` on the
   * first goes to the last. Off leaves both controls disabled at the ends.
   *
   * This is a wrapping *jump*, not a seamless infinite track — with native scrolling the container
   * scrolls back to the start, which is visible. @default true
   */
  public loop = input(true, { transform: booleanAttribute });

  /**
   * The look of the movement, as a `data-transition` hook the styling picks up. `'none'` is the plain
   * scroll; `'dim'` fades and shrinks the slides either side of the current one, so the carousel reads as
   * a focused row rather than a strip that happens to scroll.
   *
   * The effect is scroll-driven (a `view()` animation timeline), which means it costs no JavaScript and
   * degrades to a plain scroll where the timeline isn't supported yet — Firefox, as of this writing.
   * `<et-carousel>` ships the CSS for these; a headless carousel gets the attribute to hang its own on.
   * @default 'none'
   */
  public transition = input<CarouselTransition>('none');

  /**
   * Per-instance overrides for the carousel's strings, merged over the injected `CAROUSEL_LABELS`.
   * Prefer `provideCarouselLabels` for app-wide localization.
   */
  public labels = input<Partial<CarouselLabels> | null>(null);
  private contentScrollable = contentChild(ScrollableDirective, { descendants: true });
  /** @internal Set by `<et-carousel>` with the scrollable it renders — see the note below. */
  public attachedScrollable = signal<ScrollableDirective | null>(null);

  /**
   * @internal The scrollable this carousel drives — the movement is all its. Taken from the element itself
   * (`<et-scrollable etCarousel>`), from the content below it (`<div etCarousel>` around a scrollable and
   * its controls), or handed over by `<et-carousel>`.
   */
  public scrollable = computed(() => this.attachedScrollable() ?? this.ownScrollable ?? this.contentScrollable());

  /** The strings in effect here: the injected label set with this instance's `labels` applied. */
  public resolvedLabels = computed<CarouselLabels>(() => ({ ...this.injectedLabels, ...this.labels() }));

  /** @internal The slides, in registration order — used for their `N of M` labels and durations. */
  public items = signal<CarouselItemDirective[]>([]);

  /** How many slides the carousel holds. */
  public count = computed(() => this.scrollable()?.scrollableChildren().length ?? 0);

  /**
   * The slide currently in view. Derived from how much of each slide the scroll container can see, which
   * is what makes it follow a finger drag as readily as a button press. `-1` before the first measurement.
   */
  public activeIndex = computed(() => {
    const scrollable = this.scrollable();
    const intersections = scrollable?.childIntersections() ?? [];

    if (intersections.length === 0) return -1;

    // At the ends the edge slide wins outright: with a peeking layout the neighbour can cover more of the
    // container than the first/last slide ever does, and "at the start" must still read as slide 1.
    if (scrollable?.isAtStart()) return 0;
    if (scrollable?.isAtEnd()) return intersections.length - 1;

    let activeIndex = 0;

    for (const [index, intersection] of intersections.entries()) {
      const active = intersections[activeIndex];

      if (active && intersection.intersectionRatio > active.intersectionRatio) {
        activeIndex = index;
      }
    }

    return activeIndex;
  });

  /** Whether the first slide is the current one. */
  public isAtStart = computed(() => this.activeIndex() <= 0);

  /** Whether the last slide is the current one. */
  public isAtEnd = computed(() => this.activeIndex() >= this.count() - 1);

  /** Whether `previous()` would move — false at the first slide without `loop`. */
  public canGoPrevious = computed(() => this.count() > 1 && (this.loop() || !this.isAtStart()));

  /** Whether `next()` would move — false at the last slide without `loop`. */
  public canGoNext = computed(() => this.count() > 1 && (this.loop() || !this.isAtEnd()));

  constructor() {
    // The active slide is read off the child intersections, which the scrollable only observes on demand.
    effect(() => this.scrollable()?.activateChildIntersections());

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.scrollable()) {
          throw new RuntimeError(
            CAROUSEL_ERROR_CODES.MISSING_SCROLLABLE,
            '[CarouselDirective] etCarousel needs a scrollable to move: put it on an [etScrollable] element ' +
              '(e.g. <et-scrollable etCarousel snap itemSize="full">), or use <et-carousel>.',
          );
        }
      });

      // Not in `afterNextRender`: the slide count comes from the scrollable's mutation observer, which
      // hasn't reported the children by then in every composition. This checks the first time the carousel
      // *has* children — by which point every slide's directive has been constructed, since a child exists
      // in the DOM only after its directives do.
      let hasCheckedItems = false;

      effect(() => {
        const count = this.count();
        const itemCount = this.items().length;

        if (hasCheckedItems || count === 0) return;

        hasCheckedItems = true;

        if (itemCount === 0) {
          throw new RuntimeError(
            CAROUSEL_ERROR_CODES.MISSING_ITEMS,
            '[CarouselDirective] This carousel has children but none of them is a slide, so it can neither ' +
              'label them nor tell which one is current. Add the etCarouselItem directive to each slide.',
          );
        }
      });
    }
  }

  /** Go to the next slide, wrapping to the first when `loop` is on. */
  public next() {
    if (!this.canGoNext()) return;

    this.goTo(this.isAtEnd() ? 0 : this.activeIndex() + 1);
  }

  /** Go to the previous slide, wrapping to the last when `loop` is on. */
  public previous() {
    if (!this.canGoPrevious()) return;

    this.goTo(this.isAtStart() ? this.count() - 1 : this.activeIndex() - 1);
  }

  /** Scroll a slide into view by index. Out-of-range indices are ignored. */
  public goTo(index: number) {
    if (index < 0 || index >= this.count()) return;

    // Always align the slide to the start of the track. The scrollable's default ('nearest') deliberately
    // does nothing for an element that is merely adjacent to the viewport edge — which is exactly where the
    // next slide sits in a one-slide-per-view carousel, so `next()` would never move.
    this.scrollable()?.scrollToElementByIndex({ index, origin: 'start' });
  }

  /** @internal Called by a slide while it exists. */
  public registerItem(item: CarouselItemDirective) {
    this.items.update((items) => [...items, item]);
  }

  /** @internal */
  public unregisterItem(item: CarouselItemDirective) {
    this.items.update((items) => items.filter((registered) => registered !== item));
  }
}
