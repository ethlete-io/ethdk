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
  describe: {
    default:
      'Weekly active users 25.2K, up 6.8% and good, with a sparkline; check that the delta reads positive and the line fits.',
    'up-bad': 'p95 latency 212 ms, up 18 and bad; check that the delta takes the danger color though it points up.',
    'down-good': 'Churn rate 3.4%, down 2.1% and good; check that the delta reads positive though it points down.',
    'down-unrated': 'Page views down 310 with no sentiment; check that the delta stays neutral in color.',
    unchanged: 'Open tickets with a delta of 0; check that the neutral arrow and text show.',
    unit: 'p95 latency 212 with the ms unit and no delta; check that the unit sits after the value, smaller.',
    'no-value': 'Weekly active users with no value; check that a placeholder holds the value line.',
    'without-sparkline': 'The default tile without a sparkline; check that the tile closes after the caption.',
    loading: 'The default tile loading; check that skeletons replace value, delta and sparkline at the same size.',
  },
  widths: [480],
  frame: (body) => `<div class="stat-tile-frame">${body}</div>`,
  render: ({ form }: Props) =>
    drawing({
      body: card({ content: statTile(FORMS[form]) }),
      styles: [cardStyles, statTileStyles, frame].join('\n'),
    }),
});
