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
  note: 'Q138: the floating trigger gets the Q99a 1px inset ink edge in light only, so it reaches 3:1 on a light grey row (4.68) and the page (5.48); dark unchanged.',
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
  describe: {
    inline: 'Filter (2) inline above the results at the top of the page; check that it sits in the flow.',
    floating: 'Scrolled into the results, Filter (2) floats at the bottom end; check its inset and shadow.',
    'floating-hover': 'The floating trigger hovered; check its hover look.',
    'floating-active': 'The floating trigger pressed; check that the press goes past hover.',
    'floating-focus-visible': 'The floating trigger with keyboard focus; check the focus ring around it.',
    'inline-focus-visible': 'The inline trigger with keyboard focus; check the focus ring in the flow.',
    'floating-icon': 'The floating trigger with a filter icon; check the icon and the wider trigger.',
    'floating-inset': 'The floating trigger at a 12 px inset; check that it moves closer to the corner.',
    'floating-danger': 'The floating trigger in the danger colour; check that the label reads on the fill.',
    'floating-danger-hover': 'The danger trigger hovered; check its hover step.',
    'floating-over-row': 'The floating trigger over a result row; check that it stays readable over the row.',
    hidden: 'Scrolled past the results; check that the trigger is gone.',
  },
  widths: [480],
  render: (props: Props) =>
    drawing({
      body: `<div class="fa-frame" data-et-skip="CLIPPED"><div class="fa-page" style="margin-block-start: -${props.overRow ? OVER_ROW_SCROLL : SCROLL[props.state ?? 'inline']}px">${render(props)}</div></div>`,
      styles: [floatingActionStyles, frame].join('\n'),
    }),
});
