import {
  Component,
  ViewEncapsulation,
  booleanAttribute,
  computed,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { BUTTON_IMPORTS } from '../button';
import { CHEVRON_ICON, IconDirective, PAUSE_ICON, PLAY_ICON, provideIcons } from '../icon';
import { SCROLLABLE_IMPORTS, ScrollableComponent, ScrollableDirective, ScrollableItemSize } from '../scrollable';
import {
  CarouselAutoplayDirective,
  CarouselDirective,
  CarouselNextDirective,
  CarouselPlayToggleDirective,
  CarouselPreviousDirective,
} from './headless';

/**
 * The default carousel: a scroll-snapping track of slides with labelled previous/next controls, slide
 * dots, and optional autoplay with the pause control that requires.
 *
 * It is the [scrollable](/components/scrollable) configured as a carousel, so the sliding is native
 * scrolling — touch swipe, momentum, trackpad and keyboard all come from the platform rather than from a
 * transform this component animates. `itemSize` is what makes it show one slide at a time (the default)
 * or a peeking multi-item view.
 *
 * The carousel semantics live on this element (it is the `role="region"` labelled as a carousel), which is
 * also what lets the slides you project into it find the carousel they belong to.
 *
 * @example
 * <et-carousel autoplay>
 *   <div etCarouselItem>…</div>
 *   <div etCarouselItem>…</div>
 * </et-carousel>
 */
@Component({
  selector: 'et-carousel',
  templateUrl: './carousel.component.html',
  styleUrl: './carousel.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [
    BUTTON_IMPORTS,
    CarouselNextDirective,
    CarouselPlayToggleDirective,
    CarouselPreviousDirective,
    IconDirective,
    SCROLLABLE_IMPORTS,
  ],
  providers: [provideIcons(CHEVRON_ICON, PLAY_ICON, PAUSE_ICON)],
  hostDirectives: [
    {
      directive: CarouselDirective,
      inputs: ['loop', 'labels', 'transition'],
    },
    {
      // `autoplay` is this directive's `enabled`: the carousel always has the directive, and the input
      // decides whether it ever plays. Its host listeners then cover the controls too, so hovering the
      // pause button pauses just as hovering a slide does.
      directive: CarouselAutoplayDirective,
      inputs: ['enabled: autoplay', 'autoplayTime', 'pauseOnHover', 'pauseOnFocus', 'pauseOnOffScreen', 'playOnInit'],
    },
  ],
  host: {
    class: 'et-carousel',
  },
})
export class CarouselComponent {
  /** @internal Read from the template; also handy for a consumer reaching in with `viewChild`. */
  public carousel = inject(CarouselDirective);
  private autoplayDirective = inject(CarouselAutoplayDirective);

  /**
   * How much of the track one slide takes: `'full'` (the default) is one slide per view; `'half'`,
   * `'third'` and `'quarter'` show several at once, and `'auto'` lets each slide size itself so the next
   * one peeks in. Accepts the scrollable's per-breakpoint form, so a phone can show one and a desktop three.
   */
  public itemSize = input<ScrollableItemSize | Record<string, ScrollableItemSize>>('full');

  /** Render the previous/next controls. @default true */
  public showControls = input(true, { transform: booleanAttribute });

  /** Render the slide dots, which double as the autoplay progress indicator. @default true */
  public showDots = input(true, { transform: booleanAttribute });

  // The scrollable is a descendant, so the carousel directive can't inject it — it gets handed over.
  public track = viewChild.required(ScrollableComponent, { read: ScrollableDirective });

  protected isAutoplayEnabled = computed(() => this.autoplayDirective.enabled());

  /** Whether a slide is counting down right now — which is when the progress ring exists. */
  protected isAutoplayRunning = computed(() => this.autoplayDirective.isPlaying());

  protected autoplayDuration = computed(() => this.autoplayDirective.duration());

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
    // Not a linkedSignal: the value is derived from this component's view, but it has to be pushed into
    // the *directive's* signal — the one place that can see the track — which only an effect can do.
    // eslint-disable-next-line ethlete/prefer-linked-signal
    effect(() => this.carousel.attachedScrollable.set(this.track()));
  }
}
