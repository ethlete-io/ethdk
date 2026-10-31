import { floatingAction, floatingActionStyles } from '@ethlete/components/design/floating-action';
import { definePart, drawing } from '@design-system';
import frame from './floating-action.css?inline';

type Interaction = 'hover' | 'active' | 'focus-visible';

type Props = {
  state?: 'inline' | 'floating' | 'hidden';
  interaction?: Interaction;
  filterIcon?: boolean;
  color?: string;
  inset?: number;
  overRow?: boolean;
};

const SCROLL = { inline: 0, floating: 236, hidden: 980 };
const OVER_ROW_SCROLL = 252;
const PARAGRAPH =
  'Pick a competition and a season, then narrow the list down by team, venue or kick-off time to find the match you are after.';

const rows = Array.from({ length: 12 }, (_, index) => `<li class="fa-row">Result ${index + 1}</li>`).join('');
const paragraphs = (count: number) => Array.from({ length: count }, () => `<p>${PARAGRAPH}</p>`).join('');

const render = ({ state = 'inline', interaction, filterIcon, color, inset }: Props) =>
  floatingAction({
    state,
    filterIcon,
    trigger: { label: 'Filter (2)', color },
    triggerAttributes: interaction ? `data-et-force="${interaction}"` : undefined,
    heldSize: { inlineSize: filterIcon ? 132 : 104, blockSize: 40 },
    before: `${paragraphs(2)}<h2 class="fa-heading">Results</h2>`,
    scope: `<ul class="fa-rows">${rows}</ul>`,
    after: paragraphs(8),
    attributes:
      inset === undefined
        ? undefined
        : `style="--et-floating-action-inset-inline-end: ${inset}px; --et-floating-action-inset-block-end: ${inset}px"`,
  });

export default definePart({
  note: "The SDK floating action (etFloatingAction), first drawing, drawn by its mock from @ethlete/components/design with its real markup and CSS: the host, the anchor (etFloatingActionAnchor), the trigger (etFloatingActionTrigger, here the story's filled md et-button 'Filter (2)') and the scope (etFloatingActionScope, the results list). The lib draws no look of its own: the trigger is whatever button the consumer puts there, and the floating action only moves it. Framed as a 400px page: two paragraphs, a 'Results' heading, the anchor, 12 result rows (8% surface ink, 8px corners) and the outro; the page is scrolled by a negative margin and the frame (transform) is the containing block of the fixed trigger, so it pins to the frame's corner at 480px; the frame clips the scrolled page on purpose (data-et-skip=CLIPPED). What the lib does: inline while the anchor is on screen; floating (position fixed, 24px from the inline end and block end plus the safe-area and --et-viewport-inset-bottom, z-index 10) once the anchor scrolls away while the scope is in view, the anchor holding the trigger's in-flow size; hidden (scale 0, visibility hidden) once the scope has gone too. One position only: bottom end, moved by --et-floating-action-inset-inline-end / -block-end. The scale-in keyframe and scale-out transition (200ms) are drawn with animation and transition none at their end values. disabled keeps the trigger inline at any scroll position, so it looks like inline (not drawn apart). No label/icon-only split in the lib; the icon state draws the filter icon in the button. Elevation (Q105, in the lib since): while floating, the trigger draws a light two-layer shadow on a ::before (0 3px 8px at 20 %, 0 1px 3px at 12 %, --et-shadow-color-rgb), faded in by opacity only over the 200ms; inline and hidden draw none. States: inline, inline-focus-visible, floating, floating-hover, floating-active, floating-focus-visible, floating-icon, floating-inset (12px insets), floating-danger, floating-danger-hover, floating-over-row (the trigger centred on result row 8, page scrolled 252px; read in the light frame, bug 1.13), hidden. Numbers (light / dark), from shot pixels at scale 2, brand mint unless named: fill vs page 1.33 / 13.50, vs a result row it floats over 1.13 / 10.96; label on fill 15.82; hover fill (-hover token) vs page 1.37 / 13.06; active fill 2.24 / 8.01, label 9.38; focus ring (primary, 2px 3px out) vs row 1.17 / 10.60, vs page 1.37 / 13.06; danger fill vs page 4.83 / 3.71, label 4.83, hover 6.47 / 2.77. Q98 (row vs page) numbers only: 1.17 / 1.23. Q105 shadow in floating-over-row, light, a: the fill vs the row stays 1.13, but a 3px grey halo now edges the trigger on the row: 1.46 vs the row right under the bottom edge, fading to 1.19 at 3px; 1.25 beside the inline-start edge, 1.14 at 1.5px. The trigger lifts visibly off the grey row, though no edge reaches 3:1; in dark the black shadow on the dark row barely shows, and the fill already stands at 10.96 there. Decided rules that arise: Q88 (focus ring), Q99a (the mint fill gets a 1px inset ink edge on light) and Q101 (filled hover = -active). An ink edge arises, so Q102 arises: b draws the edge in dark too, c keeps dark as today. The open point of r1, the mint fill blending into a grey row at 1.13 in light, is settled by Q105 (the shadow above). No lib bug found.",
  madeBy: ['claude-opus-5-5'],
  states: {
    inline: {},
    floating: { state: 'floating' },
    'floating-hover': { state: 'floating', interaction: 'hover' },
    'floating-active': { state: 'floating', interaction: 'active' },
    'floating-focus-visible': { state: 'floating', interaction: 'focus-visible' },
    'inline-focus-visible': { interaction: 'focus-visible' },
    'floating-icon': { state: 'floating', filterIcon: true },
    'floating-inset': { state: 'floating', inset: 12 },
    'floating-danger': { state: 'floating', color: 'danger' },
    'floating-danger-hover': { state: 'floating', color: 'danger', interaction: 'hover' },
    'floating-over-row': { state: 'floating', overRow: true },
    hidden: { state: 'hidden' },
  },
  widths: [480],
  render: (props: Props) =>
    drawing({
      body: `<div class="fa-frame" data-et-skip="CLIPPED"><div class="fa-page" style="margin-block-start: -${props.overRow ? OVER_ROW_SCROLL : SCROLL[props.state ?? 'inline']}px">${render(props)}</div></div>`,
      styles: [floatingActionStyles, frame].join('\n'),
    }),
});
