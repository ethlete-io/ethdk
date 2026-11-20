import { carousel, carouselStyles, type CarouselMockOptions } from '@ethlete/components/design/carousel';
import { definePart, drawing, interactionRows } from '@design-system';
import frame from './carousel.css?inline';

type Interaction = 'hover' | 'active' | 'focus-visible';

type Props = Omit<CarouselMockOptions, 'slides'> & {
  count?: number;
  longCaption?: boolean;
  previous?: Interaction;
  next?: Interaction;
  playToggle?: Interaction;
  dot?: { index: number; interaction?: Interaction };
};

const TITLES = ['Kick-off', 'First half', 'Half time', 'Second half', 'Full time'];
const LONG_CAPTION =
  'A long caption that wraps over several lines inside the slide, the way a match report teaser runs on past a single line of text.';

const mark = (name: string, action: string) => `data-et-control="${name}" data-et-action="${action}" data-can-animate`;

const INDEX_CHANGE = 'emit:activeIndexChange';

const force = (interaction: Interaction | undefined) => (interaction ? `data-et-force="${interaction}"` : '');

const slideContent = (index: number, count: number, longCaption: boolean) =>
  `<div class="carousel-slide"><p class="carousel-slide-title">${index + 1}. ${TITLES[index % TITLES.length]}</p>` +
  `<p>${longCaption && index === 0 ? LONG_CAPTION : 'A short line about the slide.'}</p>` +
  `<p class="carousel-slide-meta">slide ${index + 1} of ${count}</p></div>`;

const render = ({ count = 5, longCaption = false, previous, next, playToggle, dot, ...options }: Props) =>
  carousel({
    ...options,
    slides: Array.from({ length: count }, (_, index) => ({ content: slideContent(index, count, longCaption) })),
    previousAttributes: `${mark('arrow', INDEX_CHANGE)} ${force(previous)}`,
    nextAttributes: `${mark('arrow', INDEX_CHANGE)} ${force(next)}`,
    playToggleAttributes: `${mark('play-toggle', options.playing === false ? 'autoplay-playing' : 'autoplay-paused')} ${force(playToggle)}`,
    dotAttributes: Object.fromEntries(
      Array.from({ length: count }, (_, index) => [
        index,
        `${mark('dot', INDEX_CHANGE)} ${dot?.index === index ? force(dot.interaction) : ''}`,
      ]),
    ),
  }).replaceAll(
    'class="et-carousel-dot-progress-half"',
    'data-et-skip="CLIPPED" class="et-carousel-dot-progress-half"',
  );

