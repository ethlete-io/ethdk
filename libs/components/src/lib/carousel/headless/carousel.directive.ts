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
import { RuntimeError, injectPrefersReducedMotion, injectStyleManager } from '@ethlete/core';
import { ScrollableDirective, ScrollableItemSize } from '../../scrollable';
import { CAROUSEL_ERROR_CODES } from '../carousel-errors';
import { CarouselLabels, injectCarouselLabels } from '../carousel-labels';
import { CarouselTransitionStylesComponent } from '../carousel-transition-styles.component';
import { CAROUSEL_TOKEN } from './carousel.tokens';
import { CarouselItemDirective } from './carousel-item.directive';
import { CarouselSlideTemplateRef } from './carousel-slide.directive';
import { useCarouselLoop } from './internals/carousel-loop';
import { useCarouselScrollSettled } from './internals/carousel-scroll-settled';
import { useCarouselSlideProgress } from './internals/carousel-slide-progress';

/** Where the current slide comes to rest. See `CarouselDirective.slideAlign`. */
export const CAROUSEL_SLIDE_ALIGNMENTS = {
  START: 'start',
  CENTER: 'center',
} as const;

export type CarouselSlideAlign = (typeof CAROUSEL_SLIDE_ALIGNMENTS)[keyof typeof CAROUSEL_SLIDE_ALIGNMENTS];

/** How the slides look as they move. See `CarouselDirective.transition`. */
export const CAROUSEL_TRANSITIONS = {
  NONE: 'none',
  DIM: 'dim',
  WIPE: 'wipe',
  CUSTOM: 'custom',
} as const;

export type CarouselTransition = (typeof CAROUSEL_TRANSITIONS)[keyof typeof CAROUSEL_TRANSITIONS];

/** What fills the slide progress property. See `CarouselDirective.transitionDriver`. */
export const CAROUSEL_TRANSITION_DRIVERS = {
  AUTO: 'auto',
  SCROLL_TIMELINE: 'scroll-timeline',
  JS: 'js',
  NONE: 'none',
} as const;

export type CarouselTransitionDriver = (typeof CAROUSEL_TRANSITION_DRIVERS)[keyof typeof CAROUSEL_TRANSITION_DRIVERS];

/** The driver actually running - `'auto'` has been resolved and reduced motion applied. */
export type CarouselResolvedTransitionDriver = Exclude<CarouselTransitionDriver, 'auto'>;

/** How many slides one viewport holds at each fixed `itemSize`. `'auto'` and `'same'` are measured. */
const SLIDES_PER_VIEW: Partial<Record<ScrollableItemSize, number>> = {
  full: 1,
  half: 2,
  third: 3,
  quarter: 4,
};

const supportsViewTimeline = () =>
  typeof CSS !== 'undefined' &&
  typeof CSS.supports === 'function' &&
  CSS.supports('animation-timeline', 'view(inline)');

