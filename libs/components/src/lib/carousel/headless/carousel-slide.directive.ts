import { DestroyRef, Directive, Signal, TemplateRef, inject, input } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { CAROUSEL_ERROR_CODES } from '../carousel-errors';
import { CAROUSEL_TOKEN } from './carousel.tokens';

/** What a slide template is handed for each slide it renders. */
export type CarouselSlideContext<T> = {
  /** The slide — what a bare `let-slide` binds to. */
  $implicit: T;
  /** The slide again, for `let-slide="slide"`. */
  slide: T;
  /** Its position in the slides array. A loop clone reports the index of the slide it clones. */
  index: number;
  /** How many slides the carousel holds. Clones are not among them. */
  count: number;
  /** Whether this is the first slide. */
  first: boolean;
  /** Whether this is the last slide. */
  last: boolean;
  /**
   * Whether this rendering is a loop clone rather than the slide itself. Clones are hidden from
   * assistive technology and taken out of the tab order, so a template rarely needs this — it is here
   * for the rare piece that must not run twice (a video, an analytics beacon).
   */
  clone: boolean;
};

/**
 * The template `<et-carousel>` stamps once per slide. Slides are data plus this template rather than
 * elements you project, because seamless looping needs the carousel to render each slide **more than
 * once** — a clone either side of the seam — and a clone has to be a live view with working bindings,
 * not a copy of a DOM subtree.
 *
 * Bind the slides to the directive itself. That is also what types the template: `let-slide` is your
 * slide type, inferred, not declared.
 *
 * @example
 * <et-carousel loop>
 *   <ng-template [etCarouselSlide]="teams()" let-team let-index="index">
 *     <h3>{{ index + 1 }}. {{ team.name }}</h3>
 *   </ng-template>
 * </et-carousel>
 */
@Directive({
  selector: 'ng-template[etCarouselSlide]',
  exportAs: 'etCarouselSlide',
})
export class CarouselSlideDirective<T> {
  private carousel = inject(CAROUSEL_TOKEN, { optional: true });

  /** @internal The template itself, stamped by whoever renders the slides. */
  public templateRef = inject<TemplateRef<CarouselSlideContext<T>>>(TemplateRef);

  /** The slides to render, one stamp of this template each. */
  public slides = input.required<readonly T[]>({ alias: 'etCarouselSlide' });

  /**
   * How long autoplay rests on a given slide, overriding the carousel's `autoplayTime` — for the one
   * slide carrying a paragraph rather than a picture. Return `null` to use the carousel's duration.
   *
   * It lives here rather than on `<et-carousel>` because this is where the slide type is: the callback's
   * argument is your slide, inferred from the same binding as `let-slide`.
   *
   * @example
   * <ng-template [etCarouselSlide]="teams()" [autoplayTimeFor]="restLongerOnText" let-team>
   */
  public autoplayTimeFor = input<((slide: T, index: number) => number | null) | null>(null);

  constructor() {
    const carousel = this.carousel;

    if (!carousel) {
      if (ngDevMode) {
        throw new RuntimeError(
          CAROUSEL_ERROR_CODES.PART_OUTSIDE_CAROUSEL,
          '[CarouselSlideDirective] etCarouselSlide must be used on an <ng-template> inside an <et-carousel>.',
        );
      }

      return;
    }

    const registration: CarouselSlideTemplateRef = {
      templateRef: this.templateRef,
      slides: this.slides,
      autoplayTimeFor: this.autoplayTimeFor,
    };

    carousel.slideTemplate.set(registration);

    inject(DestroyRef).onDestroy(() => {
      if (carousel.slideTemplate() === registration) {
        carousel.slideTemplate.set(null);
      }
    });
  }

  // static on purpose (the lint ban excepts it): Angular's template type checker requires the context
  // guard to be static — it types the `let-` bindings of the host ng-template.
  public static ngTemplateContextGuard<T>(
    _directive: CarouselSlideDirective<T>,
    _context: unknown,
  ): _context is CarouselSlideContext<T> {
    return true;
  }
}

/**
 * @internal What the carousel needs from a registered slide template. The slide type is the
 * consumer's, and the carousel only forwards it, so it is deliberately erased here.
 */
export type CarouselSlideTemplateRef = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  templateRef: TemplateRef<any>;
  slides: Signal<readonly unknown[]>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  autoplayTimeFor: Signal<((slide: any, index: number) => number | null) | null>;
};
