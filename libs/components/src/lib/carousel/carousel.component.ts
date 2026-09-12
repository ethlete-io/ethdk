import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  ViewEncapsulation,
  afterNextRender,
  booleanAttribute,
  computed,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { RuntimeError, createCanAnimateSignal, injectHostElement } from '@ethlete/core';
import { BUTTON_IMPORTS } from '../button';
import { FocusRingDirective } from '../focus-ring';
import { CHEVRON_ICON, IconDirective, PAUSE_ICON, PLAY_ICON, provideIcons } from '../icon';
import {
  SCROLLABLE_DRAG_IMPORTS,
  SCROLLABLE_IMPORTS,
  ScrollableComponent,
  ScrollableDirective,
  ScrollableItemSize,
} from '../scrollable';
import { CAROUSEL_ERROR_CODES } from './carousel-errors';
import {
  CarouselAutoplayDirective,
  CarouselDirective,
  CarouselItemDirective,
  CarouselNextDirective,
  CarouselPlayToggleDirective,
  CarouselPreviousDirective,
  CarouselSlideContext,
} from './headless';

type CarouselSlideZone = 'lead' | 'real' | 'trail';

type CarouselSlideView = {
  key: string;
  isClone: boolean;
  autoplayTime: number | null;
  context: CarouselSlideContext<unknown>;
};

/**
 * The default carousel: a scroll-snapping track of slides with labelled previous/next controls, slide
 * dots, optional autoplay with the pause control that requires, and seamless looping.
 *
 * It is the [scrollable](/components/scrollable) configured as a carousel, so the sliding is native
 * scrolling - touch swipe, momentum, trackpad and keyboard all come from the platform rather than from a
 * transform this component animates. `itemSize` is what makes it show one slide at a time (the default)
 * or a peeking multi-item view.
 *
 * Slides are **data plus a template**, not elements you project: seamless looping needs each slide
 * rendered more than once - a clone either side of the seam - and a clone has to be a live view rather
 * than a copy of a DOM subtree, or anything interactive inside it would be dead. Binding the slides to the
 * template is also what types it, so `let-slide` is your slide type.
 *
 * The carousel semantics live on this element (it is the `role="region"` labelled as a carousel), and it
 * renders the slide wrapper itself, so slide roles, labels and the clone marking are guaranteed.
 *
 * @example
 * <et-carousel loop autoplay>
 *   <ng-template [etCarouselSlide]="teams()" let-team>
 *     <h3>{{ team.name }}</h3>
 *   </ng-template>
 * </et-carousel>
 */
@Component({
  selector: 'et-carousel',
  templateUrl: './carousel.component.html',
  styleUrl: './carousel.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [
    BUTTON_IMPORTS,
    CarouselItemDirective,
    CarouselNextDirective,
    CarouselPlayToggleDirective,
    CarouselPreviousDirective,
    FocusRingDirective,
    IconDirective,
    NgTemplateOutlet,
    SCROLLABLE_IMPORTS,
    SCROLLABLE_DRAG_IMPORTS,
  ],
  providers: [provideIcons(CHEVRON_ICON, PLAY_ICON, PAUSE_ICON)],
  hostDirectives: [
    {
      directive: CarouselDirective,
      inputs: ['loop', 'labels', 'slideAlign', 'transition', 'transitionDriver'],
    },
    {
      directive: CarouselAutoplayDirective,
      inputs: ['autoplayTime', 'pauseOnHover', 'pauseOnFocus', 'pauseOnOffScreen', 'playOnInit'],
    },
  ],
  host: {
    class: 'et-carousel',
    '[class.et-carousel--can-animate]': 'canAnimate.state()',
  },
})
export class CarouselComponent {
  /** @internal Read from the template; also handy for a consumer reaching in with `viewChild`. */
  public carousel = inject(CarouselDirective);
  private autoplayDirective = inject(CarouselAutoplayDirective);
  private hostElement = injectHostElement();

  /**
   * How much of the track one slide takes: `'full'` (the default) is one slide per view; `'half'`,
   * `'third'` and `'quarter'` show several at once, and `'auto'` lets each slide size itself so the next
   * one peeks in. Accepts the scrollable's per-breakpoint form, so a phone can show one and a desktop three.
   */
  public itemSize = input<ScrollableItemSize | Record<string, ScrollableItemSize>>('full');

  /**
   * Advance the carousel on its own. Opt-in, and it renders the pause control that requires (WCAG 2.2.2)
   * along with the countdown ring around the active dot. @default false
   */
  public autoplay = input(false, { transform: booleanAttribute });

  /** Render the previous/next controls. @default true */
  public showControls = input(true, { transform: booleanAttribute });

  /** Render the slide dots, which double as the autoplay progress indicator. @default true */
  public showDots = input(true, { transform: booleanAttribute });

  public track = viewChild.required(ScrollableComponent, { read: ScrollableDirective });

  /** @internal Held low for the first frames, so the chrome's transitions don't run on arrival. */
  public canAnimate = createCanAnimateSignal();

  protected isAutoplayEnabled = computed(() => this.autoplayDirective.isEnabled());

  protected isAutoplayRunning = computed(() => this.autoplayDirective.isPlaying());

  protected autoplayDuration = computed(() => this.autoplayDirective.duration());

  protected slideTemplate = computed(() => this.carousel.slideTemplate()?.templateRef ?? null);

  protected slideViews = computed<CarouselSlideView[]>(() => {
    const template = this.carousel.slideTemplate();
    const slides = template?.slides() ?? [];
    const count = slides.length;
    const cloneCount = this.carousel.cloneCount();
    const autoplayTimeFor = template?.autoplayTimeFor() ?? null;

    const view = (index: number, zone: CarouselSlideZone): CarouselSlideView => {
      const slide = slides[index];
      const isClone = zone !== 'real';

      return {
        key: `${zone}:${index}`,
        isClone,
        autoplayTime: autoplayTimeFor?.(slide, index) ?? null,
        context: {
          $implicit: slide,
          slide,
          index,
          count,
          first: index === 0,
          last: index === count - 1,
          clone: isClone,
        },
      };
    };

    return [
      ...Array.from({ length: cloneCount }, (_, offset) => view(count - cloneCount + offset, 'lead')),
      ...Array.from({ length: count }, (_, index) => view(index, 'real')),
      ...Array.from({ length: cloneCount }, (_, index) => view(index, 'trail')),
    ];
  });

  protected dots = computed(() => {
    const count = this.carousel.count();
    const activeIndex = this.carousel.activeIndex();
    const labels = this.carousel.resolvedLabels();

    return Array.from({ length: count }, (_, index) => ({
      index,
      isActive: index === activeIndex,
      label: labels.goToSlide(index + 1, count),
    }));
  });

  constructor() {
    // eslint-disable-next-line ethlete/prefer-linked-signal
    effect(() => this.carousel.attachedScrollable.set(this.track()));

    // eslint-disable-next-line ethlete/prefer-linked-signal
    effect(() => this.autoplayDirective.enabledOverride.set(this.autoplay()));

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.carousel.slideTemplate()) {
          throw new RuntimeError(
            CAROUSEL_ERROR_CODES.MISSING_SLIDE_TEMPLATE,
            '[CarouselComponent] <et-carousel> renders its slides from data and a template, and was given ' +
              'neither. Add one: <ng-template [etCarouselSlide]="slides()" let-slide>…</ng-template>.',
            { element: this.hostElement },
          );
        }
      });
    }
  }
}
