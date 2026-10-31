import { standings, standingsPick, StandingsMockRow, standingsStyles } from '@ethlete/components/design/standings';
import { definePart, drawing } from '@design-system';
import frame from './standings.css?inline';

type Props = {
  view: 'table' | 'pick';
  plain?: boolean;
  empty?: boolean;
  handleForce?: { index: number; force: string };
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
      handleForce: props.handleForce?.index === index ? props.handleForce.force : undefined,
    })),
    advancingCount: 2,
    locked: props.locked,
    dragging: props.dragging ? { index: 3, offset: -38 } : undefined,
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
    'pick-handle-hover': { view: 'pick', handleForce: { index: 1, force: 'hover' } },
    'pick-handle-focus-visible': { view: 'pick', handleForce: { index: 1, force: 'focus-visible' } },
    'pick-dragging': { view: 'pick', dragging: true },
    'pick-locked': { view: 'pick', locked: true },
  },
  widths: [480, 800],
  frame: (body) => `<div class="t-frame">${body}</div>`,
  render: (props: Props) =>
    drawing({
      body: props.view === 'table' ? table(props) : pick(props),
      styles: [standingsStyles, frame].join('\n'),
    }),
});
