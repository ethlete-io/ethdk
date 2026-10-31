import { card, cardStyles } from '@ethlete/components/design/card';
import { statTile, StatTileMockOptions, statTileStyles } from '@ethlete/components/design/stat-tile';
import { definePart, drawing } from '@design-system';
import frame from './stat-tile.css?inline';

type Form =
  | 'up-good'
  | 'up-bad'
  | 'down-good'
  | 'down-unrated'
  | 'unchanged'
  | 'unit'
  | 'no-value'
  | 'without-sparkline'
  | 'loading';

type Props = { form: Form };

const WEEKLY_USERS = [182, 176, 190, 201, 195, 210, 224, 218, 231, 240, 236, 252];
const LATENCY = [180, 185, 178, 190, 196, 188, 201, 199, 205, 210, 204, 212];

const DEFAULT: StatTileMockOptions = {
  label: 'Weekly active users',
  value: '25.2K',
  delta: { text: '+6.8%', direction: 'up', sentiment: 'good' },
  caption: 'vs last week',
  sparkline: WEEKLY_USERS,
};

const FORMS: Record<Form, StatTileMockOptions> = {
  'up-good': DEFAULT,
  'up-bad': {
    label: 'p95 latency',
    value: '212',
    unit: 'ms',
    delta: { text: '+18', direction: 'up', sentiment: 'bad', color: 'danger' },
    caption: 'vs last month',
    sparkline: LATENCY,
  },
  'down-good': {
    label: 'Churn rate',
    value: '3.4%',
    delta: { text: '-2.1%', direction: 'down', sentiment: 'good' },
    caption: 'vs last month',
  },
  'down-unrated': {
    label: 'Page views',
    value: '12.9K',
    delta: { text: '-310', direction: 'down' },
    caption: 'vs last month',
  },
  unchanged: {
    label: 'Open tickets',
    value: '1,284',
    delta: { text: '0', direction: 'neutral' },
    caption: 'vs last month',
  },
  unit: { label: 'p95 latency', value: '212', unit: 'ms', caption: 'last 24 hours', sparkline: LATENCY },
  'no-value': { label: 'Weekly active users', value: null, caption: 'vs last week' },
  'without-sparkline': { ...DEFAULT, sparkline: undefined },
  loading: { ...DEFAULT, loading: true },
};

export default definePart({
  note: 'Decided rules only',
  madeBy: ['claude-opus-5-5'],
  states: {
    default: { form: 'up-good' },
    'up-bad': { form: 'up-bad' },
    'down-good': { form: 'down-good' },
    'down-unrated': { form: 'down-unrated' },
    unchanged: { form: 'unchanged' },
    unit: { form: 'unit' },
    'no-value': { form: 'no-value' },
    'without-sparkline': { form: 'without-sparkline' },
    loading: { form: 'loading' },
  },
  widths: [480],
  render: ({ form }: Props) =>
    drawing({
      body: `<div class="stat-tile-frame">${card({ content: statTile(FORMS[form]) })}</div>`,
      styles: [cardStyles, statTileStyles, frame].join('\n'),
    }),
});
