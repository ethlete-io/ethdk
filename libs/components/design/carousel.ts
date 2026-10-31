import iconButtonBase from '../src/lib/button/icon-button.component.css?inline';
import autoplayBase from '../src/lib/carousel/carousel-autoplay-styles.component.css?inline';
import carouselBase from '../src/lib/carousel/carousel.component.css?inline';
import { CHEVRON_ICON } from '../src/lib/icon/headless/chevron-icon';
import iconBase from '../src/lib/icon/headless/icon-styles.component.css?inline';
import { PAUSE_ICON } from '../src/lib/icon/headless/pause-icon';
import { PLAY_ICON } from '../src/lib/icon/headless/play-icon';
import scrollableBase from '../src/lib/scrollable/scrollable.component.css?inline';
import { buttonStyles } from './button';
import { iconMarkup } from './icon';
import { scrollable } from './scrollable';

export type CarouselMockSlide = {
  /** The slide's inner HTML, as the consumer's slide template renders it. */
  content: string;
};

export type CarouselMockOptions = {
  slides: CarouselMockSlide[];
  /** The index of the active slide. Left out, 0. */
  active?: number;
  /** Left out, `full`: one slide at a time. */
  itemSize?: 'full' | 'half' | 'third';
  /** Left out, true, as the `loop` input defaults to. Looping draws the clones and never disables the arrows. */
  loop?: boolean;
  slideAlign?: 'start' | 'center';
  /** The gap between the slides in px, set as `--et-carousel-slide-gap`. Left out, 0. */
  slideGap?: number;
  /** Left out, true. */
  showControls?: boolean;
  /** Left out, true. */
  showDots?: boolean;
  /** Draws the play toggle and the countdown ring. */
  autoplay?: boolean;
  /** Whether autoplay runs: the toggle shows pause and the active dot counts down. Left out, true while `autoplay` is on. */
  playing?: boolean;
  /** The slide's autoplay time in ms. Left out, 5000. */
  autoplayTime?: number;
  /** Where the countdown ring is held, as a fraction of the slide's time. Left out, 0.4. */
  autoplayProgress?: number;
  /** Extra attributes on the previous button, e.g. design markers. */
  previousAttributes?: string;
  /** Extra attributes on the next button, e.g. design markers. */
  nextAttributes?: string;
  /** Extra attributes on the play toggle, e.g. design markers. */
  playToggleAttributes?: string;
  /** Extra attributes on a dot, by index, e.g. design markers. */
  dotAttributes?: Record<number, string>;
  /** A color theme name the app registers. Left out, the carousel takes the color theme around it. */
  color?: string;
  /** Extra attributes on the host, e.g. a style or design markers. */
  attributes?: string;
  /** Extra attributes on the track's scroll container, e.g. design markers. */
  trackAttributes?: string;
};

const PER_VIEW = { full: 1, half: 2, third: 3 };

/** The stylesheets `carousel()` draws with: the real carousel, autoplay, scrollable and icon-button CSS, plus the rules that hold the countdown at one frame. */
export const carouselStyles = /* @__PURE__ */ [
  buttonStyles,
  iconBase,
  iconButtonBase,
  scrollableBase,
  carouselBase,
  autoplayBase,
  `.et-carousel .et-carousel-dot[data-et-frozen-at] .et-carousel-dot-progress-half::before {
  animation-play-state: paused;
  animation-delay: calc(var(--et-carousel-frozen-at) * -1 * var(--_et-carousel-autoplay-duration));
}
.et-carousel .et-carousel-dot[data-et-frozen-at] .et-carousel-dot-progress-half:last-child::before {
  animation-delay: calc((0.5 - var(--et-carousel-frozen-at)) * var(--_et-carousel-autoplay-duration));
}`,
].join('\n');

type ControlOptions = { classes: string[]; label: string; disabled: boolean; icons: string; attributes?: string };

const control = ({ classes, label, disabled, icons, attributes }: ControlOptions) => {
  const hostClasses = [
    'et-carousel-control',
    ...classes,
    'et-icon-button',
    'et-color-interactive',
    'et-focus-ring',
    'et-color--inherited',
  ];
  const host = [
    attributes,
    `class="${hostClasses.join(' ')}"`,
    'type="button"',
    `aria-label="${label}"`,
    disabled && 'aria-disabled="true"',
    'data-variant="transparent"',
    'data-size="sm"',
  ].filter(Boolean);

  return `<button ${host.join(' ')}><div class="et-icon-button-icon">${icons}</div></button>`;
};

/**
 * Draws `<et-carousel>` as HTML: the scrollable track with its slides (and the clones a looping carousel adds), the
 * previous and next buttons, the dots and the autoplay toggle with its countdown ring. The active slide is brought
 * into view by translating the slides statically.
 */
