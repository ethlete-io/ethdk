import { carousel, carouselStyles, type CarouselMockOptions } from '@ethlete/components/design/carousel';
import { definePart, drawing } from '@design-system';
import frame from './carousel.css?inline';

type Interaction = 'hover' | 'active' | 'focus-visible';

type Props = Omit<CarouselMockOptions, 'slides'> & {
  count?: number;
  longCaption?: boolean;
  previous?: Interaction;
  next?: Interaction;
  playToggle?: Interaction;
  dot?: { index: number; interaction: Interaction };
};

const TITLES = ['Kick-off', 'First half', 'Half time', 'Second half', 'Full time'];
const LONG_CAPTION =
  'A long caption that wraps over several lines inside the slide, the way a match report teaser runs on past a single line of text.';

const force = (interaction: Interaction | undefined) => (interaction ? `data-et-force="${interaction}"` : undefined);

const slideContent = (index: number, count: number, longCaption: boolean) =>
  `<div class="carousel-slide"><p class="carousel-slide-title">${index + 1}. ${TITLES[index % TITLES.length]}</p>` +
  `<p>${longCaption && index === 0 ? LONG_CAPTION : 'A short line about the slide.'}</p>` +
  `<p class="carousel-slide-meta">slide ${index + 1} of ${count}</p></div>`;

const render = ({ count = 5, longCaption = false, previous, next, playToggle, dot, ...options }: Props) =>
  carousel({
    ...options,
    slides: Array.from({ length: count }, (_, index) => ({ content: slideContent(index, count, longCaption) })),
    previousAttributes: force(previous),
    nextAttributes: force(next),
    playToggleAttributes: force(playToggle),
    dotAttributes: dot ? { [dot.index]: `data-et-force="${dot.interaction}"` } : undefined,
    trackAttributes: 'data-et-skip="CLIPPED"',
  }).replaceAll(
    'class="et-carousel-dot-progress-half"',
    'data-et-skip="CLIPPED" class="et-carousel-dot-progress-half"',
  );

export default definePart({
  note: 'scale of the decided shape, Q182, lead merge',
  madeBy: ['claude-opus-5-5'],
  states: {
    'first-slide': {},
    'middle-slide': { active: 2 },
    'last-slide': { active: 4 },
    'no-loop-first': { loop: false },
    'no-loop-last': { loop: false, active: 4 },
    'next-hover': { active: 2, next: 'hover' },
    'next-active': { active: 2, next: 'active' },
    'next-focus-visible': { active: 2, next: 'focus-visible' },
    'dot-hover': { active: 2, dot: { index: 3, interaction: 'hover' } },
    'active-dot-hover': { active: 2, dot: { index: 2, interaction: 'hover' } },
    'dot-focus-visible': { active: 2, dot: { index: 3, interaction: 'focus-visible' } },
    'active-dot-focus-visible': { active: 2, dot: { index: 2, interaction: 'focus-visible' } },
    'autoplay-playing': { active: 1, autoplay: true },
    'autoplay-paused': { active: 1, autoplay: true, playing: false },
    'play-toggle-hover': { active: 1, autoplay: true, playToggle: 'hover' },
    'play-toggle-focus-visible': { active: 1, autoplay: true, playToggle: 'focus-visible' },
    'multiple-items': { itemSize: 'half', slideGap: 16, active: 1 },
    'item-size-third': { itemSize: 'third', slideGap: 16, active: 1 },
    'center-aligned': { itemSize: 'half', slideGap: 16, slideAlign: 'center', active: 2 },
    'no-controls': { active: 1, showControls: false },
    'long-caption': { longCaption: true },
    'single-slide': { count: 1 },
  },
  widths: [480],
  render: (props: Props) =>
    drawing({
      body: `<div class="carousel-frame">${render(props)}</div>`,
      styles: [carouselStyles, frame].join('\n'),
    }),
});
