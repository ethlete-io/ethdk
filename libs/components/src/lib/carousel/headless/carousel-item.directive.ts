import { DestroyRef, Directive, ElementRef, afterNextRender, computed, inject, input } from '@angular/core';
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
 * One slide. It carries the slide semantics — `role="group"` with `aria-roledescription="slide"` and an
 * `N of M` label — so a screen reader user knows how far along the carousel they are.
 *
 * Slides are **not** hidden or `inert` while off screen, unlike a carousel that stacks its slides: this
 * one scrolls, so an off-screen slide is reachable by scrolling or by tabbing into it (which scrolls it
 * into view). Hiding them would take that away.
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
    '[attr.data-active]': 'isActive() ? "" : null',
  },
})
export class CarouselItemDirective {
  private carousel = inject(CAROUSEL_TOKEN, { optional: true });
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  /**
   * How long autoplay rests on this slide, overriding the carousel's `autoplayTime` — for the one slide
   * carrying a paragraph rather than a picture. `null` uses the carousel's duration. @default null
   */
  public autoplayTime = input<number | null>(null, { transform: autoplayTimeAttribute });

  /**
   * This slide's position among the carousel's slides, from the DOM rather than from registration order —
   * so a `@for` that reorders its items can't put the labels out of step with what is on screen.
   */
  public index = computed(() => {
    const children = this.carousel?.scrollable()?.scrollableChildren() ?? [];

    return children.indexOf(this.elementRef.nativeElement);
  });

  /** Whether this slide is the one currently in view. */
  public isActive = computed(() => this.index() >= 0 && this.index() === this.carousel?.activeIndex());

  /** The `N of M` label announced with the slide. */
  public label = computed(() => {
    const carousel = this.carousel;

    if (!carousel) return null;

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
          );
        }
      });
    }
  }
}