export const carousel = (options: CarouselMockOptions) => {
  const count = options.slides.length;
  const active = Math.min(Math.max(options.active ?? 0, 0), Math.max(count - 1, 0));
  const itemSize = options.itemSize ?? 'full';
  const perView = PER_VIEW[itemSize];
  const loop = options.loop ?? true;
  const slideAlign = options.slideAlign ?? 'start';
  const gap = options.slideGap ?? 0;
  const autoplay = options.autoplay ?? false;
  const playing = autoplay && (options.playing ?? true);
  const autoplayTime = options.autoplayTime ?? 5000;
  const cloneCount = loop && count > perView ? Math.min(count, perView + 1) : 0;
  const looping = cloneCount > 0;
  const firstInView = looping ? cloneCount + active : Math.min(active, Math.max(count - perView, 0));
  const shift = slideAlign === 'center' && itemSize !== 'full' ? cloneCount + active - (perView - 1) / 2 : firstInView;
  const atStart = !looping && firstInView === 0;
  const atEnd = !looping && firstInView >= count - perView;
  const canGoPrevious = count > 1 && (loop || !atStart);
  const canGoNext = count > 1 && (loop || !atEnd);

  const slideItem = (index: number, isClone: boolean) => {
    const attributes = [
      'class="et-carousel-item"',
      'role="group"',
      'aria-roledescription="slide"',
      `aria-label="${index + 1} of ${count}"`,
      isClone && 'aria-hidden="true" inert="" data-clone=""',
      !isClone && index === active && 'data-active=""',
      shift !== 0 && `style="translate: calc(${-shift} * (100% + ${gap}px)) 0"`,
    ].filter(Boolean);

    return {
      attributes: attributes.join(' '),
      content: `<div class="et-carousel-slide-content">${options.slides[index]?.content ?? ''}</div>`,
    };
  };

  const items = [
    ...Array.from({ length: cloneCount }, (_, offset) => slideItem(count - cloneCount + offset, true)),
    ...Array.from({ length: count }, (_, index) => slideItem(index, false)),
    ...Array.from({ length: cloneCount }, (_, index) => slideItem(index, true)),
  ];

  const track = scrollable({
    items,
    canScroll: count > perView,
    position: atStart ? 'start' : atEnd ? 'end' : 'middle',
    renderMasks: false,
    snap: true,
    itemSize,
    itemGap: gap,
    class: 'et-carousel-track',
    containerAttributes: options.trackAttributes,
  });

  const progressAttributes = [
    'class="et-carousel-dot-progress"',
    'aria-hidden="true"',
    `style="--_et-carousel-autoplay-duration: ${autoplayTime}ms"`,
  ];
  const progress = autoplay
    ? `<span ${progressAttributes.join(' ')}>` +
      `<span class="et-carousel-dot-progress-half"></span><span class="et-carousel-dot-progress-half"></span></span>`
    : '';

  const dots = Array.from({ length: count }, (_, index) => {
    const isActive = index === active;
    const counting = isActive && playing;
    const attributes = [
      options.dotAttributes?.[index],
      'class="et-carousel-dot et-focus-ring"',
      'type="button"',
      `aria-label="Go to slide ${index + 1}"`,
      isActive && 'aria-current="true" data-active=""',
      counting && 'data-counting=""',
      counting && `data-et-frozen-at="" style="--et-carousel-frozen-at: ${options.autoplayProgress ?? 0.4}"`,
    ].filter(Boolean);

    return `<button ${attributes.join(' ')}>${progress}</button>`;
  }).join('');

  const showControls = options.showControls ?? true;
  const showDots = options.showDots ?? true;

  const controls = [
    showControls &&
      control({
        classes: [],
        label: 'Previous slide',
        disabled: !canGoPrevious,
        icons: iconMarkup(CHEVRON_ICON, 'et-carousel-control-icon et-carousel-control-icon--previous'),
        attributes: options.previousAttributes,
      }),
    showDots && `<div class="et-carousel-dots">${dots}</div>`,
    autoplay &&
      control({
        classes: ['et-carousel-play-toggle'],
        label: playing ? 'Pause automatic slide show' : 'Start automatic slide show',
        disabled: false,
        icons:
          iconMarkup(PLAY_ICON, 'et-carousel-control-icon et-carousel-play-toggle-icon') +
          iconMarkup(PAUSE_ICON, 'et-carousel-control-icon et-carousel-play-toggle-icon'),
        attributes: [options.playToggleAttributes, playing && 'data-playing=""'].filter(Boolean).join(' '),
      }),
    showControls &&
      control({
        classes: [],
        label: 'Next slide',
        disabled: !canGoNext,
        icons: iconMarkup(CHEVRON_ICON, 'et-carousel-control-icon et-carousel-control-icon--next'),
        attributes: options.nextAttributes,
      }),
  ].filter(Boolean);

  const host = [
    options.attributes,
    `class="${['et-carousel', options.color && `et-color--${options.color}`].filter(Boolean).join(' ')}"`,
    'role="region"',
    'aria-roledescription="carousel"',
    'aria-label="Carousel"',
    `data-slide-align="${slideAlign}"`,
    'data-transition="none"',
    looping && 'data-looping=""',
    playing && 'data-autoplaying=""',
    gap && `style="--et-carousel-slide-gap: ${gap}px"`,
  ].filter(Boolean);

  return (
    `<et-carousel ${host.join(' ')}>${track}` +
    (controls.length ? `<div class="et-carousel-controls">${controls.join('')}</div>` : '') +
    `</et-carousel>`
  );
};