const { states: interactionStates, grid } = interactionRows<Props, 'arrow' | 'dot' | 'play-toggle', Interaction>(
  {
    arrow: { active: 2 },
    dot: { active: 2, dot: { index: 3 } },
    'play-toggle': { active: 1, autoplay: true },
  },
  {
    interactions: ['hover', 'active', 'focus-visible'],
    force: (props, interaction) => ({
      ...props,
      ...(props.dot ? { dot: { ...props.dot, interaction } } : {}),
      ...(props.autoplay ? { playToggle: interaction } : {}),
      ...(!props.dot && !props.autoplay ? { next: interaction } : {}),
    }),
  },
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
    ...interactionStates,
    'active-dot-hover': { active: 2, dot: { index: 2, interaction: 'hover' } },
    'active-dot-focus-visible': { active: 2, dot: { index: 2, interaction: 'focus-visible' } },
    'autoplay-playing': { active: 1, autoplay: true },
    'autoplay-paused': { active: 1, autoplay: true, playing: false },
    'multiple-items': { itemSize: 'half', slideGap: 16, active: 1 },
    'item-size-third': { itemSize: 'third', slideGap: 16, active: 1 },
    'center-aligned': { itemSize: 'half', slideGap: 16, slideAlign: 'center', active: 2 },
    'no-controls': { active: 1, showControls: false },
    'long-caption': { longCaption: true },
    'single-slide': { count: 1 },
  },
  describe: {
    arrow: 'The next arrow at rest; check its tint and size against the hover, pressed and focus looks.',
    'arrow-hover': 'The next arrow hovered; check its hover tint.',
    'arrow-active': 'The next arrow pressed; check that it goes past hover.',
    'arrow-focus-visible': 'The next arrow with keyboard focus; check the focus ring around it.',
    dot: 'The fourth dot at rest; check its tint and size against the hover, pressed and focus looks.',
    'dot-hover': 'The fourth dot hovered; check its hover tint.',
    'dot-active': 'The fourth dot pressed; check that it goes past hover.',
    'dot-focus-visible': 'The fourth dot with keyboard focus; check the focus ring around the dot.',
    'play-toggle': 'The play toggle at rest; check its tint and size against the hover, pressed and focus looks.',
    'play-toggle-hover': 'The play toggle hovered; check its hover tint.',
    'play-toggle-active': 'The play toggle pressed; check that it goes past hover.',
    'play-toggle-focus-visible': 'The play toggle with keyboard focus; check the focus ring around it.',
    'first-slide': 'The first of five slides with arrows and dots; check that the first dot is active.',
    'middle-slide': 'The third slide active; check that the third dot is active and both arrows show.',
    'last-slide': 'The fifth slide active; check the last dot and that next still shows for the loop.',
    'no-loop-first': 'The first slide without loop; check that previous is disabled.',
    'no-loop-last': 'The last slide without loop; check that next is disabled.',
    'active-dot-hover': 'The active dot hovered; check that it keeps its active look.',
    'active-dot-focus-visible': 'The active dot with keyboard focus; check the ring around the active dot.',
    'autoplay-playing':
      'Autoplay running on the second slide; check the pause toggle and the progress in the active dot.',
    'autoplay-paused': 'Autoplay paused; check the play icon and the halted progress.',
    'multiple-items': 'Two slides per view with a 16 px gap; check the gap and that both slides show whole.',
    'item-size-third': 'Three slides per view; check that the slides share the width evenly.',
    'center-aligned': 'Half-width slides centred on the third; check that the active slide sits in the middle.',
    'no-controls': 'The carousel without arrows and dots; check that only the slide shows.',
    'long-caption': 'A slide with a caption over several lines; check that the text wraps inside the slide.',
    'single-slide': 'A carousel with one slide; check how arrows and dots show with nothing to move to.',
  },
  grid,
  omits: [
    {
      option: 'itemSize',
      value: 'full',
      reason: 'The default size, which every other state draws without setting it.',
    },
    { option: 'itemSize', value: 'half', reason: 'Drawn as the multiple-items state, outside the grid.' },
    { option: 'itemSize', value: 'third', reason: 'Drawn as the item-size-third state, outside the grid.' },
    {
      option: 'slideAlign',
      value: 'start',
      reason: 'The default alignment, which every other state draws without setting it.',
    },
    { option: 'slideAlign', value: 'center', reason: 'Drawn as the center-aligned state, outside the grid.' },
  ],
  controls: {
    arrow: { kind: 'button', input: ['pointer', 'keyboard'], disabled: true },
    dot: { kind: 'button', input: ['pointer', 'keyboard'] },
    'play-toggle': { kind: 'button', input: ['pointer', 'keyboard'] },
  },
  widths: [480],
  frame: (body) => `<div class="carousel-frame">${body}</div>`,
  scrolls: [
    ...(Object.keys(interactionStates) as (keyof typeof interactionStates)[]),
    'first-slide',
    'middle-slide',
    'last-slide',
    'no-loop-first',
    'no-loop-last',
    'active-dot-hover',
    'active-dot-focus-visible',
    'autoplay-playing',
    'autoplay-paused',
    'multiple-items',
    'item-size-third',
    'center-aligned',
    'no-controls',
    'long-caption',
  ],
  render: (props: Props) =>
    drawing({
      body: render(props),
      styles: [carouselStyles, frame].join('\n'),
    }),
});
