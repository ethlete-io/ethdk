import { SDK_ICONS } from '@ethlete/components/design/icon-set';
import { iconMarkup } from '@ethlete/components/design/icon';
import { timeline, timelineStyles, type TimelineMockItem } from '@ethlete/components/design/timeline';
import { definePart, drawing } from '@design-system';
import frame from './timeline.css?inline';

const icon = (name: string) => SDK_ICONS.find((each) => each.name === name)!;

type Props = {
  markers?: boolean;
  themedDots?: boolean;
  time?: boolean;
  compact?: boolean;
  long?: boolean;
  count?: number;
};

const EVENTS = [
  {
    time: '18:30',
    label: 'Squad announced',
    description: 'Both line-ups published 60 minutes before kickoff.',
    icon: 'et-clock',
    color: undefined,
  },
  {
    time: "23'",
    label: 'Goal by A. Rossi',
    description: 'Assisted by M. Keller after a counter down the left.',
    icon: 'et-circle-check',
    color: 'warning',
  },
  {
    time: "67'",
    label: 'Second yellow for L. Turner',
    description: 'Sent off; the home side plays the rest a player down.',
    icon: 'et-triangle-exclamation',
    color: 'danger',
  },
  {
    time: "90+4'",
    label: 'Fulltime - 2:1',
    description: 'The visitors take all three points and go top of the table.',
    icon: 'et-trophy',
    color: 'brand',
  },
];

const LONG_LABEL = 'Match report filed by the referee with notes on both sendings-off and the crowd incident';
const LONG_DESCRIPTION =
  'league.example.com/matches/20261031_home_visitors_report_attachments_referee_statement_final.pdf';

const items = ({ markers, themedDots, time = true, compact, long, count = EVENTS.length }: Props) =>
  EVENTS.slice(0, count).map((event, index): TimelineMockItem => {
    const label = long && index === 1 ? LONG_LABEL : event.label;
    const description = long && index === 1 ? LONG_DESCRIPTION : event.description;

    return {
      time: time ? event.time : undefined,
      marker: markers ? iconMarkup(icon(event.icon)) : undefined,
      color: markers || themedDots ? event.color : undefined,
      content:
        `<p class="timeline-label">${label}</p>` +
        (compact ? '' : `<p class="timeline-description">${description}</p>`),
    };
  });

export default definePart({
  note: 'Decided rules only',
  madeBy: ['claude-opus-5-5', 'claude-sonnet-5-5'],
  states: {
    default: {},
    'with-markers': { markers: true },
    'themed-dots': { themedDots: true },
    compact: { compact: true },
    'compact-markers': { compact: true, markers: true },
    'no-time': { time: false },
    'long-content': { long: true, markers: true },
    single: { count: 1 },
  },
  describe: {
    default:
      'Four match events with times, labels and descriptions; check that dots line up on one rail with even gaps.',
    'with-markers': 'The events with icon markers in their theme colors; check that each icon centers on the rail.',
    'themed-dots': 'The events with plain dots in their theme colors; check that each dot takes its color.',
    compact: 'The events with labels only; check that rows tighten and the rail stays continuous.',
    'compact-markers': 'The compact events with icon markers; check that markers fit the tighter rows.',
    'no-time': 'The events without times; check that the content shifts over and the rail stays aligned.',
    'long-content': 'A long label and a long URL in the second event; check that both wrap and nothing overflows.',
    single: 'A single event; check that no rail runs past its dot.',
  },
  widths: [480],
  render: (props: Props) =>
    drawing({
      body: `<div class="timeline-frame ${props.compact ? 'timeline-frame--compact' : ''}">${timeline({ items: items(props) })}</div>`,
      styles: [timelineStyles, frame].join('\n'),
    }),
});
