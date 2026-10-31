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
  note: "The SDK carousel (et-carousel), first drawing, drawn by its mock from @ethlete/components/design with its real markup and CSS: the et-scrollable track (itemSize full by default, no masks, snap), the slides with the clones a looping carousel adds, the controls row with the previous and next buttons (transparent sm et-icon-buttons with a chevron in the theme ink), the dots (8px in a 24px target, 35% surface-interaction, the active one in the theme primary) and, with autoplay, the play/pause toggle and the countdown ring around the active dot (2.5px, theme primary over a 30% surface-interaction track), held at 40% of the slide's time. Framed as its story does (24px padding, surface fill, slides at least 200px tall with 12px corners, title, line and 'slide n of m'), with neutral slides (14% surface ink) in place of the story's surface fill plus a fixed white/15 border. The active slide is brought into view by translating the slides statically, so the track's scroll container carries data-et-skip=CLIPPED; the countdown halves clip their half-discs on purpose (data-et-skip=CLIPPED). What the lib does: loop defaults to true, so the arrows never disable while there is more than one slide; with loop off the arrow at an end gets aria-disabled and 40% opacity; a single slide disables both arrows and still shows one dot. Every control carries et-focus-ring: a 2px outline 3px out, in the theme primary. Hover on an arrow is a 5% primary tint; hover on a dot darkens it to 55%, the active dot keeps primary. slideAlign center with partial slides fades the track edges over 32px. States: first-slide, middle-slide, last-slide, no-loop-first, no-loop-last (disabled ends), next-hover, next-active, next-focus-visible, dot-hover, active-dot-hover, dot-focus-visible, active-dot-focus-visible, autoplay-playing, autoplay-paused, play-toggle-hover, play-toggle-focus-visible, multiple-items (half, 16px gap), center-aligned (half, centred, edge fade), no-controls (showControls off), long-caption, single-slide. Numbers (light / dark), from shot pixels at scale 2: active dot vs page 1.33 / 13.50; inactive dot 1.57 / 1.93; chevron and pause icon 5.48 / 13.50; disabled chevron 1.30 / 3.09; arrow hover tint vs page 1.04 / 1.17, chevron on it 7.68 / 13.50; arrow focus ring 1.37 / 13.06; dot focus ring 1.33 / 13.50; countdown fill 1.33 / 13.50, its track 1.47 / 1.76; slide vs page 1.35 / 1.48 (Q98, numbers only). Decided rules that arise: Q88 (every control's focus ring is primary) and Q99a (the active dot, the countdown fill and the dot focus ring are accent marks, mint at 1.33:1 on light). No ink edge arises (the marks turn ink, no mint fill remains on light), so no Q102 and no c. No filled button, so no Q101. Open for Tom, not a decided rule: inactive dots (1.57 light), the disabled chevron (1.30 light) and the arrow hover tint (1.04 light) are faint. No lib bug found.",
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
