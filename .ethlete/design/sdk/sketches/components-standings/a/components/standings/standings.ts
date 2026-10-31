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
  note: "The SDK standings (et-standings and et-standings-pick), first drawing, drawn by the mocks from @ethlete/components/design/standings with the real markup and CSS: the standings, standings pick, match participant and focus ring sheets. Emblems are the participant's letter fallback, no images. Framed as a 480px page with 16px padding (448px content): at that width the container queries hide the detail and form columns, so the table shows position, team and points; the 800px width shows P / W / D / L / Diff and the form column. Fixtures: six fictional clubs, zones 1-2 'Advances to the playoffs' (the colour theme around the table, brand) and 6 'Relegated' (an app's danger theme), the own team at 4 (data-highlighted). The pick mark (+3 / +1 / 0) is consumer template content in the theme ink. States: table (zones, highlighted row, legend), table-plain (no zones, no highlight, no legend), table-empty (no rows: the lib renders the header row alone), pick (six rows, two advancing, the cut line under row 2), pick-handle-hover and pick-handle-focus-visible (the reorder handle of row 2), pick-dragging (Pinewood lifted 38px towards slot 3, Eastvale slid into slot 4), pick-locked (no handles, the marks shown). Static snapshot: the preview slide drawn at rest. Numbers (light / dark), from shot pixels at scale 2, brand mint, a: mint zone bar vs the zone row tint 1.28 / 11.78 (vs page 1.33 / 13.50); mint legend swatch vs page 1.33 / 13.50; danger zone bar vs its tint 4.35 / 3.56, danger swatch vs page 4.83 / 3.71; zone tint vs page 1.04 / 1.15 (danger 1.11 / 1.04); highlighted row vs page 1.16 / 1.22; muted position vs page 7.81 / 6.94; pick cut line (primary at 50 % opacity) vs page 1.23 / 4.15; pick handle focus ring (et-focus-ring, primary) vs card 1.22 / 11.98 (vs page 1.34 / 13.50); grip vs card 7.10 / 6.16; handle hover tint vs card 1.21, grip on it 13.45; dragged card vs page 1.28 / 1.40 (vs a resting card 1.17 / 1.24); locked card vs page 1.06 / 1.06, its muted name 7.36 / 6.52. Q98 numbers only: no edges; the row lines vs a row 1.23 / 1.48, the head line vs page 1.26 / 1.73; the pick card fill vs page 1.10 / 1.13. Decided rules that arise: Q88 (the pick handle focus ring) and Q99a (the zone bars, the legend swatches and the cut line). The zone row tint (7 %) is a band tint, not a fill or a selected row, so it is kept; the lib has no selected row, so the 32 / 38 / 44 % step does not arise. No mint fill, so no ink edge, so Q102 does not arise and there is no c. Q101 does not arise: no filled button. Lib fixes in this round (76 calls): the draw letter keeps the surface colour on a 25 % surface-colour fill (was 45 %, 3.59:1 in dark), now 9.04-10.39 light / 6.31-7.73 dark (lowest on the highlighted row), so no contrast exception; the zone bar is an inset box-shadow on the position cell (no position: relative, no ::before, flipped under :dir(rtl)), so the row line runs the full row width. Later rounds, left out here: the density and font tokens, a link participant, the seed and subtitle, long names at 480, the locked pick with a consumer theme per mark, touch drag.",
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
  render: (props: Props) =>
    drawing({
      body: `<div class="t-frame">${props.view === 'table' ? table(props) : pick(props)}</div>`,
      styles: [standingsStyles, frame].join('\n'),
    }),
});
