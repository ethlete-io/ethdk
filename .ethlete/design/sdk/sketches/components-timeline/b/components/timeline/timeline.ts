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
  note: "The SDK timeline (et-timeline with et-timeline-item), drawn by its mock from @ethlete/components/design, framed as its story does (max 520px, surface fill, 14px label, 12px muted description). A vertical rail per item: a 20px marker box joined to the next marker by a 2px connector in --et-surface-border-solid; with no projected marker the box shrinks to an 8px dot in --et-timeline-marker-color (default: the item's theme primary). A projected [etTimelineMarker] icon draws at 14px in the same colour on a page-coloured disc. The 12px [etTimelineTime] sits above the content in the muted surface text. color scopes a theme per item (story: none, success, danger, brand; this product registers no success theme, so warning stands in). No current/active item, no links, no interactive states and no focus ring exist in the lib. States: default (dots, all in the inherited theme, as the story), with-markers (icons + themes), themed-dots, compact (14px marker, 6px dot, 8px gaps), compact-markers, no-time, long-content (two-line label and an unbroken value), single (no connector).",
  madeBy: ['claude-opus-5-5'],
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
  widths: [480],
  render: (props: Props) =>
    drawing({
      body: `<div class="timeline-frame${props.compact ? ' timeline-frame--compact' : ''}">${timeline({ items: items(props) })}</div>`,
      styles: [timelineStyles, frame].join('\n'),
    }),
});
