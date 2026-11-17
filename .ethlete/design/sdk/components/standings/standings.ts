import { standings, standingsPick, StandingsMockRow, standingsStyles } from '@ethlete/components/design/standings';
import { definePart, drawing } from '@design-system';
import frame from './standings.css?inline';

type Props = {
  view: 'table' | 'pick';
  plain?: boolean;
  empty?: boolean;
  cardForce?: { index: number; force: string };
  dragging?: boolean;
  locked?: boolean;
};

const ROWS: StandingsMockRow[] = [
  {
    position: 1,
    name: 'Northbridge Rovers',
    played: 10,
    wins: 8,
    ties: 1,
    losses: 1,
    difference: 17,
    points: 25,
    form: ['win', 'win', 'tie', 'win', 'win'],
  },
  {
    position: 2,
    name: 'Harbor City',
    played: 10,
    wins: 7,
    ties: 1,
    losses: 2,
    difference: 11,
    points: 22,
    form: ['win', 'loss', 'win', 'win', 'tie'],
  },
  {
    position: 3,
    name: 'Eastvale United',
    played: 10,
    wins: 5,
    ties: 2,
    losses: 3,
    difference: 4,
    points: 17,
    form: ['tie', 'win', 'loss', 'win', 'win'],
  },
  {
    position: 4,
    name: 'Pinewood Athletic',
    played: 10,
    wins: 4,
    ties: 3,
    losses: 3,
    difference: 0,
    points: 15,
    form: ['loss', 'tie', 'win', 'tie', 'win'],
  },
  {
    position: 5,
    name: 'Lakeside Town',
    played: 10,
    wins: 2,
    ties: 2,
    losses: 6,
    difference: -9,
    points: 8,
    form: ['loss', 'loss', 'tie', 'win', 'loss'],
  },
  {
    position: 6,
    name: 'Stonegate FC',
    played: 10,
    wins: 0,
    ties: 3,
    losses: 7,
    difference: -23,
    points: 3,
    form: ['loss', 'tie', 'loss', 'loss', 'tie'],
  },
];

const ZONES = [
  { from: 1, to: 2, label: 'Advances to the playoffs' },
  { from: 6, to: 6, label: 'Relegated', color: 'danger' },
];

const PICK_MARKS = ['+3', '+1', '0', '+3', '+1', '0'];

const table = (props: Props) =>
  standings({
    rows: props.empty ? [] : ROWS,
    zones: props.plain || props.empty ? [] : ZONES,
    highlighted: props.plain ? undefined : 4,
    showLegend: !props.plain,
  });

const pick = (props: Props) =>
  standingsPick({
    rows: ROWS.map((row, index) => ({
      name: row.name,
      mark: `<span class="t-mark">${PICK_MARKS[index]}</span>`,
      cardForce: props.cardForce?.index === index ? props.cardForce.force : undefined,
    })),
    advancingCount: 2,
    locked: props.locked,
    dragging: props.dragging ? { index: 3, offset: -38, ghostOffset: -44 } : undefined,
    shifts: props.dragging ? [0, 0, 44] : undefined,
  });

export default definePart({
  note: 'Decided rules only',
  madeBy: ['claude-opus-5-5'],
  states: {
    table: { view: 'table' },
    'table-plain': { view: 'table', plain: true },
    'table-empty': { view: 'table', empty: true },
    pick: { view: 'pick' },
    'pick-card-hover': { view: 'pick', cardForce: { index: 1, force: 'hover' } },
    'pick-card-focus-visible': { view: 'pick', cardForce: { index: 1, force: 'focus-visible' } },
    'pick-dragging': { view: 'pick', dragging: true },
    'pick-locked': { view: 'pick', locked: true },
  },
  describe: {
    table:
      'Six teams with zones, a legend and Pinewood highlighted; check the zone marks, the form dots and the numbers align.',
    'table-plain': 'The six teams without zones, highlight or legend; check that rows read evenly with no zone marks.',
    'table-empty': 'The table with no rows; check that the header stays and the empty body does not collapse oddly.',
    pick: 'The pick list of six teams with two advancing; check the cut line after the second card and the point marks.',
    'pick-card-hover': 'Harbor City hovered in the pick list; check that only that card shows the hover look.',
    'pick-card-focus-visible': 'Harbor City focused by keyboard; check that the focus ring wraps that card.',
    'pick-dragging':
      'Pinewood lifted and dragged up; check the drag shadow, the ghost slot and the shifted card below.',
    'pick-locked': 'The pick list locked; check that cards show no drag handle and read as fixed.',
  },
  widths: [480, 800],
  frame: (body) => `<div class="t-frame">${body}</div>`,
  render: (props: Props) =>
    drawing({
      body: props.view === 'table' ? table(props) : pick(props),
      styles: [standingsStyles, frame].join('\n'),
    }),
});