/**
 * Turns a `[etScrollable]` into a carousel: which slide is current, moving between them, seamless
 * looping, and the landmark semantics a carousel needs. The sliding itself stays native scrolling - that
 * is what gives touch, swipe momentum and keyboard scrolling for free - so this directive adds meaning
 * and continuity, not movement.
 *
 * Apply it on the scrollable element (`<et-scrollable etCarousel etScrollableSnap itemSize="full">`), or use the
 * default `<et-carousel>`, which is that composition with controls, chrome and rendered slides.
 *
 * Autoplay is a separate opt-in (`etCarouselAutoplay`) so a carousel that doesn't advance itself carries
 * none of its code.
 *
 * @example
 * <et-scrollable etCarousel etScrollableSnap itemSize="full" #carousel="etCarousel">
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
    '[attr.data-slide-align]': 'slideAlign()',
    '[attr.data-transition]': 'transition()',
    '[attr.data-transition-driver]': 'resolvedTransitionDriver()',
    '[attr.data-looping]': 'isLooping() ? "" : null',
  },
})
export class CarouselDirective {
  private injectedLabels = injectCarouselLabels();
  private prefersReducedMotion = injectPrefersReducedMotion();
  private styleManager = injectStyleManager();

  // Three ways the carousel finds its track, because where you put `etCarousel` decides what else can see
  // it: slides and controls resolve the carousel from an *ancestor*, so wrapping the scrollable is usually
  // what you want - and then the scrollable is a descendant, which DI can't reach.
  private ownScrollable = inject(ScrollableDirective, { optional: true });

  /**
   * Cross the seam without showing it: the track carries clones of the slides either side of the real
   * run, and the scroll offset is shifted a whole track's length whenever it drifts into them - on
   * `scrollend`, never mid-animation, and never while a finger is down. `next()` past the last slide and
   * `previous()` before the first then simply keep scrolling, and both controls stay operable.
   *
   * Seamless looping needs rendered clones, so it applies to `<et-carousel>` (which renders the slides)
   * and to carousels with more slides than fit a viewport. Everywhere else `loop` stays a wrapping
   * *jump* back to the other end - a hand-built carousel over a bare scrollable owns its own DOM, and a
   * carousel whose slides all fit has no seam to cross. @default true
   */
  public loop = input(true, { transform: booleanAttribute });

  /**
   * Where the current slide comes to rest. `'start'` lines it up with the start of the track; `'center'`
   * puts it in the middle, so a multi-item layout reads as *one* current slide with its neighbours peeking
   * either side rather than as a row that happens to be cut off.
   *
   * It makes no difference at `itemSize="full"`, where a slide fills the track either way. Centring the
   * first or last slide needs content beyond it, so it comes into its own on a looping carousel - which is
   * also where the transitions read best, since `--et-carousel-slide-progress` is measured from the centre.
   * @default 'start'
   */
  public slideAlign = input<CarouselSlideAlign>('start');

  /**
   * The look of the movement. `'none'` is the plain scroll; `'dim'` fades and shrinks the slides either
   * side of the current one; `'wipe'` uncovers each slide from the edge it is travelling towards.
   *
   * Every effect follows the slide's *position* rather than an "active" flag, which is what makes it track a
   * drag and reverse when you drag back rather than stepping when a flag flips.
   *
   * `'custom'` applies no effect and instead fills `--et-carousel-slide-progress` - `-1` before a slide
   * enters, `0` at centred, `1` once it has left - for CSS of your own to read. It is a separate value rather
   * than something the built-in effects also do, because that property *inherits*, so filling it restyles
   * everything inside every slide on every frame: it measured eight times the style cost of the built-in
   * effects, which are keyframes over composited properties instead. Worth paying for when you are using it,
   * not otherwise. `transitionDriver` decides what fills it. @default 'none'
   */
  public transition = input<CarouselTransition>('none');

  /**
   * What fills `--et-carousel-slide-progress`. `'auto'` uses the scroll-driven `view()` timeline where
   * the browser has one and a scroll listener batched into a frame where it doesn't (Firefox, as of this
   * writing), so an effect looks the same everywhere. `'scroll-timeline'` and `'js'` pin it; `'none'`
   * leaves the property alone, for a page that would rather have the plain scroll.
   *
   * `prefers-reduced-motion` resolves to `'none'` whatever this says. @default 'auto'
   */
  public transitionDriver = input<CarouselTransitionDriver>('auto');

  /**
   * Per-instance overrides for the carousel's strings, merged over the injected `CAROUSEL_LABELS`.
   * Prefer `provideCarouselLabels` for app-wide localization.
   */
  public labels = input<Partial<CarouselLabels> | null>(null);
  private contentScrollable = contentChild(ScrollableDirective, { descendants: true });
  /** @internal Set by `<et-carousel>` with the scrollable it renders - see the note below. */
  public attachedScrollable = signal<ScrollableDirective | null>(null);

  /** @internal Set by `etCarouselSlide`; its presence is what says the slides are rendered from data. */
  public slideTemplate = signal<CarouselSlideTemplateRef | null>(null);

  /**
   * @internal The scrollable this carousel drives - the movement is all its. Taken from the element itself
   * (`<et-scrollable etCarousel>`), from the content below it (`<div etCarousel>` around a scrollable and
   * its controls), or handed over by `<et-carousel>`.
   */
  public scrollable = computed(() => this.attachedScrollable() ?? this.ownScrollable ?? this.contentScrollable());

  /** The strings in effect here: the injected label set with this instance's `labels` applied. */
  public resolvedLabels = computed<CarouselLabels>(() => ({ ...this.injectedLabels(), ...this.labels() }));

  /** @internal The slides, in registration order - used for their `N of M` labels and durations. */
  public items = signal<CarouselItemDirective[]>([]);

  /** @internal How many children the track holds, loop clones included. */
  public domCount = computed(() => this.scrollable()?.scrollableChildren().length ?? 0);

  /**
   * How many slides the carousel holds. Clones don't count - from the slides array where there is one,
   * which is also immediate, and from the track's children for a hand-built carousel.
   */
  public count = computed(() => this.slideTemplate()?.slides().length ?? this.domCount());

  /** How many slides one viewport shows, so the clone run can be made long enough to cover it. */
  private slidesPerView = computed(() => {
    const scrollable = this.scrollable();

    if (!scrollable) return 0;

    const itemSize = scrollable.itemSize();
    const fixed = SLIDES_PER_VIEW[itemSize];

    if (fixed) return fixed;

    // `'same'` divides the viewport between every slide, so the track never overflows and there is no
    // seam to cross in the first place.
    if (itemSize === 'same') return 0;

    // `'auto'`: the slides size themselves, so how many fit has to be measured. Measuring the *rendered*
    // children rather than the real run keeps this out of a loop with `cloneCount` - the widths repeat, so
    // any run of them answers the question.
    const horizontal = scrollable.direction() !== 'vertical';
    const client = scrollable.scrollableDimensions().client;
    const viewport = (horizontal ? client?.width : client?.height) ?? 0;

    if (!viewport) return 0;

    const gap = Number.parseFloat(scrollable.gapValue() ?? '0') || 0;
    let filled = 0;
    let fitting = 0;

    for (const child of scrollable.scrollableChildren()) {
      // A per-slide ResizeObserver to answer "how many fit" would cost more than it saves, and the read is
      // not stale: the container's own dimensions signal above is what re-runs this.
      // eslint-disable-next-line ethlete/prefer-element-dimensions
      filled += (horizontal ? child.offsetWidth : child.offsetHeight) + gap;
      fitting++;

      if (filled >= viewport) break;
    }

    return fitting;
  });

  /**
   * @internal How many clones sit either side of the real slides. One viewport's worth plus one, so the
   * seam is never in view when the teleport happens, and never more than there are slides to clone.
   *
   * Zero unless the carousel renders its own slides: clones have to be live views, which only the
   * component stamping the slide template can make.
   */
  public cloneCount = computed(() => {
    if (!this.loop() || !this.slideTemplate()) return 0;

    const count = this.count();
    const perView = this.slidesPerView();

    // Nothing overflows, so there is no seam - and nothing to clone from either.
    if (!perView || count <= perView) return 0;

    return Math.min(count, perView + 1);
  });

  /** Whether the track is a seamless loop right now, rather than one that jumps back at the ends. */
  public isLooping = computed(() => this.cloneCount() > 0);

  /**
   * The child a programmatic scroll is heading for.
   *
   * The observed index below comes from an IntersectionObserver, which reports a frame or two late - so
   * while a scroll is in flight it still names the slide the carousel is leaving. Stepping from that is
   * what made a second click during the first one's animation go nowhere, or retarget the scroll backwards
   * mid-flight. Everything therefore steps from where the carousel is *going*, and this is cleared once the
   * scrolling settles or the reader takes over.
   */
  private requestedDomIndex = signal<number | null>(null);

  /** @internal Which child the intersections say is in view - the truth, a frame or two late. */
  public observedDomIndex = computed(() => {
    const scrollable = this.scrollable();
    const intersections = scrollable?.childIntersections() ?? [];

    if (intersections.length === 0) return -1;

    // At the ends the edge slide wins outright: with a peeking layout the neighbour can cover more of the
    // container than the first/last slide ever does, and "at the start" must still read as slide 1. A
    // looping track has no ends to be at - those positions are clones it is about to teleport out of.
    if (!this.isLooping()) {
      if (scrollable?.isAtStart()) return 0;
      if (scrollable?.isAtEnd()) return intersections.length - 1;
    }

    let activeIndex = 0;

    for (const [index, intersection] of intersections.entries()) {
      const active = intersections[activeIndex];

      if (active && intersection.intersectionRatio > active.intersectionRatio) {
        activeIndex = index;
      }
    }

    return activeIndex;
  });

  /**
   * @internal Which child of the track is current, counting clones. The public `activeIndex` is this mapped
   * back onto the slides.
   */
  public activeDomIndex = computed(() => this.requestedDomIndex() ?? this.observedDomIndex());

  /**
   * The slide currently in view. Derived from how much of each slide the scroll container can see, which
   * is what makes it follow a finger drag as readily as a button press - and from the pending target while
   * a button press is still being animated, so the dots move with the click rather than after it. `-1`
   * before the first measurement.
   *
   * A clone reports the slide it clones, so this stays a slide index however far the track has looped.
   */
  public activeIndex = computed(() => this.slideIndexOf(this.activeDomIndex()));

  /** Whether the first slide is the current one. True once per lap on a looping carousel. */
  public isAtStart = computed(() => this.activeIndex() <= 0);

  /** Whether the last slide is the current one. True once per lap on a looping carousel. */
  public isAtEnd = computed(() => this.activeIndex() >= this.count() - 1);

  /** Whether `previous()` would move - false at the first slide without `loop`. */
  public canGoPrevious = computed(() => this.count() > 1 && (this.loop() || !this.isAtStart()));

  /** Whether `next()` would move - false at the last slide without `loop`. */
  public canGoNext = computed(() => this.count() > 1 && (this.loop() || !this.isAtEnd()));

  /**
   * Which driver is filling `--et-carousel-slide-progress`, with `'auto'` resolved against what the
   * browser implements and `prefers-reduced-motion` overriding everything.
   */
  public resolvedTransitionDriver = computed<CarouselResolvedTransitionDriver>(() => {
    if (this.transition() === 'none' || this.prefersReducedMotion()) return 'none';

    const requested = this.transitionDriver();

    if (requested !== 'auto') return requested;

    return supportsViewTimeline() ? 'scroll-timeline' : 'js';
  });

  constructor() {
    // The active slide is read off the child intersections, which the scrollable only observes on demand.
    effect(() => this.scrollable()?.activateChildIntersections());

    const loop = useCarouselLoop({
      scrollable: this.scrollable,
      cloneCount: this.cloneCount,
      count: this.count,
      domCount: this.domCount,
      slideAlign: this.slideAlign,
      activeIndex: this.activeIndex,
    });

    const slideProgress = useCarouselSlideProgress({
      scrollable: this.scrollable,
      enabled: computed(() => this.resolvedTransitionDriver() === 'js'),
    });

    useCarouselScrollSettled({
      scrollable: this.scrollable,
      onSettled: () => {
        // One geometry read for both of the questions below - reading it costs a forced layout and an
        // offset per child, and this runs on the frame the scrolling stops.
        const settled = loop.readSettled();
        const requested = this.requestedDomIndex();

        // A navigation that steps more than one slide covers the rest instantly first, and that instant
        // scroll settles too - acting on it would teleport out from under the animation still to come. So a
        // settle that has not arrived at the requested child is not this navigation's; the scroll that is
        // still running will settle again.
        if (requested !== null && settled && settled.resting !== requested) return;

        // Trust the intersections again before crossing the seam: the teleport moves the track under the
        // very index that was pending, so holding on to it would name the wrong child.
        this.requestedDomIndex.set(null);

        // The JS driver fills the progress property from a scroll listener batched into a frame, and a
        // teleport is a whole track's worth of movement that no scroll event preceded - so it is told at
        // once rather than a frame later. See `flush`.
        if (settled?.crossSeam()) slideProgress.flush();
      },
      // The reader is scrolling for themselves now, so whatever a button asked for is no longer the plan.
      onPointerDown: () => this.requestedDomIndex.set(null),
    });

    // The transition CSS is mounted rather than shipped, so `transition="none"` - the default - injects
    // none of it, and a headless carousel gets the property registration it needs to write its own.
    let hasMountedTransitionStyles = false;

    effect(() => {
      if (hasMountedTransitionStyles || this.transition() === 'none') return;

      hasMountedTransitionStyles = true;
      this.styleManager.mount(CarouselTransitionStylesComponent);
    });

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.scrollable()) {
          throw new RuntimeError(
            CAROUSEL_ERROR_CODES.MISSING_SCROLLABLE,
            '[CarouselDirective] etCarousel needs a scrollable to move: put it on an [etScrollable] element ' +
              '(e.g. <et-scrollable etCarousel etScrollableSnap itemSize="full">), or use <et-carousel>.',
          );
        }
      });

      // Not in `afterNextRender`: the slide count comes from the scrollable's mutation observer, which
      // hasn't reported the children by then in every composition. This checks the first time the carousel
      // *has* children - by which point every slide's directive has been constructed, since a child exists
      // in the DOM only after its directives do.
      let hasCheckedItems = false;

      effect(() => {
        const domCount = this.domCount();
        const itemCount = this.items().length;

        if (hasCheckedItems || domCount === 0) return;

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

  /** Go to the next slide. On a looping carousel it simply keeps scrolling; otherwise it wraps. */
  public next() {
    if (!this.canGoNext()) return;

    this.goToDomIndex(this.stepDomIndex(1));
  }

  /** Go to the previous slide. On a looping carousel it simply keeps scrolling; otherwise it wraps. */
  public previous() {
    if (!this.canGoPrevious()) return;

    this.goToDomIndex(this.stepDomIndex(-1));
  }

  /**
   * Scroll a slide into view by index. Out-of-range indices are ignored.
   *
   * On a looping carousel it goes the shorter way round - the clones mean the same slide exists a whole
   * track either side, so slide 5 of 6 is one step back from slide 1, not five forward.
   */
  public goTo(index: number) {
    if (index < 0 || index >= this.count()) return;

    this.goToDomIndex(this.nearestDomIndexOf(index));
  }

  /** @internal Called by a slide while it exists. */
  public registerItem(item: CarouselItemDirective) {
    this.items.update((items) => [...items, item]);
  }

  /** @internal */
  public unregisterItem(item: CarouselItemDirective) {
    this.items.update((items) => items.filter((registered) => registered !== item));
  }

  /**
   * @internal Which slide a track child shows: itself, or - for a clone - the slide it clones. `-1` before
   * there is anything to map.
   */
  public slideIndexOf(domIndex: number) {
    const count = this.count();

    if (domIndex < 0 || count === 0) return -1;

    const shifted = domIndex - this.cloneCount();

    return ((shifted % count) + count) % count;
  }

  /**
   * Scroll to a track child by its position among the children, counting clones.
   *
   * More than one slide away, the last slide is the only one animated and the rest is covered instantly.
   * A browser gives a smooth scroll the same duration whatever the distance, so a multi-slide jump is a
   * blur either way - and with a position-driven transition it is a blur of one transition per slide
   * crossed, which is what made jumping five dots along look like a strobe. One step, at the speed a step
   * is meant to take.
   */
  private goToDomIndex(domIndex: number) {
    const scrollable = this.scrollable();

    if (!scrollable || domIndex < 0 || domIndex >= this.domCount()) return;

    const from = this.activeDomIndex();
    const origin = this.slideAlign();
    const distance = from < 0 ? 0 : domIndex - from;

    // Recorded before either scroll: a second click during this one steps from here rather than from the
    // slide the intersections are still reporting, and the settle handler needs it to tell the instant
    // reposition below apart from the animation that follows it.
    this.requestedDomIndex.set(domIndex);

    if (Math.abs(distance) > 1) {
      scrollable.scrollToElementByIndex({
        index: domIndex - Math.sign(distance),
        origin,
        behavior: 'instant',
        ignoreForcedOrigin: true,
      });
    }

    // Never 'nearest' (the scrollable's default): it deliberately does nothing for an element merely
    // adjacent to the viewport edge, which is exactly where the next slide sits in a one-slide-per-view
    // carousel - so `next()` would never move.
    scrollable.scrollToElementByIndex({ index: domIndex, origin });
  }

  /**
   * Which copy of a slide to travel to: the one nearest where the carousel is now. Only a looping track has
   * more than one, and picking the nearest is what makes the dots go the short way round.
   */
  private nearestDomIndexOf(index: number) {
    const cloneCount = this.cloneCount();
    const target = cloneCount + index;

    if (!this.isLooping()) return target;

    const count = this.count();
    const domCount = this.domCount();
    const from = this.activeDomIndex();

    if (from < 0) return target;

    return [target - count, target, target + count]
      .filter((candidate) => candidate >= 0 && candidate < domCount)
      .reduce((best, candidate) => (Math.abs(candidate - from) < Math.abs(best - from) ? candidate : best), target);
  }

  /**
   * The child one step along. While looping the clones are what make "one more" always exist; if the step
   * would fall off the end of them - a teleport that hasn't happened yet - it re-enters the real run at the
   * same slide instead. Without clones it wraps to the other end, which is the visible jump `loop` is
   * without them.
   */
  private stepDomIndex(step: 1 | -1) {
    const cloneCount = this.cloneCount();
    const count = this.count();
    const activeDomIndex = this.activeDomIndex();
    const from = activeDomIndex < 0 ? cloneCount : activeDomIndex;
    const target = from + step;

    if (target >= 0 && target < this.domCount()) return target;
    if (count === 0) return -1;

    return cloneCount + ((((target - cloneCount) % count) + count) % count);
  }
}
