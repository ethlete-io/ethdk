import {
  DestroyRef,
  Directive,
  ElementRef,
  afterNextRender,
  booleanAttribute,
  computed,
  inject,
  input,
} from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { CAROUSEL_ERROR_CODES } from '../carousel-errors';
import { CAROUSEL_TOKEN } from './carousel.tokens';

/** `null` for "use the carousel's duration", a number of milliseconds otherwise. */
const autoplayTimeAttribute = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * One slide. It carries the slide semantics - `role="group"` with `aria-roledescription="slide"` and an
 * `N of M` label - so a screen reader user knows how far along the carousel they are.
 *
 * `<et-carousel>` renders this wrapper itself, once per slide of its `etCarouselSlide` template, which is
 * what guarantees the semantics and the clone marking rather than leaving them to be remembered. Reach for
 * the directive directly when building a carousel over a bare scrollable.
 *
 * Slides are **not** hidden or `inert` while off screen, unlike a carousel that stacks its slides: this
 * one scrolls, so an off-screen slide is reachable by scrolling or by tabbing into it (which scrolls it
 * into view). Hiding them would take that away. A loop *clone* is a different matter - it is the same
 * slide a second time, so it is hidden and skipped.
 *
 * @example
 * <div etCarouselItem>…</div>
 * <div etCarouselItem [autoplayTime]="8000">a slide that needs longer to read</div>
 */
@Directive({
  selector: '[etCarouselItem]',
  exportAs: 'etCarouselItem',
  host: {
    class: 'et-carousel-item',
    role: 'group',
    'aria-roledescription': 'slide',
    '[attr.aria-label]': 'label()',
    '[attr.aria-hidden]': 'isClone() ? "true" : null',
    '[attr.inert]': 'isClone() ? "" : null',
    '[attr.data-clone]': 'isClone() ? "" : null',
    '[attr.data-active]': 'isActive() ? "" : null',
  },
})
export class CarouselItemDirective {
  private carousel = inject(CAROUSEL_TOKEN, { optional: true });
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  /**
   * How long autoplay rests on this slide, overriding the carousel's `autoplayTime` - for the one slide
   * carrying a paragraph rather than a picture. `null` uses the carousel's duration. `<et-carousel>` sets
   * it from its own `autoplayTimeFor`. @default null
   */
  public autoplayTime = input<number | null>(null, { transform: autoplayTimeAttribute });

  /**
   * Whether this is a loop clone rather than the slide itself - the same slide rendered a second time so
   * the carousel has content on both sides of the seam. A clone is hidden from assistive technology,
   * taken out of the tab order, and left out of the slide count and the `N of M` labels, so looping costs
   * a reader nothing. Set by `<et-carousel>`. @default false
   */
  public isClone = input(false, { transform: booleanAttribute });

  /**
   * This slide's position among the track's children, clones included, and from the DOM rather than from
   * registration order - so a `@for` that reorders its items can't put the labels out of step with what
   * is on screen.
   */
  public domIndex = computed(() => {
    const children = this.carousel?.scrollable()?.scrollableChildren() ?? [];

    return children.indexOf(this.elementRef.nativeElement);
  });

  /** Which slide this shows: itself, or - for a clone - the slide it clones. */
  public index = computed(() => this.carousel?.slideIndexOf(this.domIndex()) ?? -1);

  /**
   * Whether this is the element currently in view. A clone of the current slide is the one that reports
   * it, not the original: this marks what is on screen.
   */
  public isActive = computed(() => this.domIndex() >= 0 && this.domIndex() === this.carousel?.activeDomIndex());

  /** The `N of M` label announced with the slide. Clones announce nothing - they are the same slide again. */
  public label = computed(() => {
    const carousel = this.carousel;

    if (!carousel || this.isClone()) return null;

    const index = this.index();

    return index < 0 ? null : carousel.resolvedLabels().slide(index + 1, carousel.count());
  });

  constructor() {
    const carousel = this.carousel;

    if (carousel) {
      carousel.registerItem(this);

      inject(DestroyRef).onDestroy(() => carousel.unregisterItem(this));
    }

    if (ngDevMode) {
      afterNextRender(() => {
        if (!carousel) {
          throw new RuntimeError(
            CAROUSEL_ERROR_CODES.PART_OUTSIDE_CAROUSEL,
            '[CarouselItemDirective] etCarouselItem must be placed inside an [etCarousel] element (e.g. <et-carousel>).',
            { element: this.elementRef.nativeElement },
          );
        }
      });
    }
  }
}
